import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:crm_api_client/crm_api_client.dart';

/// Un serveur de synchronisation en mémoire, écrit contre l'[ApiPort] **tel
/// qu'il existe aujourd'hui**.
///
/// Ce n'est pas un `Mockito` : le point des tests du moteur n'est pas de
/// vérifier qu'une méthode a été appelée, c'est de vérifier ce qu'il advient des
/// lignes quand un serveur répond quelque chose de précis. Le faux serveur tient
/// donc un vrai registre :
///
/// * [rows] : les entités « écrites » côté serveur. C'est ce qu'on compte pour
///   savoir si un rejeu a produit un doublon ;
/// * le registre d'idempotence par `opId` : un `opId` déjà appliqué revient en
///   `duplicate` sans créer de seconde ligne, exactement comme le serveur réel ;
/// * [calls] : chaque lot reçu, dans l'ordre, avec son `batchId` et sa version
///   de payload.
class FakeApi implements ApiPort {
  FakeApi({this.userId = 'me'});

  /// Identifiant du commercial connecté côté serveur.
  final String userId;

  /// Chaque appel à [push], dans l'ordre de réception.
  final List<PushCall> calls = <PushCall>[];
  final List<String> uploadedRecordings = <String>[];
  ApiException? failNextRecordingUpload;

  /// Les entités effectivement créées côté serveur, par identifiant.
  final Map<String, SyncOperationDto> rows = <String, SyncOperationDto>{};

  /// Registre d'idempotence : `opId` → verdict déjà rendu.
  final Map<String, SyncOperationResultDto> ledger =
      <String, SyncOperationResultDto>{};

  /// Verdicts forcés, par `opId`. Consommés à la première utilisation quand
  /// [verdictsAreOneShot], sinon persistants.
  final Map<String, SyncOperationResultDto> verdicts =
      <String, SyncOperationResultDto>{};

  bool verdictsAreOneShot = false;

  /// Erreur de transport à lever au prochain [push].
  ApiException? failNextPush;

  /// Enregistrer le lot **puis** échouer : la réponse s'est perdue au retour.
  /// C'est le seul scénario qui produit un doublon si l'idempotence est cassée.
  bool loseNextResponse = false;

  /// Réponse du lookup téléphone. `null` ⇒ « inconnu ».
  RepresentantLookup Function(String phone)? onLookup;
  final List<String> lookups = <String>[];

  /// Pages de pull à servir, dans l'ordre.
  final List<PullPage> pullPages = <PullPage>[];

  DateTime serverTime = DateTime.utc(2026, 8, 12, 12);

  /// Tous les `opId` reçus, tous lots confondus (doublons compris).
  List<String> get receivedOpIds => <String>[
    for (final PushCall c in calls)
      for (final SyncOperationDto o in c.operations) o.opId,
  ];

  @override
  Future<AuthTokens> login({
    required String identifier,
    required String password,
  }) async => AuthTokens(
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: serverTime.add(const Duration(minutes: 15)),
    userId: userId,
    fullName: identifier,
  );

  @override
  Future<AuthTokens> refresh({required String refreshToken}) async =>
      AuthTokens(
        accessToken: 'access',
        refreshToken: refreshToken,
        expiresAt: serverTime.add(const Duration(minutes: 15)),
        userId: userId,
        fullName: 'Commercial',
      );

  @override
  Future<void> logout({required String refreshToken}) async {}

