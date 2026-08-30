import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../data/operations_repository.dart';
import '../domain/operations_models.dart';

final operationsRepositoryProvider = Provider<OperationsRepository>((ref) {
  return OperationsRepository(ref.read(apiClientProvider));
});

final remoteAteliersProvider = FutureProvider<List<RemoteAtelier>>((ref) {
  return ref.read(operationsRepositoryProvider).listAteliers();
});

final primaryRemoteAtelierProvider = FutureProvider<RemoteAtelier?>((
  ref,
) async {
  final ateliers = await ref.watch(remoteAteliersProvider.future);
  return ateliers.isEmpty ? null : ateliers.first;
});

final remoteDashboardProvider =
    FutureProvider.family<OperationsDashboardSummary, String>((ref, atelierId) {
      return ref.read(operationsRepositoryProvider).dashboard(atelierId);
    });

final remoteClientsProvider =
    FutureProvider.family<RemotePage<RemoteClient>, String>((ref, atelierId) {
      return ref.read(operationsRepositoryProvider).listClients(atelierId);
    });

final remoteOrdersProvider =
    FutureProvider.family<RemotePage<RemoteOrder>, String>((ref, atelierId) {
      return ref.read(operationsRepositoryProvider).listOrders(atelierId);
    });

/// Les commandes de tous les ateliers, sans leurs clients.
///
/// Décision du commanditaire : chaque atelier voit l'activité des autres. Le
/// serveur n'envoie ni client, ni montant, ni mesure — voir
/// `OperationsService.listSharedOrders`.
final sharedOrdersProvider = FutureProvider<RemotePage<SharedOrder>>((ref) {
  return ref.read(operationsRepositoryProvider).listSharedOrders();
});

final remoteAtelierContactsProvider =
    FutureProvider.family<RemotePage<RemoteAtelierContact>, String>((
      ref,
      atelierId,
    ) {
      return ref.read(operationsRepositoryProvider).listContacts(atelierId);
    });

final remoteInventoryProvider =
    FutureProvider.family<RemotePage<RemoteInventoryItem>, String>((
      ref,
      atelierId,
    ) {
      return ref.read(operationsRepositoryProvider).listInventory(atelierId);
    });
