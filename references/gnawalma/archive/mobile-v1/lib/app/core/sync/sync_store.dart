import 'package:hive_ce_flutter/hive_ce_flutter.dart';
import 'package:uuid/uuid.dart';

import 'sync_models.dart';

class SyncStore {
  SyncStore._(this._outbox, this._metadata, this._links);

  static const _uuid = Uuid();
  static const _outboxName = 'gnawalma_sync_outbox_v1';
  static const _metadataName = 'gnawalma_sync_metadata_v1';
  static const _linksName = 'gnawalma_sync_links_v1';

  final Box<dynamic> _outbox;
  final Box<dynamic> _metadata;
  final Box<dynamic> _links;

  static Future<SyncStore> open() async {
    final store = SyncStore._(
      await Hive.openBox<dynamic>(_outboxName),
      await Hive.openBox<dynamic>(_metadataName),
      await Hive.openBox<dynamic>(_linksName),
    );
    await store._recoverInterruptedOperations();
    return store;
  }

  Future<String> deviceId() async {
    final existing = _metadata.get('deviceId');
    if (existing is String && existing.isNotEmpty) return existing;
    final generated = _uuid.v4();
    await _metadata.put('deviceId', generated);
    return generated;
  }

  Future<void> enqueue(SyncOperation operation) async {
    final compactable = operationsForAtelier(operation.atelierId).where(
      (item) =>
          item.entityType == operation.entityType &&
          item.entityId == operation.entityId &&
          item.queueState == SyncQueueState.pending,
    );
    for (final item in compactable) {
      await _outbox.delete(item.operationId);
    }
    await _outbox.put(operation.operationId, operation.toStorageJson());
  }

  List<SyncOperation> operationsForAtelier(String atelierId) {
    return _outbox.values
        .whereType<Map>()
        .map(
          (value) =>
              SyncOperation.fromStorageJson(Map<String, dynamic>.from(value)),
        )
        .where((operation) => operation.atelierId == atelierId)
        .toList(growable: false)
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  List<SyncOperation> pendingForAtelier(String atelierId, {int limit = 50}) {
    return operationsForAtelier(atelierId)
        .where((operation) => operation.queueState == SyncQueueState.pending)
        .take(limit)
        .toList(growable: false);
  }

  Future<void> markSending(Iterable<SyncOperation> operations) async {
    for (final operation in operations) {
      await _outbox.put(
        operation.operationId,
        operation
            .copyWith(queueState: SyncQueueState.sending, clearError: true)
            .toStorageJson(),
      );
    }
  }

  Future<void> markPending(SyncOperation operation, {String? error}) {
    return _outbox.put(
      operation.operationId,
      operation
          .copyWith(queueState: SyncQueueState.pending, lastError: error)
          .toStorageJson(),
    );
  }

  Future<void> markConflict(SyncOperation operation, {required String error}) {
    return _outbox.put(
      operation.operationId,
      operation
          .copyWith(queueState: SyncQueueState.conflict, lastError: error)
          .toStorageJson(),
    );
  }

  Future<void> remove(String operationId) => _outbox.delete(operationId);

  Future<void> discardPendingForEntity({
    required String atelierId,
    required SyncEntityType entityType,
    required String entityId,
  }) async {
    final pending = operationsForAtelier(atelierId).where(
      (operation) =>
          operation.entityType == entityType &&
          operation.entityId == entityId &&
          operation.queueState == SyncQueueState.pending,
    );
    for (final operation in pending) {
      await _outbox.delete(operation.operationId);
    }
  }

  int pendingCount(String atelierId) => operationsForAtelier(
    atelierId,
  ).where((item) => item.queueState != SyncQueueState.conflict).length;

  int conflictCount(String atelierId) => operationsForAtelier(
    atelierId,
  ).where((item) => item.queueState == SyncQueueState.conflict).length;

  Future<RemoteEntityLink?> link({
    required String atelierId,
    required SyncEntityType entityType,
    required String localId,
  }) async {
    final value = _links.get(_linkKey(atelierId, entityType, localId));
    return value is Map
        ? RemoteEntityLink.fromJson(Map<String, dynamic>.from(value))
        : null;
  }

  Future<void> saveLink(RemoteEntityLink link) {
    return _links.put(
      _linkKey(link.atelierId, link.entityType, link.localId),
      link.toJson(),
    );
  }

  Future<void> deleteLink(RemoteEntityLink link) {
    return _links.delete(
      _linkKey(link.atelierId, link.entityType, link.localId),
    );
  }

  RemoteEntityLink? linkByRemoteId({
    required String atelierId,
    required SyncEntityType entityType,
    required String remoteId,
  }) {
    for (final value in _links.values.whereType<Map>()) {
      final link = RemoteEntityLink.fromJson(Map<String, dynamic>.from(value));
      if (link.atelierId == atelierId &&
          link.entityType == entityType &&
          link.remoteId == remoteId) {
        return link;
      }
    }
    return null;
  }

  /// True when this device has never recorded a link for [atelierId].
  ///
  /// The link box maps a local row to its server id. It is the *only* record of
  /// that mapping — losing it (reinstall, cleared storage, a Hive box that
  /// fails to open) would otherwise leave every previously synced row looking
  /// brand new, so the next push would re-create all of them as duplicates on
  /// the server.
  ///
  /// [rebuildRequired] lets the coordinator notice that state and repair it by
  /// pulling from cursor 0 — the server's change log is the authority, and a
  /// full pull re-establishes every mapping — instead of pushing into a void.
  bool rebuildRequired(String atelierId) {
    final hasCursor = _metadata.get('cursor:$atelierId') != null;
    if (!hasCursor) return false;
    for (final value in _links.values.whereType<Map>()) {
      final link = RemoteEntityLink.fromJson(Map<String, dynamic>.from(value));
      if (link.atelierId == atelierId) return false;
    }
    // A cursor was advanced at some point, so this device has synced before —
    // but not one link survives. The mapping is gone.
    return true;
  }

  /// Drops the cursor so the next pull replays the whole change log.
  Future<void> resetCursor(String atelierId) =>
      _metadata.delete('cursor:$atelierId');

  Future<int> cursor(String atelierId) async {
    final value = _metadata.get('cursor:$atelierId');
    return value is num ? value.toInt() : 0;
  }

  Future<void> saveCursor(String atelierId, int cursor) {
    return _metadata.put('cursor:$atelierId', cursor);
  }

  DateTime? lastSyncedAt(String atelierId) {
    final value = _metadata.get('lastSyncedAt:$atelierId');
    return value is String ? DateTime.tryParse(value)?.toLocal() : null;
  }

  Future<void> saveLastSyncedAt(String atelierId, DateTime value) {
    return _metadata.put(
      'lastSyncedAt:$atelierId',
      value.toUtc().toIso8601String(),
    );
  }

  Future<void> _recoverInterruptedOperations() async {
    final interrupted = _outbox.values
        .whereType<Map>()
        .map(
          (value) =>
              SyncOperation.fromStorageJson(Map<String, dynamic>.from(value)),
        )
        .where((operation) => operation.queueState == SyncQueueState.sending)
        .toList(growable: false);
    for (final operation in interrupted) {
      await markPending(
        operation,
        error: 'Synchronisation interrompue avant confirmation.',
      );
    }
  }

  static String _linkKey(
    String atelierId,
    SyncEntityType type,
    String localId,
  ) => '$atelierId:${type.apiValue}:$localId';
}