  @override
  Future<PullPage> pull({String? cursor, int limit = 200}) async {
    if (pullPages.isEmpty) return emptyPullPage(cursor: cursor);
    return pullPages.removeAt(0);
  }

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) async {
    lookups.add(phone);
    final RepresentantLookup Function(String)? handler = onLookup;
    if (handler == null) {
      return RepresentantLookup(found: false, phoneE164: phone);
    }
    return handler(phone);
  }

  /// Pages d'annuaire de phase 2 à servir, dans l'ordre.
  final List<Phase2DirectoryPage> directoryPages = <Phase2DirectoryPage>[];

  /// Chaque appel à [pullPhase2Directory], avec le curseur reçu.
  final List<({String? cursor, int limit})> directoryCalls =
      <({String? cursor, int limit})>[];

  /// Erreur de transport à lever au prochain [pullPhase2Directory].
  ApiException? failNextDirectoryPull;

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) async {
    directoryCalls.add((cursor: cursor, limit: limit));
    final ApiException? boom = failNextDirectoryPull;
    if (boom != null) {
      failNextDirectoryPull = null;
      throw boom;
    }
    if (directoryPages.isEmpty) {
      return Phase2DirectoryPage(
        entries: const <Phase2DirectoryEntry>[],
        nextCursor: cursor ?? '',
        hasMore: false,
        serverTime: serverTime,
      );
    }
    return directoryPages.removeAt(0);
  }

  /// Le référentiel des motifs d'issue à servir. Vide par défaut : la plupart
  /// des tests n'ont que faire des motifs, et le repli système suffit.
  final List<CallOutcomeReasonDto> callOutcomeReasons =
      <CallOutcomeReasonDto>[];

  /// Chaque appel à [pullCallOutcomeReasons], avec la version reçue.
  final List<int> reasonCalls = <int>[];

  ApiException? failNextReasonsPull;

  @override
  Future<List<CallOutcomeReasonDto>> pullCallOutcomeReasons({
    required int payloadVersion,
  }) async {
    reasonCalls.add(payloadVersion);
    final ApiException? boom = failNextReasonsPull;
    if (boom != null) {
      failNextReasonsPull = null;
      throw boom;
    }
    return callOutcomeReasons;
  }

  @override
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  }) async {
    calls.add(
      PushCall(
        batchId: batchId,
        payloadVersion: payloadVersion,
        operations: List<SyncOperationDto>.unmodifiable(operations),
      ),
    );

    final ApiException? boom = failNextPush;
    if (boom != null && !loseNextResponse) {
      failNextPush = null;
      throw boom;
    }

    final List<SyncOperationResultDto> results = <SyncOperationResultDto>[];
    for (final SyncOperationDto op in operations) {
      results.add(_apply(op));
    }

    if (loseNextResponse) {
      loseNextResponse = false;
      // Le lot EST appliqué côté serveur ; c'est la réponse qui n'arrive pas.
      throw boom ?? const ApiException('network_timeout', statusCode: 504);
    }

    return PushResult(
      batchId: batchId,
      results: results,
      serverTime: serverTime,
    );
  }

  @override
  Future<void> uploadCallRecording({
    required String attemptId,
    required String path,
  }) async {
    final ApiException? failure = failNextRecordingUpload;
    failNextRecordingUpload = null;
    if (failure != null) throw failure;
    uploadedRecordings.add(attemptId);
  }

  SyncOperationResultDto _apply(SyncOperationDto op) {
    // Idempotence par `opId` : un identifiant d'opération déjà vu ne crée jamais
    // une seconde ligne, il rejoue le verdict.
    final SyncOperationResultDto? seen = ledger[op.opId];
    if (seen != null) {
      return SyncOperationResultDto(
        opId: op.opId,
        status: SyncOpStatus.duplicate,
        entityId: seen.entityId,
        rev: seen.rev,
        serverUpdatedAt: seen.serverUpdatedAt,
        errorCode: null,
        error: null,
      );
    }

    final SyncOperationResultDto? forced = verdicts[op.opId];
    if (forced != null) {
      if (verdictsAreOneShot) verdicts.remove(op.opId);
      // Un verdict forcé négatif n'écrit rien côté serveur.
      if (forced.status == SyncOpStatus.applied ||
          forced.status == SyncOpStatus.duplicate) {
        rows[forced.entityId ?? op.entityId] = op;
        ledger[op.opId] = forced;
      }
      return forced;
    }

    final SyncOperationResultDto ok = SyncOperationResultDto(
      opId: op.opId,
      status: SyncOpStatus.applied,
      entityId: op.entityId,
      rev: 1,
      serverUpdatedAt: serverTime,
      errorCode: null,
      error: null,
    );
    if (op.op == SyncOp.delete) {
      rows.remove(op.entityId);
    } else {
      rows[op.entityId] = op;
    }
    ledger[op.opId] = ok;
    return ok;
  }
}

/// Une page d'annuaire prête à l'emploi.
Phase2DirectoryPage directoryPage({
  required List<Phase2DirectoryEntry> entries,
  String nextCursor = 'cursor-1',
  bool hasMore = false,
}) => Phase2DirectoryPage(
  entries: entries,
  nextCursor: nextCursor,
  hasMore: hasMore,
  serverTime: DateTime.utc(2026, 8, 12, 12),
);

/// Une entrée d'annuaire prête à l'emploi.
Phase2DirectoryEntry directoryEntry({
  required String prospectId,
  required String phoneE164,
  String phase2Status = 'PENDING',
  String? enrollmentMethod,
  int rev = 1,
  DateTime? updatedAt,
}) => Phase2DirectoryEntry(
  prospectId: prospectId,
  phoneE164: phoneE164,
  phase2Status: phase2Status,
  enrollmentMethod: enrollmentMethod,
  rev: rev,
  updatedAt: updatedAt ?? DateTime.utc(2026, 8, 10),
);

class PushCall {
  const PushCall({
    required this.batchId,
    required this.payloadVersion,
    required this.operations,
  });

  final String batchId;
  final int payloadVersion;
  final List<SyncOperationDto> operations;

