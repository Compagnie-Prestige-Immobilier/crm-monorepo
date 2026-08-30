import 'package:uuid/uuid.dart';

import 'sync_change_applier.dart';
import 'sync_models.dart';
import 'sync_repository.dart';
import 'sync_store.dart';

class SyncCoordinator {
  const SyncCoordinator({
    required SyncStore store,
    required SyncRepository repository,
    required SyncChangeApplier changeApplier,
  }) : _store = store,
       _repository = repository,
       _changeApplier = changeApplier;

  static const _uuid = Uuid();

  final SyncStore _store;
  final SyncRepository _repository;
  final SyncChangeApplier _changeApplier;

  Future<void> enqueueClient({
    required String atelierId,
    required String localId,
    required String fullName,
    String? phone,
    String? email,
    String? notes,
    SyncMutation mutation = SyncMutation.upsert,
  }) async {
    var link = await _store.link(
      atelierId: atelierId,
      entityType: SyncEntityType.client,
      localId: localId,
    );
    link ??= RemoteEntityLink(
      atelierId: atelierId,
      entityType: SyncEntityType.client,
      localId: localId,
      remoteId: _uuid.v4(),
      version: 0,
    );
    if (mutation == SyncMutation.delete && link.version == 0) {
      await _store.discardPendingForEntity(
        atelierId: atelierId,
        entityType: SyncEntityType.client,
        entityId: link.remoteId,
      );
      await _store.deleteLink(link);
      return;
    }
    await _store.saveLink(link);
    await _store.enqueue(
      SyncOperation(
        operationId: _uuid.v4(),
        atelierId: atelierId,
        entityType: SyncEntityType.client,
        entityId: link.remoteId,
        localId: localId,
        baseVersion: link.version,
        mutation: mutation,
        payload: {
          'fullName': fullName.trim(),
          if ((phone ?? '').trim().isNotEmpty) 'phone': phone!.trim(),
          if ((email ?? '').trim().isNotEmpty) 'email': email!.trim(),
          if ((notes ?? '').trim().isNotEmpty) 'notes': notes!.trim(),
        },
        createdAt: DateTime.now(),
        queueState: SyncQueueState.pending,
      ),
    );
  }

  /// L'identifiant serveur d'un client local, s'il en a déjà un.
  ///
  /// Le lien est créé au moment de la mise en file, avant même que la
  /// synchronisation ait abouti : c'est ce qui permet à une commande de
  /// désigner son client sur le serveur.
  Future<String?> remoteClientId({
    required String atelierId,
    required String localId,
  }) async {
    final link = await _store.link(
      atelierId: atelierId,
      entityType: SyncEntityType.client,
      localId: localId,
    );
    return link?.remoteId;
  }

  Future<SyncSnapshot> snapshot(String atelierId) async {
    return SyncSnapshot(
      pendingCount: _store.pendingCount(atelierId),
      conflictCount: _store.conflictCount(atelierId),
      isSyncing: false,
      lastSyncedAt: _store.lastSyncedAt(atelierId),
    );
  }

  Future<SyncSnapshot> synchronize(String atelierId) async {
    final pending = _store.pendingForAtelier(atelierId);
    if (pending.isNotEmpty) {
      await _store.markSending(pending);
    }

    try {
      final deviceId = await _store.deviceId();
      if (pending.isNotEmpty) {
        final results = await _repository.push(
          atelierId: atelierId,
          deviceId: deviceId,
          operations: pending,
        );
        final byId = {for (final result in results) result.operationId: result};

        for (final operation in pending) {
          final result = byId[operation.operationId];
          if (result == null) {
            await _store.markPending(
              operation,
              error: 'Le serveur n’a pas confirmé cette opération.',
            );
            continue;
          }
          if (result.isApplied) {
            final link = await _store.link(
              atelierId: atelierId,
              entityType: operation.entityType,
              localId: operation.localId,
            );
            if (link != null && result.version != null) {
              await _store.saveLink(link.copyWith(version: result.version));
            }
            await _store.remove(operation.operationId);
            continue;
          }
          await _store.markConflict(
            operation,
            error: result.code ?? 'Conflit de synchronisation',
          );
        }
      }

      await _pullMetadata(atelierId, deviceId);
      final now = DateTime.now();
      await _store.saveLastSyncedAt(atelierId, now);
      return (await snapshot(
        atelierId,
      )).copyWith(lastSyncedAt: now, clearError: true);
    } catch (error) {
      for (final operation in pending) {
        await _store.markPending(operation, error: error.toString());
      }
      return (await snapshot(atelierId)).copyWith(lastError: error.toString());
    }
  }

  Future<void> _pullMetadata(String atelierId, String deviceId) async {
    // The local-to-remote id map lives only in a Hive box. If it is gone while
    // a cursor survives, this device has synced before but can no longer
    // recognise anything the server sends — and pushing would re-create every
    // row as a duplicate. Replaying the change log from zero rebuilds the
    // mapping from the server, which is the authority for it.
    if (_store.rebuildRequired(atelierId)) {
      await _store.resetCursor(atelierId);
    }

    var cursor = await _store.cursor(atelierId);
    var hasMore = true;
    while (hasMore) {
      final page = await _repository.pull(
        atelierId: atelierId,
        deviceId: deviceId,
        after: cursor,
      );
      for (final change in page.changes) {
        await _changeApplier.apply(atelierId, change);
        final link = _store.linkByRemoteId(
          atelierId: atelierId,
          entityType: change.entityType,
          remoteId: change.entityId,
        );
        if (link != null && change.version > link.version) {
          await _store.saveLink(link.copyWith(version: change.version));
        }
      }
      cursor = page.cursor;
      hasMore = page.hasMore;
      await _store.saveCursor(atelierId, cursor);
    }
  }
}
