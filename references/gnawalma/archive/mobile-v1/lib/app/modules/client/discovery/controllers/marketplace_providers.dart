import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/location/location_service.dart';
import '../../../../core/network/network_providers.dart';
import '../../activity/domain/marketplace_contact.dart';
import '../data/marketplace_repository.dart';
import '../../ranking/domain/ranked_atelier.dart';
import '../domain/marketplace_atelier.dart';

final marketplaceRepositoryProvider = Provider<MarketplaceRepository>((ref) {
  return MarketplaceRepository(ref.read(apiClientProvider));
});

final marketplaceSearchProvider =
    FutureProvider.family<List<MarketplaceAtelier>, MarketplaceSearchQuery>((
      ref,
      query,
    ) {
      return ref.read(marketplaceRepositoryProvider).search(query);
    });

/// One atelier's profile, measured from the same origin the search uses.
///
/// La position de l'utilisateur voyage avec la requête, pour que la fiche
/// annonce la même distance que la carte sur laquelle il a appuyé. Sans
/// position accordée, le serveur répond `distanceMeters: null` et l'écran le
/// dit, au lieu de mesurer depuis un point inventé.
final marketplaceAtelierProvider =
    FutureProvider.family<MarketplaceAtelier, String>((ref, atelierId) {
      final location = ref.watch(locationControllerProvider);
      return ref
          .read(marketplaceRepositoryProvider)
          .getById(
            atelierId,
            latitude: location.latitude,
            longitude: location.longitude,
          );
    });

/// Les mises en avant de l'accueil client.
final marketplacePromotionsProvider =
    FutureProvider<List<MarketplacePromotion>>((ref) {
      return ref.read(marketplaceRepositoryProvider).promotions();
    });

final marketplaceContactsProvider = FutureProvider<List<MarketplaceContact>>((
  ref,
) {
  return ref.read(marketplaceRepositoryProvider).listContacts();
});

/// Le classement, par périmètre (§2.4).
final marketplaceRankingProvider =
    FutureProvider.family<List<RankedAtelier>, RankingScope>((ref, scope) {
      return ref.read(marketplaceRepositoryProvider).ranking(scope);
    });