  List<String> get opIds =>
      operations.map((SyncOperationDto o) => o.opId).toList(growable: false);

  List<String> get entityIds => operations
      .map((SyncOperationDto o) => o.entityId)
      .toList(growable: false);
}

PullPage emptyPullPage({String? cursor}) => PullPage(
  changes: SyncChangesDto(
    departements: const <DepartementDto>[],
    iefs: const <IefDto>[],
    banques: const <BanqueDto>[],
    syndicats: const <SyndicatDto>[],
    representants: const <RepresentantDto>[],
    prospects: const <ProspectDto>[],
  ),
  deletions: const <SyncDeletionDto>[],
  nextCursor: cursor ?? '',
  hasMore: false,
  serverTime: DateTime.utc(2026, 8, 12, 12),
);

/// Verdict `conflict` prêt à l'emploi.
SyncOperationResultDto conflictOn(
  String opId, {
  String errorCode = ServerErrorCodes.representantPhoneConflict,
  String message = 'Ce numéro est déjà enregistré.',
}) => SyncOperationResultDto(
  opId: opId,
  status: SyncOpStatus.conflict,
  entityId: null,
  rev: null,
  serverUpdatedAt: null,
  errorCode: errorCode,
  error: message,
);

/// Verdict `invalid` : refus définitif.
SyncOperationResultDto invalidOn(
  String opId, {
  String errorCode = 'VALIDATION_FAILED',
  String message = 'Champ manquant.',
}) => SyncOperationResultDto(
  opId: opId,
  status: SyncOpStatus.invalid,
  entityId: null,
  rev: null,
  serverUpdatedAt: null,
  errorCode: errorCode,
  error: message,
);

/// Fiche serveur minimale, pour les réponses de lookup.
RepresentantDto representantDto({
  required String id,
  required String phoneE164,
  String fullName = 'Représentant serveur',
  String departementId = 'dep-1',
  String? iefId,
  String? iefName,
  String createdById = 'me',
  int rev = 3,
  RepresentantRelation relationStatus = RepresentantRelation.INCONNU,
  WhatsappStatus whatsappStatus = WhatsappStatus.NON_DEMANDE,
  String? whatsappE164,
  String? profession,
}) => RepresentantDto(
  id: id,
  fullName: fullName,
  phoneE164: phoneE164,
  notes: null,
  relationStatus: relationStatus,
  whatsappStatus: whatsappStatus,
  whatsappE164: whatsappE164,
  // Calcule par le SERVEUR: la fabrique reproduit sa regle plutot que d'en
  // inventer une autre.
  whatsappNumber: whatsappStatus == WhatsappStatus.MEME_NUMERO
      ? phoneE164
      : whatsappStatus == WhatsappStatus.AUTRE_NUMERO
      ? whatsappE164
      : null,
  profession: profession,
  rev: rev,
  departementId: departementId,
  iefId: iefId,
  iefName: iefName,
  departementName: 'Dakar',
  createdById: createdById,
  createdByName: 'Awa Sy',
  clientCreatedAt: DateTime.utc(2026, 8, 1),
  createdAt: DateTime.utc(2026, 8, 1),
  updatedAt: DateTime.utc(2026, 8, 10),
  prospectCount: 0,
);

/// Toute méthode réseau appelée fait échouer le test : c'est ainsi qu'on
/// vérifie qu'un chemin ne touche PAS au réseau.
class ExplodingApi implements ApiPort {
  const ExplodingApi();

  Never _boom() => throw StateError('le réseau ne devait pas être sollicité');

  @override
  Future<AuthTokens> login({
    required String identifier,
    required String password,
  }) => _boom();

  @override
  Future<AuthTokens> refresh({required String refreshToken}) => _boom();

  @override
  Future<void> logout({required String refreshToken}) => _boom();

  @override
  Future<PullPage> pull({String? cursor, int limit = 200}) => _boom();

  @override
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  }) => _boom();

  @override
  Future<Phase2DirectoryPage> pullPhase2Directory({
    String? cursor,
    int limit = 2000,
  }) => _boom();

  @override
  Future<List<CallOutcomeReasonDto>> pullCallOutcomeReasons({
    required int payloadVersion,
  }) => _boom();

  @override
  Future<RepresentantLookup> lookupRepresentantByPhone(String phone) => _boom();

  @override
  Future<void> uploadCallRecording({
    required String attemptId,
    required String path,
  }) async {
    throw const ApiException('exploded');
  }
}

/// Statut d'une ligne d'outbox, pour des assertions lisibles.
const List<String> allOutboxStatuses = <String>[
  OutboxStatus.pending,
  OutboxStatus.syncing,
  OutboxStatus.done,
  OutboxStatus.conflict,
  OutboxStatus.failed,
];
