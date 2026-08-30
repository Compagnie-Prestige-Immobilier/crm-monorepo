import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/models/favorite_workshop_model.dart';
import '../../../../data/services/database_service.dart';
import '../data/favorite_workshops_repository.dart';
import '../domain/marketplace_atelier.dart';

final favoriteWorkshopsRepositoryProvider =
    FutureProvider<FavoriteWorkshopsRepository>((ref) async {
      final isar = await ref.watch(databaseProvider.future);
      return FavoriteWorkshopsRepository(isar);
    });

final favoriteWorkshopsProvider =
    AsyncNotifierProvider<
      FavoriteWorkshopsController,
      List<FavoriteWorkshopModel>
    >(FavoriteWorkshopsController.new);

class FavoriteWorkshopsController
    extends AsyncNotifier<List<FavoriteWorkshopModel>> {
  @override
  Future<List<FavoriteWorkshopModel>> build() async {
    final repository = await ref.watch(
      favoriteWorkshopsRepositoryProvider.future,
    );
    return repository.getAll();
  }

  bool isFavorite(String atelierId) {
    return state.asData?.value.any(
          (favorite) => favorite.workshopId == atelierId,
        ) ??
        false;
  }

  Future<void> toggle(MarketplaceAtelier atelier) async {
    final repository = await ref.read(
      favoriteWorkshopsRepositoryProvider.future,
    );
    final wasFavorite = isFavorite(atelier.id);
    if (wasFavorite) {
      await repository.remove(atelier.id);
    } else {
      await repository.add(atelier);
    }
    state = AsyncData(await repository.getAll());
  }
}
