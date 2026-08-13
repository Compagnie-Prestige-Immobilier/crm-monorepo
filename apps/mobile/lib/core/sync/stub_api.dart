import 'package:crm_api_client/crm_api_client.dart';

import 'api_port.dart';

/// [ApiPort] hors ligne, pour les tests de widgets et les captures d'écran.
///
/// Le transport réel est `DioApi`, adossé au client généré. Cette
/// implémentation-ci n'est **pas** un simulateur de serveur : elle échoue
/// explicitement sur tout ce qu'elle ne peut pas honnêtement rendre, pour qu'un
/// oubli de câblage se voie tout de suite au lieu de produire une app qui a
/// l'air de marcher.
class StubApi implements ApiPort {
  const StubApi();

  static const String _marker = 'stub';

  @override
  Future<AuthTokens> login({required String identifier, required String password}) async {
    if (identifier.trim().isEmpty || password.isEmpty) {
      throw const ApiException(
        'invalid_credentials',
        message: 'Identifiant ou mot de passe manquant.',
        statusCode: 400,
        kind: FailureKind.terminal,
      );
    }
    final DateTime now = DateTime.now().toUtc();
    return AuthTokens(
      accessToken: '$_marker.access.${now.millisecondsSinceEpoch}',
      refreshToken: '$_marker.refresh.${now.millisecondsSinceEpoch}',
      expiresAt: now.add(const Duration(minutes: 15)),
      userId: '00000000-0000-7000-8000-000000000001',
      fullName: identifier.trim(),
    );
  }

  @override
  Future<AuthTokens> refresh({required String refreshToken}) async {
    final DateTime now = DateTime.now().toUtc();
    return AuthTokens(
      accessToken: '$_marker.access.${now.millisecondsSinceEpoch}',
      refreshToken: refreshToken,
      expiresAt: now.add(const Duration(minutes: 15)),
      userId: '00000000-0000-7000-8000-000000000001',
      fullName: 'Commercial',
    );
  }

  @override
  Future<void> logout({required String refreshToken}) async {}

  @override
  Future<PullPage> pull({String? cursor, int limit = 200}) async {
    // Une page vide et `hasMore = false` est le seul comportement qui ne mente
    // pas au moteur quand il n'y a pas de serveur.
    return PullPage(
      changes: SyncChangesDto(
        departements: const <DepartementDto>[],
        banques: const <BanqueDto>[],
        syndicats: const <SyndicatDto>[],
        representants: const <RepresentantDto>[],
        prospects: const <ProspectDto>[],
      ),
      deletions: const <SyncDeletionDto>[],
      nextCursor: cursor ?? '',
      hasMore: false,
      serverTime: DateTime.now().toUtc(),
    );
  }

  @override
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  }) async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : ce transport ne pousse rien.',
      kind: FailureKind.retryable,
    );
  }

  @override
  Future<PushResult> pushRaw({
    required String batchId,
    required int payloadVersion,
    required List<Map<String, Object?>> operations,
  }) async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : ce transport ne pousse rien.',
      kind: FailureKind.retryable,
    );
  }

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) async {
    // Page vide et `hasMore = false` : le seul comportement qui ne mente pas au
    // client quand il n'y a pas de serveur. Renvoyer `hasMore = true` le ferait
    // boucler 300 fois pour rien.
    return Phase2DirectoryPage(
      entries: const <Phase2DirectoryEntry>[],
      nextCursor: cursor ?? '',
      hasMore: false,
      serverTime: DateTime.now().toUtc(),
    );
  }

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    return RepresentantLookup(found: false, phoneE164: phone);
  }
}
