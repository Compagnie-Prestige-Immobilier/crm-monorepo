import 'dart:io';

import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/operations_models.dart';

/// Reads for the atelier space.
///
/// **Writes deliberately do not live here.** Atelier-private data travels over
/// `POST /sync/.../push`, which carries the version, resolves conflicts
/// explicitly and never overwrites silently — the guarantee `PRD.md` requires.
/// This class previously also exposed `upsertClient`, `upsertInventory`,
/// `createOrder`, `updateOrderStatus` and `recordPayment`, none of which had a
/// single caller: every screen wrote to local Isar instead. They were a second
/// write path to the same tables, with none of sync's conflict handling, kept
/// alive only by never being used.
///
/// Sync currently carries `client` and `inventory_item`. Orders, payments,
/// measurements and beneficiaries are still device-only; adding them is a
/// change to `SyncService`, not a new REST surface. `change_log.entity_type`
/// is plain text with no constraint, so that extension needs no migration.
class OperationsRepository {
  const OperationsRepository(this._api);

  final ApiClient _api;

  Future<List<RemoteAtelier>> listAteliers() async {
    final response = await _api.get<List<dynamic>>('/operations/ateliers');
    return response
        .whereType<Map>()
        .map((item) => RemoteAtelier.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<String> createAtelier({
    required String name,
    required String phone,
    String? address,
    String? region,
    double? latitude,
    double? longitude,
    List<String> specialties = const [],
    String? tiktokUrl,
    String? instagramUrl,
    String? facebookUrl,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/operations/ateliers',
      data: {
        'name': name.trim(),
        'phone': phone.trim(),
        if ((address ?? '').trim().isNotEmpty) 'address': address!.trim(),
        if ((region ?? '').trim().isNotEmpty) 'region': region!.trim(),
        'latitude': ?latitude,
        'longitude': ?longitude,
        'specialties': specialties,
        // Facultatifs : un champ laissé vide ne doit pas publier un lien mort.
        if ((tiktokUrl ?? '').trim().isNotEmpty) 'tiktokUrl': tiktokUrl!.trim(),
        if ((instagramUrl ?? '').trim().isNotEmpty)
          'instagramUrl': instagramUrl!.trim(),
        if ((facebookUrl ?? '').trim().isNotEmpty)
          'facebookUrl': facebookUrl!.trim(),
      },
    );
    return response['id'] as String;
  }

  /// Corrects the published profile, including the position.
  ///
  /// Creation was the only write the API offered, so an atelier created before
  /// the wizard asked for a zone carries a null `location` — which the
  /// marketplace filters out of every search — and had no way back.
  Future<void> updateAtelier(
    String atelierId, {
    String? name,
    String? phone,
    String? address,
    String? region,
    double? latitude,
    double? longitude,
    List<String>? specialties,
    String? tiktokUrl,
    String? instagramUrl,
    String? facebookUrl,
  }) async {
    await _api.patch<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId',
      data: {
        if (name != null) 'name': name.trim(),
        if (phone != null) 'phone': phone.trim(),
        if (address != null) 'address': address.trim(),
        if (region != null) 'region': region.trim(),
        'latitude': ?latitude,
        'longitude': ?longitude,
        'specialties': ?specialties,
        // Une chaîne vide retire le lien ; l'absence le laisse tel quel.
        if (tiktokUrl != null) 'tiktokUrl': tiktokUrl.trim(),
        if (instagramUrl != null) 'instagramUrl': instagramUrl.trim(),
        if (facebookUrl != null) 'facebookUrl': facebookUrl.trim(),
      },
    );
  }

  /// Téléverse une image publique de l'atelier et renvoie son URL.
  ///
  /// `logo_url`, `cover_url` et le portfolio existaient en base sans qu'aucun
  /// écran ne puisse les remplir : toute fiche créée depuis l'application
  /// s'ouvrait sur un cadre gris. [kind] vaut `logo`, `cover` ou `portfolio`.
  Future<String> uploadAtelierMedia({
    required String atelierId,
    required String filePath,
    required String kind,
  }) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw ArgumentError.value(filePath, 'filePath', 'Fichier introuvable');
    }
    final response = await _api.post<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/media',
      data: FormData.fromMap({
        'kind': kind,
        'file': await MultipartFile.fromFile(
          filePath,
          contentType: _mediaTypeFor(filePath),
        ),
      }),
    );
    return response['url'] as String;
  }

  /// Le serveur compare le type déclaré aux premiers octets du fichier et
  /// refuse les deux quand ils divergent ; l'extension est donc la seule source
  /// honnête dont dispose l'application.
  static DioMediaType _mediaTypeFor(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.png')) return DioMediaType('image', 'png');
    if (lower.endsWith('.webp')) return DioMediaType('image', 'webp');
    return DioMediaType('image', 'jpeg');
  }

  /// Submits the atelier to the platform verification queue.
  ///
  /// Creating an atelier is not publishing it: the marketplace only lists rows
  /// whose status is `verified`, and that status is only reachable through an
  /// administrator's decision on a pending `atelier_verifications` row. Nothing
  /// used to create one, so every atelier created from this app stayed at
  /// `draft` — invisible in search, absent from the back-office queue, and
  /// therefore impossible for a client to find or contact.
  Future<String> submitVerification({
    required String atelierId,
    required String idDocumentRef,
    Map<String, dynamic> checklist = const {},
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/verification',
      data: {
        'idDocumentRef': idDocumentRef.trim(),
        if (checklist.isNotEmpty) 'checklist': checklist,
      },
    );
    return response['status'] as String? ?? 'pending_review';
  }

  /// Recopie une commande locale sur le serveur.
  ///
  /// Écriture volontairement hors du protocole de synchronisation : la commande
  /// reste locale et fait autorité sur l'appareil ; cette copie n'existe que
  /// pour le fil partagé entre ateliers, et un échec ne doit rien bloquer.
  Future<String> createOrder({
    required String atelierId,
    required String clientId,
    required String reference,
    required int totalCfa,
    required List<({String garmentType, int unitPriceCfa})> items,
    DateTime? dueAt,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/orders',
      data: {
        'clientId': clientId,
        'reference': reference,
        'totalCfa': totalCfa,
        if (dueAt != null) 'dueAt': dueAt.toUtc().toIso8601String(),
        'items': [
          for (final item in items)
            {
              'garmentType': item.garmentType,
              'unitPriceCfa': item.unitPriceCfa,
            },
        ],
      },
    );
    return response['id'] as String;
  }

  /// Les commandes de tous les ateliers, sans les données de leurs clients.
  Future<RemotePage<SharedOrder>> listSharedOrders({
    int limit = 30,
    int offset = 0,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/operations/orders/shared',
      queryParameters: {'limit': limit, 'offset': offset},
    );
    return RemotePage.fromJson(response, SharedOrder.fromJson);
  }

  /// The client requests this atelier has received from the marketplace.
  Future<RemotePage<RemoteAtelierContact>> listContacts(
    String atelierId, {
    int limit = 20,
    int offset = 0,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/contacts',
      queryParameters: {'limit': limit, 'offset': offset},
    );
    return RemotePage.fromJson(response, RemoteAtelierContact.fromJson);
  }

  Future<OperationsDashboardSummary> dashboard(String atelierId) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/dashboard',
    );
    return OperationsDashboardSummary.fromJson(response);
  }

  Future<RemotePage<RemoteClient>> listClients(
    String atelierId, {
    String? query,
    int limit = 30,
    int offset = 0,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/clients',
      queryParameters: {
        if ((query ?? '').trim().isNotEmpty) 'q': query!.trim(),
        'limit': limit,
        'offset': offset,
      },
    );
    return RemotePage.fromJson(response, RemoteClient.fromJson);
  }

  Future<RemotePage<RemoteOrder>> listOrders(
    String atelierId, {
    String? query,
    String? status,
    int limit = 30,
    int offset = 0,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/orders',
      queryParameters: {
        if ((query ?? '').trim().isNotEmpty) 'q': query!.trim(),
        if ((status ?? '').trim().isNotEmpty) 'status': status!.trim(),
        'limit': limit,
        'offset': offset,
      },
    );
    return RemotePage.fromJson(response, RemoteOrder.fromJson);
  }

  Future<RemotePage<RemoteInventoryItem>> listInventory(
    String atelierId, {
    String? query,
    int limit = 30,
    int offset = 0,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/operations/ateliers/$atelierId/inventory',
      queryParameters: {
        if ((query ?? '').trim().isNotEmpty) 'q': query!.trim(),
        'limit': limit,
        'offset': offset,
      },
    );
    return RemotePage.fromJson(response, RemoteInventoryItem.fromJson);
  }
}
