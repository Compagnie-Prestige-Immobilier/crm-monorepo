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
  Future<void> changeMyPassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : le mot de passe ne peut pas changer.',
      kind: FailureKind.retryable,
    );
  }

  @override
  Future<PullPage> pull({
    String? cursor,
    int limit = 200,
    required int payloadVersion,
  }) async {
    return PullPage(
      changes: SyncChangesDto(
        departements: const <DepartementDto>[],
        iefs: const <IefDto>[],
        banques: const <BanqueDto>[],
        syndicats: const <SyndicatDto>[],
        canauxProvenance: const <CanalProvenanceDto>[],
        incomeBands: const <IncomeBandDto>[],
        professions: const <ProfessionDto>[],
        employeurs: const <EmployeurDto>[],
        pays: const <PaysDto>[],
        visiteReferentiels: const <SyncVisiteReferentielDto>[],
        representants: const <RepresentantDto>[],
        prospects: const <ProspectDto>[],
        visites: const <SyncVisiteDto>[],
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
  Future<RepCallAttemptResultDto> recordRepCallAttempt(
    CreateRepCallAttemptDto attempt,
  ) async {
    throw const ApiException('api_not_configured', kind: FailureKind.retryable);
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
  Future<List<StatutQualificationDto>> pullStatutsQualification({
    required int payloadVersion,
  }) async => const <StatutQualificationDto>[];

  /// Même raison que [pullVisiteReferentiels] : un refus, jamais des listes
  /// vides.
  @override
  Future<ReferentielsSnapshot> pullReferentiels() async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : les référentiels ne sont pas relus.',
      kind: FailureKind.retryable,
    );
  }

  /// Même raison que [pullReferentiels] : un refus, jamais un périmètre vide,
  /// que le miroir prendrait pour la vérité du serveur.
  @override
  Future<MesAttributionsDto> pullMesAttributions() async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : le périmètre n\'est pas relu.',
      kind: FailureKind.retryable,
    );
  }

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    return RepresentantLookup(found: false, phoneE164: phone);
  }

  /// Surtout pas des listes vides : le miroir les prendrait pour la vérité du
  /// serveur et effacerait celles du téléphone.
  @override
  Future<VisiteReferentielsBundleDto> pullVisiteReferentiels() async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : les listes ne sont pas relues.',
      kind: FailureKind.retryable,
    );
  }

  @override
  Future<void> updateVisite({
    required String id,
    required String visitorName,
    required String entrepriseId,
    required String objetId,
    String? phone,
    String? directionId,
    String? destinataireId,
    String? comment,
  }) async {
    throw const ApiException(
      'api_not_configured',
      message: 'Aucun serveur configuré : la correction ne part pas.',
      kind: FailureKind.retryable,
    );
  }
}
