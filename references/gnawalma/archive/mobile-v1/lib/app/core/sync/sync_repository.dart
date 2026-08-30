import '../network/api_client.dart';
import 'sync_models.dart';

class SyncRepository {
  const SyncRepository(this._api);

  final ApiClient _api;

  Future<List<SyncPushResult>> push({
    required String atelierId,
    required String deviceId,
    required List<SyncOperation> operations,
  }) async {
    final response = await _api.post<Map<String, dynamic>>(
      '/sync/ateliers/$atelierId/push',
      data: {
        'deviceId': deviceId,
        'operations': operations
            .map((operation) => operation.toApiJson())
            .toList(growable: false),
      },
    );
    final rawResults = response['results'];
    return rawResults is List
        ? rawResults
              .whereType<Map>()
              .map(
                (item) =>
                    SyncPushResult.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList(growable: false)
        : const [];
  }

  Future<SyncPullPage> pull({
    required String atelierId,
    required String deviceId,
    required int after,
    int limit = 100,
  }) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/sync/ateliers/$atelierId/pull',
      queryParameters: {'deviceId': deviceId, 'after': after, 'limit': limit},
    );
    return SyncPullPage.fromJson(response);
  }
}
