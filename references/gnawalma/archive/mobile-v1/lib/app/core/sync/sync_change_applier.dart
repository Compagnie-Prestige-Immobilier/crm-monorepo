import '../../data/models/client_model.dart';
import '../../data/repositories/client_repository.dart';
import 'sync_models.dart';
import 'sync_store.dart';

class SyncChangeApplier {
  const SyncChangeApplier({
    required SyncStore store,
    required ClientRepository clients,
  }) : _store = store,
       _clients = clients;

  final SyncStore _store;
  final ClientRepository _clients;

  Future<void> apply(String atelierId, SyncPullChange change) async {
    switch (change.entityType) {
      case SyncEntityType.client:
        await _applyClient(atelierId, change);
        break;
      case SyncEntityType.inventoryItem:
        // Le stock n'est plus géré par l'application. Le serveur peut encore
        // renvoyer des lignes d'inventaire héritées : les ignorer plutôt que
        // de refuser tout le lot, qui contient aussi les clients.
        break;
    }
  }

  Future<void> _applyClient(String atelierId, SyncPullChange change) async {
    final existingLink = _store.linkByRemoteId(
      atelierId: atelierId,
      entityType: SyncEntityType.client,
      remoteId: change.entityId,
    );

    if (change.mutation == SyncMutation.delete) {
      final localId = int.tryParse(existingLink?.localId ?? '');
      if (localId != null) await _clients.deleteClient(localId);
      if (existingLink != null) {
        await _store.saveLink(existingLink.copyWith(version: change.version));
      }
      return;
    }

    final fullName = _string(change.payload['fullName']) ?? 'Client';
    final names = _splitName(fullName);
    final localId = int.tryParse(existingLink?.localId ?? '');
    ClientModel? client = localId == null
        ? null
        : await _clients.getClientById(localId);

    if (client == null) {
      client = ClientModel()
        ..firstName = names.$1
        ..lastName = names.$2
        ..phone = _string(change.payload['phone'])
        ..email = _string(change.payload['email'])
        ..notes = _string(change.payload['notes'])
        ..totalOrders = 0
        ..totalSpent = 0
        ..createdAt = _date(change.payload['createdAt']) ?? DateTime.now();
      final createdId = await _clients.createClient(client);
      client.id = createdId;
    } else {
      client
        ..firstName = names.$1
        ..lastName = names.$2
        ..phone = _string(change.payload['phone'])
        ..email = _string(change.payload['email'])
        ..notes = _string(change.payload['notes']);
      await _clients.updateClient(client);
    }

    await _store.saveLink(
      RemoteEntityLink(
        atelierId: atelierId,
        entityType: SyncEntityType.client,
        localId: client.id.toString(),
        remoteId: change.entityId,
        version: change.version,
      ),
    );
  }

  static (String, String) _splitName(String fullName) {
    final parts = fullName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList(growable: false);
    if (parts.isEmpty) return ('Client', '');
    if (parts.length == 1) return (parts.first, '');
    return (parts.first, parts.skip(1).join(' '));
  }

  static String? _string(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }

  static DateTime? _date(Object? value) {
    final text = _string(value);
    return text == null ? null : DateTime.tryParse(text)?.toLocal();
  }
}
