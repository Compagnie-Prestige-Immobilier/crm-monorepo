import 'package:isar_plus/isar_plus.dart';

import '../../../../core/config/app_environment.dart';
import '../../../../data/models/favorite_workshop_model.dart';
import '../domain/marketplace_atelier.dart';

class FavoriteWorkshopsRepository {
  const FavoriteWorkshopsRepository(this._isar);

  final Isar _isar;

  Future<List<FavoriteWorkshopModel>> getAll() {
    return _isar.favoriteWorkshopModels
        .where()
        .sortByCreatedAtDesc()
        .findAllAsync();
  }

  Future<bool> contains(String atelierId) async {
    final item = await _isar.favoriteWorkshopModels
        .where()
        .workshopIdEqualTo(atelierId)
        .findFirstAsync();
    return item != null;
  }

  Future<void> add(MarketplaceAtelier atelier) async {
    final existing = await _isar.favoriteWorkshopModels
        .where()
        .workshopIdEqualTo(atelier.id)
        .findFirstAsync();
    if (existing != null) return;

    final item = FavoriteWorkshopModel(
      workshopId: atelier.id,
      workshopName: atelier.name,
      specialty: atelier.specialties.join(' · '),
      phone: atelier.phone,
      address: atelier.address,
      distanceKm: atelier.distanceMeters == null
          ? null
          : atelier.distanceMeters! / 1000,
      rating: atelier.rating,
      // Résolue avant d'être conservée : la valeur stockée est un chemin
      // relatif servi par l'API, et la carte des favoris l'affichait telle
      // quelle, donc sans image.
      imageUrl: AppEnvironment.resolveMediaUrl(
        atelier.coverUrl ?? atelier.logoUrl,
      ),
      // Seuls les ateliers vérifiés sortent de la recherche : la valeur était
      // codée en dur, ce qui la rendait vraie même si cela cessait de l'être.
      isVerified: true,
    )..id = _isar.favoriteWorkshopModels.autoIncrement();

    await _isar.writeAsync((isar) {
      isar.favoriteWorkshopModels.put(item);
    });
  }

  Future<void> remove(String atelierId) async {
    final existing = await _isar.favoriteWorkshopModels
        .where()
        .workshopIdEqualTo(atelierId)
        .findFirstAsync();
    if (existing == null) return;
    await _isar.writeAsync((isar) {
      isar.favoriteWorkshopModels.delete(existing.id);
    });
  }
}
