import '../../../../core/network/api_client.dart';
import '../../activity/domain/marketplace_contact.dart';
import '../../ranking/domain/ranked_atelier.dart';
import '../domain/marketplace_atelier.dart';

class MarketplaceRepository {
  const MarketplaceRepository(this._api);

  final ApiClient _api;

  Future<List<MarketplaceAtelier>> search(MarketplaceSearchQuery query) async {
    final response = await _api.get<List<dynamic>>(
      '/marketplace/ateliers',
      requiresAuth: false,
      queryParameters: {
        // Omises quand l'utilisateur n'a pas partagé sa position : le serveur
        // renvoie alors des résultats sans distance, plutôt que mesurés depuis
        // un point inventé.
        'latitude': ?query.latitude,
        'longitude': ?query.longitude,
        // Omis quand aucun rayon n'est demandé : le serveur cherche alors
        // partout, au lieu de couper les résultats sur une distance que
        // l'utilisateur n'a pas choisie.
        'radius': ?query.radiusMeters,
        'limit': query.limit,
        'offset': query.offset,
        if ((query.text ?? '').trim().isNotEmpty) 'q': query.text!.trim(),
        if ((query.region ?? '').trim().isNotEmpty)
          'region': query.region!.trim(),
        if ((query.specialty ?? '').trim().isNotEmpty)
          'specialty': query.specialty!.trim(),
      },
    );
    return response
        .whereType<Map>()
        .map(
          (item) =>
              MarketplaceAtelier.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
  }

  /// One atelier's public profile.
  ///
  /// The caller's position travels with the request so the detail screen can
  /// state a distance. Without it the profile answered `distanceMeters: null`
  /// and the screen printed "Distance indisponible" immediately after a result
  /// card had shown "951 m" for that same atelier.
  /// Les mises en avant de l'accueil. Publiques, comme la recherche.
  Future<List<MarketplacePromotion>> promotions() async {
    final response = await _api.get<List<dynamic>>(
      '/marketplace/promotions',
      requiresAuth: false,
    );
    return response
        .whereType<Map>()
        .map(
          (item) =>
              MarketplacePromotion.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
  }

  /// Le classement (§2.4), general ou restreint a une zone.
  Future<List<RankedAtelier>> ranking(RankingScope scope) async {
    final response = await _api.get<List<dynamic>>(
      '/marketplace/ranking',
      requiresAuth: false,
      queryParameters: {
        'latitude': ?scope.latitude,
        'longitude': ?scope.longitude,
        'radius': ?scope.radiusMeters,
      },
    );
    return response
        .whereType<Map>()
        .map((item) => RankedAtelier.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<MarketplaceAtelier> getById(
    String atelierId, {
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/marketplace/ateliers/$atelierId',
      requiresAuth: false,
      queryParameters: {'latitude': ?latitude, 'longitude': ?longitude},
    );
    return MarketplaceAtelier.fromJson(response);
  }

  Future<List<MarketplaceContact>> listContacts({
    int limit = 30,
    int offset = 0,
  }) async {
    final response = await _api.get<List<dynamic>>(
      '/marketplace/contacts',
      queryParameters: {'limit': limit, 'offset': offset},
    );
    return response
        .whereType<Map>()
        .map(
          (item) =>
              MarketplaceContact.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
  }

  Future<String> createContact({
    required String atelierId,
    required String channel,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/marketplace/ateliers/$atelierId/contacts',
      data: {'channel': channel},
    );
    return response['contactId'] as String;
  }

  /// Confirms how a contact turned out.
  ///
  /// `POST /marketplace/contacts/:id/confirm` existed on the server and was
  /// called by nothing, so `MarketplaceContact.status` could describe
  /// `accepted`, `completed` and `disputed` while the app had no way to reach
  /// any of them — which also meant `canReview` (completed and not yet
  /// reviewed) could never become true.
  Future<void> confirmContact({
    required String contactId,
    required String status,
  }) async {
    await _api.post<void>(
      '/marketplace/contacts/$contactId/confirm',
      data: {'status': status},
    );
  }

  /// Leaves a review for an atelier.
  ///
  /// Exactly one of [contactId] or [atelierId] must be set — the two are
  /// mutually exclusive review paths on the API side (migration 0009):
  /// [contactId] for a bilateral-confirmed completed service, [atelierId]
  /// for a client rating an atelier just from having visited its profile.
  Future<void> createReview({
    String? contactId,
    String? atelierId,
    required int rating,
    String? body,
  }) async {
    assert(
      (contactId == null) != (atelierId == null),
      'Provide exactly one of contactId or atelierId',
    );
    await _api.post<void>(
      '/marketplace/reviews',
      data: {
        if (contactId != null) 'contactId': contactId,
        if (atelierId != null) 'atelierId': atelierId,
        'rating': rating,
        if ((body ?? '').trim().isNotEmpty) 'body': body!.trim(),
      },
    );
  }
}
