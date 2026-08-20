import 'package:crm_api_client/crm_api_client.dart';

import 'api_port.dart';

class StubApi implements ApiPort {
  const StubApi();

  static const String _marker = 'stub';

  @override
  Future<AuthTokens> login({
    required String identifier,
    required String password,
  }) async {
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
    return PullPage(
      changes: SyncChangesDto(
        departements: const <DepartementDto>[],
        iefs: const <IefDto>[],
        banques: const <BanqueDto>[],
        syndicats: const <SyndicatDto>[],
        representants: const <RepresentantDto>[],
        prospects: const <ProspectDto>[],
        callCampaigns: const <SyncCallCampaignDto>[],
        callTasks: const <SyncCallTaskDto>[],
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
  Future<void> uploadCallRecording({
    required String attemptId,
    required String path,
  }) async {
    throw const ApiException('api_not_configured', kind: FailureKind.retryable);
  }

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) async {
    return Phase2DirectoryPage(
      entries: const <Phase2DirectoryEntry>[],
      nextCursor: cursor ?? '',
      hasMore: false,
      serverTime: DateTime.now().toUtc(),
    );
  }

  @override
  Future<List<CallOutcomeReasonDto>> pullCallOutcomeReasons({
    required int payloadVersion,
  }) async => const <CallOutcomeReasonDto>[];

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    return RepresentantLookup(found: false, phoneE164: phone);
  }
}
