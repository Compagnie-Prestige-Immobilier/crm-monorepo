import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/client_repository.dart';
import '../../modules/operations/controllers/operations_providers.dart';
import '../network/network_providers.dart';
import 'sync_change_applier.dart';
import 'sync_coordinator.dart';
import 'sync_models.dart';
import 'sync_repository.dart';
import 'sync_store.dart';

final syncStoreProvider = FutureProvider<SyncStore>((ref) => SyncStore.open());

final syncRepositoryProvider = Provider<SyncRepository>((ref) {
  return SyncRepository(ref.read(apiClientProvider));
});

final syncCoordinatorProvider = FutureProvider<SyncCoordinator>((ref) async {
  final store = await ref.watch(syncStoreProvider.future);
  return SyncCoordinator(
    store: store,
    repository: ref.read(syncRepositoryProvider),
    changeApplier: SyncChangeApplier(
      store: store,
      clients: await ref.watch(clientRepositoryProvider.future),
    ),
  );
});

final primarySyncSnapshotProvider = FutureProvider<SyncSnapshot?>((ref) async {
  final atelier = await ref.watch(primaryRemoteAtelierProvider.future);
  if (atelier == null) return null;
  final coordinator = await ref.watch(syncCoordinatorProvider.future);
  return coordinator.snapshot(atelier.id);
});

final syncNowProvider = FutureProvider.autoDispose<SyncSnapshot?>((ref) async {
  final online = await ref.watch(networkAvailabilityProvider.future);
  if (!online) return null;
  final atelier = await ref.watch(primaryRemoteAtelierProvider.future);
  if (atelier == null) return null;
  final coordinator = await ref.watch(syncCoordinatorProvider.future);
  final result = await coordinator.synchronize(atelier.id);
  ref.invalidate(primarySyncSnapshotProvider);
  return result;
});
