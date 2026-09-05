import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import '../../data/repositories/visites_repository.dart';
import '../utils/ids.dart';
import 'api_port.dart';
import 'backoff.dart';
import 'clock.dart';
import 'outbox_status.dart';
import 'phase2_directory_sync.dart'
    show
        CallEffects,
        CallReason,
        EnrollmentMethods,
        callAttemptEntity,
        loadCallReasons;
import 'token_store.dart';

const String repCallAttemptEntity = 'rep_call_attempt';

/// L'ouverture d'une fiche. Route REST dédiée et non `SyncEntity` : le verrou
/// se joue sur un index unique, et une violation d'unicité dans la transaction
/// de groupe annulerait les autres opérations du même représentant.
const String ouvertureEntity = 'ouverture';

/// Les entités poussées par une route dédiée. Un lot n'en mêle jamais deux :
/// chacune a son propre envoi, et le lot de synchronisation n'en veut aucune.
const Set<String> routesDediees = <String>{
  repCallAttemptEntity,
  ouvertureEntity,
};

String? _routeDedieeDe(OutboxData row) =>
    routesDediees.contains(row.entityType) ? row.entityType : null;

/// Un appel du journal du téléphone rapproché d'une fiche, que personne n'a
/// consigné. Poussé par la route de synchronisation ordinaire.
const String appelDetecteEntity = 'appel_detecte';

class SyncEngine {
  SyncEngine({
    required AppDatabase database,
    required ApiPort api,
    required TokenStore tokens,
    required Clock clock,
    this.maxBatchOps = 200,
    this.maxBatchBytes = defaultMaxBatchBytes,
    this.maxBatchGroups = 25,
    this.maxAttempts = 8,
    this.maxBlockedAttempts = 12,
    this.blockedFloor = const Duration(seconds: 30),
    this.leaseDuration = const Duration(minutes: 2),
    this.doneRetention = const Duration(days: 7),
    Random? random,
  }) : _db = database,
       _api = api,
       _tokens = tokens,
       _clock = clock,
       _backoff = Backoff(random: random ?? Random());

  final AppDatabase _db;
  final ApiPort _api;
  final TokenStore _tokens;
  final Clock _clock;
  final Backoff _backoff;

  /// v2 : la tentative d'appel porte `reasonCode` en plus d'`outcome`. Le
  /// serveur s'en sert pour ne redescendre à cet appareil que les motifs qu'il
  /// sait émettre.
  /// v3 : les commentaires d'une fiche remontent depuis la file hors ligne.
  /// v4 : les liens banque, syndicat et représentant d'un prospect peuvent
  /// être nuls ; le tirage exige ce numéro en en-tête et refuse en dessous.
  /// v6 : la tentative auprès d'un représentant porte `statutQualificationId`.
  /// v7 : le motif exigé par un statut (`requiresComment`) est lu et imposé
  /// avant l'envoi. Les APK d'avant ne le lisent pas : servis, les deux statuts
  /// « Autre » repartiraient sans motif, le serveur refuserait, et un refus
  /// hors ligne est définitif.
  /// C'est ce nombre que la route dédiée compare au `minPayloadVersion` de
  /// chaque statut ; en dessous, aucun statut ne descend.
  static const int payloadVersion = 7;

  /// Poids qu'un lot peut atteindre sur le fil ; c'est lui que le `sendTimeout`
  /// du profil `push` doit pouvoir émettre sur un lien montant EDGE.
  static const int defaultMaxBatchBytes = 512 * 1024;

  final int maxBatchOps;

  final int maxBatchBytes;

  final int maxBatchGroups;

  final int maxAttempts;

  final int maxBlockedAttempts;

  final Duration blockedFloor;

  final Duration leaseDuration;

  /// Délai avant qu'une ligne acquittée ne quitte la file. Assez long pour
  /// qu'un envoi contesté quelques jours plus tard reste diagnosticable.
  final Duration doneRetention;

  AppDatabase get database => _db;
  ApiPort get api => _api;
  TokenStore get tokens => _tokens;
  Clock get clock => _clock;
  Backoff get backoff => _backoff;

  bool _draining = false;
  bool _pulling = false;

  bool get isDraining => _draining;

  bool get isPulling => _pulling;

  bool get isBusy => _draining || _pulling;

  ApiException? _lastPushFailure;

  ApiException? get lastPushFailure => _lastPushFailure;

  Future<int> pendingCount() => _db.countPendingOutbox().getSingle();

  Stream<int> watchPendingCount() => _db.countPendingOutbox().watchSingle();

  Future<int> schedulableCount() => _db.countSchedulableOutbox().getSingle();

  /// Pousser puis tirer : tirer d'abord écraserait une modification locale non
  /// encore poussée par une version serveur plus ancienne.
  Future<SyncOutcome> runOnce({bool pull = true}) async {
    if (await _tokens.readRefreshToken() == null) {
      return const SyncOutcome.skipped('no_session');
    }
    int pushed = 0;
    try {
      pushed = await drain();
    } on ApiException catch (e) {
      return SyncOutcome.failed(e.code, kind: e.kind, pushed: pushed);
    }
    final ApiException? failure = lastPushFailure;
    if (failure != null) {
      return SyncOutcome.failed(
        failure.code,
        kind: failure.kind,
        pushed: pushed,
      );
    }
    if (!pull) return SyncOutcome.ok(pushed: pushed, pulled: 0);
    try {
      final int pulled = await pullChanges();
      return SyncOutcome.ok(pushed: pushed, pulled: pulled);
    } on ApiException catch (e) {
      return SyncOutcome.failed(e.code, kind: e.kind, pushed: pushed);
    }
  }

  Future<int> drain() async {
    if (_draining) return 0;
    _draining = true;
    _lastPushFailure = null;
    try {
      await purgeAcknowledged();
      int acknowledged = 0;
      for (int round = 0; round < 50; round++) {
        await repairClockDrift();
        await reclaimExpiredLeases();
        final List<OutboxData> batch = await claimBatch();
        if (batch.isEmpty) break;

        if (batch.first.entityType == repCallAttemptEntity) {
          final _SendReport report = await _sendRepCallAttempts(batch);
          acknowledged += report.acknowledged;
          if (!report.keepGoing) break;
          continue;
        }

        if (batch.first.entityType == ouvertureEntity) {
          final _SendReport report = await _sendOuvertures(batch);
          acknowledged += report.acknowledged;
          if (!report.keepGoing) break;
          continue;
        }

        final _PreparedBatch prepared = await _prepare(batch);
        if (prepared.isEmpty) {
          continue;
        }

        final _SendReport report = await _sendBatch(prepared);
        acknowledged += report.acknowledged;
        if (!report.keepGoing) break;
      }
      return acknowledged;
    } finally {
      _draining = false;
    }
  }

  /// Toute écriture d'après-envoi se fenêtre sur `seq` ET `claim_token` : un
  /// isolat dont le bail a expiré pendant l'attente réseau n'écrase plus le
  /// verdict de celui qui a repris la ligne.
  static Expression<bool> _ownedBy(Outbox o, OutboxData row) {
    final String? token = row.claimToken;
    return o.seq.equals(row.seq) &
        (token == null ? o.claimToken.isNull() : o.claimToken.equals(token));
  }

  /// `seq` étant AUTOINCREMENT, l'ordre d'émission survit à la purge : rien de
  /// ce qui reste ouvert ne se réordonne parce qu'une ligne acquittée a disparu.
  Future<int> purgeAcknowledged() async {
    final DateTime floor = _clock.now().subtract(doneRetention);
    return (_db.delete(_db.outbox)..where(
          (Outbox o) =>
              o.status.equals(OutboxStatus.done) &
              o.createdAt.isSmallerThanValue(floor),
        ))
        .go();
  }

  Future<int> reclaimExpiredLeases() async {
    return _db.transaction(() async {
      final DateTime now = _clock.now();
      final List<OutboxData> stale = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.equals(OutboxStatus.syncing))).get();
      final List<OutboxData> expired = stale
          .where(
            (OutboxData o) =>
                o.leaseUntil == null || !o.leaseUntil!.isAfter(now),
          )
          .toList(growable: false);
      if (expired.isEmpty) return 0;

      int reclaimed = 0;
      for (final OutboxData row in expired) {
        reclaimed +=
            await (_db.update(
              _db.outbox,
            )..where((Outbox o) => _ownedBy(o, row))).write(
              const OutboxCompanion(
                status: Value(OutboxStatus.pending),
                leaseUntil: Value<DateTime?>(null),
                claimToken: Value<String?>(null),
              ),
            );
      }
      return reclaimed;
    });
  }

  Future<int> repairClockDrift() async {
    final DateTime now = _clock.now();
    final Duration writable = _backoff.cap > kMaxRetryAfter
        ? _backoff.cap
        : kMaxRetryAfter;
    final DateTime attemptCeiling = now.add(writable);
    final DateTime leaseCeiling = now.add(leaseDuration);

    final int repairedAttempts =
        await (_db.update(_db.outbox)..where(
              (Outbox o) =>
                  o.status.equals(OutboxStatus.pending) &
                  o.nextAttemptAt.isBiggerThanValue(attemptCeiling),
            ))
            .write(OutboxCompanion(nextAttemptAt: Value<DateTime>(now)));

    final int repairedLeases =
        await (_db.update(_db.outbox)..where(
              (Outbox o) =>
                  o.status.equals(OutboxStatus.syncing) &
                  o.leaseUntil.isBiggerThanValue(leaseCeiling),
            ))
            .write(OutboxCompanion(leaseUntil: Value<DateTime?>(now)));

    return repairedAttempts + repairedLeases;
  }

  Future<List<OutboxData>> claimBatch() async {
    return _db.transaction(() async {
      final DateTime now = _clock.now();
      final List<OutboxData> candidates = await selectBatch(now: now);
      if (candidates.isEmpty) return const <OutboxData>[];

      final List<int> seqs = candidates
          .map((OutboxData r) => r.seq)
          .toList(growable: false);
      final DateTime lease = now.add(leaseDuration);
      final String token = Ids.newId();
      final int claimed =
          await (_db.update(_db.outbox)..where(
                (Outbox o) =>
                    o.seq.isIn(seqs) & o.status.equals(OutboxStatus.pending),
              ))
              .write(
                OutboxCompanion(
                  status: const Value(OutboxStatus.syncing),
                  leaseUntil: Value<DateTime?>(lease),
                  claimToken: Value<String?>(token),
                ),
              );
      if (claimed == 0) return const <OutboxData>[];

      return (_db.select(_db.outbox)
            ..where(
              (Outbox o) =>
                  o.seq.isIn(seqs) &
                  o.status.equals(OutboxStatus.syncing) &
                  o.claimToken.equals(token),
            )
            ..orderBy(<OrderClauseGenerator<Outbox>>[
              (Outbox o) => OrderingTerm.asc(o.seq),
            ]))
          .get();
    });
  }

  Future<List<OutboxData>> selectBatch({DateTime? now}) async {
    final DateTime at = now ?? _clock.now();

    final List<OutboxData> open = await _db
        .claimableOutbox(maxRows: 2000)
        .get();

    final Map<String, List<OutboxData>> byKey = <String, List<OutboxData>>{};
    for (final OutboxData row in open) {
      byKey
          .putIfAbsent(
            row.dependencyKey ?? 'op:${row.id}',
            () => <OutboxData>[],
          )
          .add(row);
    }

    final List<OutboxData> batch = <OutboxData>[];
    int bytes = 0;
    final Set<String> serverGroups = <String>{};

    final Set<String> entitiesInBatch = <String>{};

    for (final List<OutboxData> chain in byKey.values) {
      final OutboxData head = chain.first;
      if (head.status != OutboxStatus.pending) continue;
      if (head.nextAttemptAt.isAfter(at)) continue;

      for (final OutboxData row in chain) {
        if (row.status != OutboxStatus.pending) break;
        if (row.nextAttemptAt.isAfter(at)) break;
        if (batch.isNotEmpty &&
            _routeDedieeDe(row) != _routeDedieeDe(batch.first)) {
          return batch;
        }

        final String entity = '${row.entityType}:${row.entityId}';
        if (entitiesInBatch.contains(entity)) break;

        final String group = serverGroupKey(row);
        if (batch.isNotEmpty &&
            !serverGroups.contains(group) &&
            serverGroups.length >= maxBatchGroups) {
          return batch;
        }

        final int size = row.payload.length + 256;
        if (batch.isNotEmpty &&
            (batch.length >= maxBatchOps || bytes + size > maxBatchBytes)) {
          return batch;
        }
        serverGroups.add(group);
        entitiesInBatch.add(entity);
        batch.add(row);
        bytes += size;
      }
    }
    return batch;
  }

  static String serverGroupKey(OutboxData row) {
    if (row.entityType == 'representant') return 'representant:${row.entityId}';
    final Object? decoded = _tryDecode(row.payload);
    final Map<String, Object?>? data = decoded is Map
        ? decoded.cast<String, Object?>()
        : null;
    if (row.entityType == callAttemptEntity) {
      final Object? prospectId = data?['prospectId'];
      return 'prospect:${prospectId is String ? prospectId : row.entityId}';
    }
    final Object? parent = data?['representantId'];
    if (parent is String && parent.isNotEmpty) return 'representant:$parent';
    // Un appel détecté est identifié par sa PREUVE : sans le prospect qu'il
    // vise, il partirait dans une partition à lui et pourrait doubler la
    // tentative du même prospect.
    final Object? prospect = data?['prospectId'];
    if (row.entityType == appelDetecteEntity && prospect is String) {
      return 'prospect:$prospect';
    }
    return 'prospect:${row.entityId}';
  }

  static Object? _tryDecode(String payload) {
    try {
      return jsonDecode(payload);
    } on FormatException {
      return null;
    }
  }

  Future<_PreparedBatch> _prepare(List<OutboxData> rows) async {
    final List<SyncOperationDto> operations = <SyncOperationDto>[];
    final List<OutboxData> accepted = <OutboxData>[];
    final List<OutboxData> undecodable = <OutboxData>[];
    final Map<String, CallReason> reasons = await loadCallReasons(_db);

    for (final OutboxData row in rows) {
      try {
        operations.add(_toOperation(row, reasons));
        accepted.add(row);
      } on Object catch (e) {
        undecodable.add(row);
        await _markFailed(
          row,
          ClientErrorCodes.payloadSchemaMismatch,
          'Cette saisie a été enregistrée par une version antérieure de '
          'l\'application et n\'est plus lisible. ($e)',
        );
      }
    }
    if (undecodable.isNotEmpty && accepted.isEmpty) {
      return _PreparedBatch(
        batchId: Ids.newId(),
        rows: const <OutboxData>[],
        operations: const <SyncOperationDto>[],
      );
    }

    final String batchId = _stableBatchId(accepted);

    await _db.transaction(() async {
      for (final OutboxData row in accepted) {
        await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row)))
            .write(OutboxCompanion(batchId: Value<String?>(batchId)));
      }
    });

    return _PreparedBatch(
      batchId: batchId,
      rows: accepted,
      operations: operations,
    );
  }

  static String _stableBatchId(List<OutboxData> rows) {
    final String? first = rows.first.batchId;
    if (first == null || first.isEmpty) return Ids.newId();
    for (final OutboxData row in rows) {
      if (row.batchId != first) return Ids.newId();
    }
    return first;
  }

  /// Ces entités ne portent NI `rev` NI `server_updated_at` en local : la
  /// réponse du serveur n'a aucune ligne à estampiller, et l'estampiller quand
  /// même toucherait une table qui ne les connaît pas.
  static const Set<String> _sansRevLocale = <String>{
    callAttemptEntity,
    repCallAttemptEntity,
    appelDetecteEntity,
  };

  static SyncEntity _entityOf(String entityType) => switch (entityType) {
    'representant' => SyncEntity.representant,
    'representant_comment' => SyncEntity.representantComment,
    'prospect' => SyncEntity.prospect,
    callAttemptEntity => SyncEntity.callAttempt,
    appelDetecteEntity => SyncEntity.appelDetecte,
    'visite' => SyncEntity.visite,
    _ => throw FormatException('entité inconnue', entityType),
  };

  /// Résout le motif de la tentative et vérifie sa FORME contre l'EFFET de ce
  /// motif, jamais contre son code : c'est ce qui laisse l'équipe du client
  /// ajouter un motif depuis le web sans que le parc ait à être renouvelé.
  static CallReason _resolveCallAttempt(
    Map<String, dynamic> decoded,
    String payload,
    Map<String, CallReason> reasons,
  ) {
    for (final String field in const <String>[
      'prospectId',
      'outcome',
      'clientCreatedAt',
    ]) {
      if (decoded[field] is! String) {
        throw FormatException('tentative d\'appel sans $field', payload);
      }
    }
    final Object? code = decoded['reasonCode'] ?? decoded['outcome'];
    final CallReason? reason = code is String ? reasons[code] : null;
    if (reason == null) {
      throw FormatException(
        'motif d\'appel « $code » inconnu de cet appareil',
        payload,
      );
    }
    if (!CallEffects.all.contains(reason.effect)) {
      throw FormatException('effet « ${reason.effect} » inconnu', payload);
    }
    final Object? method = decoded['method'];
    if ((reason.effect == CallEffects.closeMethod) != (method != null)) {
      throw FormatException(
        'méthode incompatible avec l\'effet du motif',
        payload,
      );
    }
    if (method != null && !EnrollmentMethods.all.contains(method)) {
      throw FormatException('méthode d\'adhésion inconnue', payload);
    }
    return reason;
  }

  /// `outcome` n'y figure plus : le vocabulaire des issues vit maintenant dans
  /// la table locale des motifs, et une valeur qu'elle ignore est refusée par
  /// [_resolveCallAttempt] avec un message qui nomme le motif.
  static final Map<String, List<String>> _enumVocabulary =
      <String, List<String>>{
        'statut': ProspectStatut.values
            .where(
              (ProspectStatut s) => s != ProspectStatut.unknownDefaultOpenApi,
            )
            .map((ProspectStatut s) => s.value)
            .toList(growable: false),
        'method': EnrollmentMethods.all,
      };

  static void _assertNoUnknownEnum(
    Map<String, dynamic> decoded,
    String payload,
  ) {
    for (final MapEntry<String, List<String>> field
        in _enumVocabulary.entries) {
      final Object? value = decoded[field.key];
      if (value == null) continue;
      if (value is! String || !field.value.contains(value)) {
        throw FormatException(
          'valeur « $value » inconnue pour le champ ${field.key} : '
          'cette version de l\'application ne sait pas l\'envoyer',
          payload,
        );
      }
    }
  }

  /// Champs que le serveur accepte de mettre à NULL sur demande explicite.
  /// Copie exacte de `CLEARABLE_FIELDS` (`apps/api/src/modules/sync/dto.ts`) :
  /// un nom absent de sa liste fait refuser le LOT ENTIER.
  static const List<String> _clearableFields = <String>[
    'iefId',
    'notes',
    'whatsappE164',
    'profession',
    'prenom',
    'etablissement',
  ];

  /// Un champ ABSENT du payload reste inchangé côté serveur ; seul un champ
  /// présent et nul est un effacement voulu, et il faut le nommer pour que la
  /// sérialisation ne le confonde pas avec le silence d'une version ancienne.
  static List<String>? _clearedFields(Map<String, dynamic> decoded) {
    final List<String> cleared = _clearableFields
        .where((String f) => decoded.containsKey(f) && decoded[f] == null)
        .toList(growable: false);
    return cleared.isEmpty ? null : cleared;
  }

  SyncOperationDto _toOperation(
    OutboxData row,
    Map<String, CallReason> reasons,
  ) {
    final Object? raw = jsonDecode(row.payload);
    if (raw is! Map<String, dynamic>) {
      throw FormatException('payload non objet', row.payload);
    }
    Map<String, dynamic> decoded = raw;
    if (row.entityType == callAttemptEntity) {
      final CallReason reason = _resolveCallAttempt(
        decoded,
        row.payload,
        reasons,
      );
      // Le motif fait foi : `outcome` n'est que sa projection sur l'énumération
      // fermée du contrat, et une opération mise en file avant que le motif ne
      // change d'effet repart avec l'issue qui lui correspond aujourd'hui.
      decoded = <String, dynamic>{
        ...decoded,
        'outcome': reason.outcome,
        'reasonCode': reason.code,
      };
    }
    decoded.remove('_recordingPath');
    _assertNoUnknownEnum(decoded, row.payload);
    return SyncOperationDto(
      opId: row.id,
      seq: row.seq,
      entity: _entityOf(row.entityType),
      op: switch (row.op) {
        'create' => SyncOp.create,
        'update' => SyncOp.update,
        'delete' => SyncOp.delete,
        _ => throw FormatException('opération inconnue', row.op),
      },
      entityId: row.entityId,
      clientUpdatedAt: row.createdAt,
      baseRev: row.baseRev,
      data: row.op == 'delete' ? null : SyncEntityDataDto.fromJson(decoded),
      clearedFields: row.op == 'update' ? _clearedFields(decoded) : null,
    );
  }

  Future<_SendReport> _sendBatch(_PreparedBatch prepared) async {
    final PushResult result;
    try {
      result = await _api.push(
        batchId: prepared.batchId,
        payloadVersion: payloadVersion,
        operations: prepared.operations,
      );
    } on ApiException catch (e) {
      await _handleBatchFailure(prepared.rows, e);
      return const _SendReport(acknowledged: 0, keepGoing: false);
    }

    final Map<String, SyncOperationResultDto> byOpId =
        <String, SyncOperationResultDto>{
          for (final SyncOperationResultDto r in result.results) r.opId: r,
        };

    int acknowledged = 0;
    for (final OutboxData row in prepared.rows) {
      final SyncOperationResultDto? verdict = byOpId[row.id];
      if (verdict == null) {
        await _requeue(
          row,
          incrementAttempt: true,
          code: ClientErrorCodes.noResult,
        );
        continue;
      }
      acknowledged++;
      await _applyVerdict(row, verdict);
    }
    return _SendReport(acknowledged: acknowledged, keepGoing: true);
  }

  Future<_SendReport> _sendRepCallAttempts(List<OutboxData> rows) async {
    int acknowledged = 0;
    for (int index = 0; index < rows.length; index++) {
      final OutboxData row = rows[index];
      try {
        final Object? decoded = jsonDecode(row.payload);
        if (decoded is! Map<String, dynamic>) {
          throw const FormatException('payload non objet');
        }
        // `ouvertureId` ferme l'ouverture et arrête le chronomètre. Il ne
        // passe pas par le DTO engendré, qui ne le connaît pas encore.
        final Object? ouvertureId = decoded['ouvertureId'];
        final RepCallAttemptResultDto result = await _api.recordRepCallAttempt(
          CreateRepCallAttemptDto.fromJson(decoded),
          ouvertureId: ouvertureId is String ? ouvertureId : null,
        );
        if (result.status == RepCallAttemptApplyStatus.unknownDefaultOpenApi) {
          throw const FormatException('statut serveur inconnu');
        }
        await _markDone(
          row,
          SyncOperationResultDto(
            opId: row.id,
            status: result.status == RepCallAttemptApplyStatus.applied
                ? SyncOpStatus.applied
                : SyncOpStatus.duplicate,
            entityId: null,
            rev: null,
            serverUpdatedAt: null,
            errorCode: null,
            error: null,
          ),
        );
        acknowledged++;
      } on FormatException catch (error) {
        await _markFailed(
          row,
          ClientErrorCodes.payloadSchemaMismatch,
          error.message,
        );
      } on ApiException catch (error) {
        await _handleBatchFailure(rows.sublist(index), error);
        return _SendReport(acknowledged: acknowledged, keepGoing: false);
      }
    }
    return _SendReport(acknowledged: acknowledged, keepGoing: true);
  }

  /// Une ouverture par requête, comme les tentatives : le lot de
  /// synchronisation ne sait pas porter une route dédiée, et un refus du verrou
  /// n'a pas à annuler l'ouverture suivante.
  Future<_SendReport> _sendOuvertures(List<OutboxData> rows) async {
    int acknowledged = 0;
    for (int index = 0; index < rows.length; index++) {
      final OutboxData row = rows[index];
      try {
        final Object? decoded = jsonDecode(row.payload);
        if (decoded is! Map<String, dynamic>) {
          throw const FormatException('payload non objet');
        }
        final Object? brut = decoded['openedAt'];
        final DateTime? openedAt = brut is String
            ? DateTime.tryParse(brut)
            : null;
        if (openedAt == null) throw const FormatException('openedAt illisible');
        final Object? draft = decoded['draft'];
        await _api.ouvrirFiche(
          id: row.entityId,
          openedAt: openedAt,
          representantId: decoded['representantId'] as String?,
          prospectId: decoded['prospectId'] as String?,
          draft: draft is Map ? draft.cast<String, Object?>() : null,
        );
        await _markDone(
          row,
          SyncOperationResultDto(
            opId: row.id,
            status: SyncOpStatus.applied,
            entityId: row.entityId,
            rev: null,
            serverUpdatedAt: null,
            errorCode: null,
            error: null,
          ),
        );
        acknowledged++;
      } on FormatException catch (error) {
        await _markFailed(
          row,
          ClientErrorCodes.payloadSchemaMismatch,
          error.message,
        );
      } on ApiException catch (error) {
        await _handleBatchFailure(rows.sublist(index), error);
        return _SendReport(acknowledged: acknowledged, keepGoing: false);
      }
    }
    return _SendReport(acknowledged: acknowledged, keepGoing: true);
  }

  static const Set<String> _conflictCodes = <String>{
    ServerErrorCodes.revConflict,
    ServerErrorCodes.representantPhoneConflict,
    ServerErrorCodes.prospectPhoneConflict,
    ServerErrorCodes.entityIdOwnedByAnotherUser,
    ServerErrorCodes.representantOwnedByAnotherUser,
    ServerErrorCodes.phase2AlreadyCompleted,
  };

  static const Set<String> _blockedCodes = <String>{
    ServerErrorCodes.parentRepresentantFailed,
    ServerErrorCodes.representantNotFound,
    ServerErrorCodes.groupTransactionFailed,
  };

  Future<void> _applyVerdict(
    OutboxData row,
    SyncOperationResultDto verdict,
  ) async {
    switch (verdict.status) {
      case SyncOpStatus.applied:
        await _markDone(row, verdict);
      case SyncOpStatus.duplicate:
        await _applyReplayed(row, verdict);
      case SyncOpStatus.conflict:
        await _handleConflict(row, verdict);
      case SyncOpStatus.invalid:
        await _markFailed(
          row,
          verdict.errorCode ?? 'INVALID',
          verdict.error ?? 'Le serveur a refusé cette saisie.',
        );
      case SyncOpStatus.skippedDependencyFailed:
      case SyncOpStatus.unknownDefaultOpenApi:
        await _requeueBlocked(
          row,
          code: verdict.errorCode ?? ServerErrorCodes.parentRepresentantFailed,
          message: verdict.error,
        );
    }
  }

  Future<void> _applyReplayed(
    OutboxData row,
    SyncOperationResultDto verdict,
  ) async {
    final String? code = verdict.errorCode;
    if (code == null && verdict.error == null) {
      await _markDone(row, verdict);
      return;
    }
    if (code != null && _conflictCodes.contains(code)) {
      await _handleConflict(row, verdict);
      return;
    }
    if (code != null && _blockedCodes.contains(code)) {
      await _requeueBlocked(row, code: code, message: verdict.error);
      return;
    }
    await _markFailed(
      row,
      code ?? 'INVALID',
      verdict.error ?? 'Le serveur avait déjà refusé cette saisie.',
    );
  }

  Future<void> _markDone(OutboxData row, SyncOperationResultDto verdict) async {
    if (row.entityType == callAttemptEntity && !await _uploadRecording(row)) {
      return;
    }
    final String? serverId = verdict.entityId;
    // Le serveur a réuni deux fiches : seul remappage d'identifiant du système
    // (ADR 0001 §1).
    if (serverId != null &&
        serverId != row.entityId &&
        row.entityType == 'representant') {
      await remapEntityId(row.entityId, serverId);
    }
    await _db.transaction(() async {
      final int closed =
          await (_db.update(
            _db.outbox,
          )..where((Outbox o) => _ownedBy(o, row))).write(
            const OutboxCompanion(
              status: Value(OutboxStatus.done),
              leaseUntil: Value<DateTime?>(null),
              claimToken: Value<String?>(null),
              lastErrorCode: Value<String?>(null),
              lastErrorMsg: Value<String?>(null),
            ),
          );
      if (closed == 0) return;
      await _stampServerState(
        op: row.op,
        entityType: row.entityType,
        entityId: serverId ?? row.entityId,
        rev: verdict.rev?.toInt(),
        serverUpdatedAt: verdict.serverUpdatedAt,
      );
      await _rebaseFollowers(
        entityType: row.entityType,
        entityId: serverId ?? row.entityId,
        afterSeq: row.seq,
        rev: verdict.rev?.toInt(),
      );
      await _unblockFollowers(row.seq);
    });
  }

  Future<bool> _uploadRecording(OutboxData row) async {
    final Object? raw = jsonDecode(row.payload);
    if (raw is! Map<String, dynamic>) return true;
    final Object? path = raw['_recordingPath'];
    if (path is! String || path.isEmpty) return true;
    final File file = File(path);
    // ignore: avoid_slow_async_io
    if (!await file.exists()) {
      await _markFailed(
        row,
        'CALL_RECORDING_FILE_MISSING',
        'La note vocale a disparu du téléphone avant son envoi.',
      );
      return false;
    }
    try {
      await _api.uploadCallRecording(attemptId: row.entityId, path: path);
      await file.delete();
      return true;
    } on ApiException catch (error) {
      if (error.kind == FailureKind.terminal) {
        await _markFailed(
          row,
          error.code,
          error.message ??
              'La note vocale a été refusée. Contactez un administrateur '
                  'avant d’abandonner cet envoi.',
        );
        return false;
      }
      await _requeue(
        row,
        incrementAttempt: true,
        code: error.code,
        message: error.message,
      );
      return false;
    }
  }

  Future<void> _unblockFollowers(int afterSeq) async {
    final OutboxData? head = await (_db.select(
      _db.outbox,
    )..where((Outbox o) => o.seq.equals(afterSeq))).getSingleOrNull();
    final String? key = head?.dependencyKey;
    if (key == null) return;
    await (_db.update(_db.outbox)..where(
          (Outbox o) =>
              o.dependencyKey.equals(key) &
              o.seq.isBiggerThanValue(afterSeq) &
              o.status.isIn(OutboxStatus.open) &
              o.blockedAttempts.isBiggerThanValue(0),
        ))
        .write(const OutboxCompanion(blockedAttempts: Value<int>(0)));
  }

  Future<void> _rebaseFollowers({
    required String entityType,
    required String entityId,
    required int afterSeq,
    required int? rev,
  }) async {
    if (rev == null) return;
    if (_sansRevLocale.contains(entityType)) return;
    await (_db.update(_db.outbox)..where(
          (Outbox o) =>
              o.entityType.equals(entityType) &
              o.entityId.equals(entityId) &
              o.seq.isBiggerThanValue(afterSeq) &
              o.status.isIn(OutboxStatus.open) &
              o.baseRev.isNotNull(),
        ))
        .write(OutboxCompanion(baseRev: Value<int?>(rev)));
  }

  Future<void> _stampServerState({
    required String op,
    required String entityType,
    required String entityId,
    int? rev,
    DateTime? serverUpdatedAt,
  }) async {
    final bool clearDeletion = op != 'delete';
    if (rev == null && serverUpdatedAt == null && !clearDeletion) return;
    if (_sansRevLocale.contains(entityType)) return;
    if (entityType == 'representant') {
      await (_db.update(
        _db.representants,
      )..where((Representants t) => t.id.equals(entityId))).write(
        RepresentantsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: clearDeletion
              ? const Value<DateTime?>(null)
              : const Value.absent(),
        ),
      );
    } else {
      await (_db.update(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(entityId))).write(
        ProspectsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: clearDeletion
              ? const Value<DateTime?>(null)
              : const Value.absent(),
        ),
      );
    }
  }

  Future<void> _handleConflict(
    OutboxData row,
    SyncOperationResultDto verdict,
  ) async {
    final bool mergeable =
        verdict.errorCode == ServerErrorCodes.representantPhoneConflict &&
        row.entityType == 'representant' &&
        row.op == 'create';

    if (mergeable) {
      final String? resolved = await _autoMergeRepresentant(row);
      if (resolved != null) {
        await remapEntityId(row.entityId, resolved);
        await (_db.update(
          _db.outbox,
        )..where((Outbox o) => _ownedBy(o, row))).write(
          const OutboxCompanion(
            status: Value(OutboxStatus.done),
            leaseUntil: Value<DateTime?>(null),
            claimToken: Value<String?>(null),
            lastErrorCode: Value<String?>(null),
            lastErrorMsg: Value<String?>(null),
          ),
        );
        return;
      }
    }

    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.conflict),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(verdict.errorCode),
        lastErrorMsg: Value<String?>(verdict.error),
      ),
    );
  }

  Future<String?> _autoMergeRepresentant(OutboxData row) async {
    final String? me = await _tokens.readUserId();
    if (me == null) return null;

    final String? phone = _phoneOf(row.payload);
    if (phone == null) return null;

    final RepresentantLookup lookup;
    try {
      lookup = await _api.lookupRepresentantByPhone(phone);
    } on ApiException {
      return null;
    }
    if (!lookup.found || lookup.representant == null) return null;
    if (lookup.ownedByCommercialId != me) return null;
    return lookup.representant!.id;
  }

  static String? _phoneOf(String payload) {
    try {
      final Object? decoded = jsonDecode(payload);
      if (decoded is Map && decoded['phone'] is String) {
        return decoded['phone'] as String;
      }
    } on FormatException {
      return null;
    }
    return null;
  }

  Future<void> remapEntityId(String localId, String serverId) async {
    if (localId == serverId) return;
    await _db.transaction(() async {
      final Representant? existing = await (_db.select(
        _db.representants,
      )..where((Representants t) => t.id.equals(serverId))).getSingleOrNull();

      if (existing == null) {
        await _db.customStatement(
          'UPDATE representants SET id = ? WHERE id = ?',
          <Object?>[serverId, localId],
        );
      } else {
        await (_db.update(_db.prospects)
              ..where((Prospects t) => t.representantId.equals(localId)))
            .write(ProspectsCompanion(representantId: Value<String>(serverId)));
        await (_db.delete(
          _db.representants,
        )..where((Representants t) => t.id.equals(localId))).go();
      }

      await (_db.update(_db.outbox)..where(
            (Outbox o) =>
                o.entityType.equals('representant') &
                o.entityId.equals(localId),
          ))
          .write(OutboxCompanion(entityId: Value<String>(serverId)));

      await (_db.update(_db.outbox)
            ..where((Outbox o) => o.dependencyKey.equals(localId)))
          .write(OutboxCompanion(dependencyKey: Value<String?>(serverId)));

      final List<OutboxData> open = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.isIn(OutboxStatus.open))).get();
      for (final OutboxData row in open) {
        final String? rewritten = _rewriteRepresentantId(
          row.payload,
          localId,
          serverId,
        );
        if (rewritten == null) continue;
        await (_db.update(_db.outbox)
              ..where((Outbox o) => o.seq.equals(row.seq)))
            .write(OutboxCompanion(payload: Value<String>(rewritten)));
      }

      final List<FormDraft> drafts = await _db.select(_db.formDrafts).get();
      for (final FormDraft draft in drafts) {
        final String? rewritten = _rewriteRepresentantId(
          draft.payload,
          localId,
          serverId,
        );
        final bool parentMoved = draft.parentId == localId;
        final bool entityMoved = draft.entityId == localId;
        if (rewritten == null && !parentMoved && !entityMoved) continue;
        await (_db.update(
          _db.formDrafts,
        )..where((FormDrafts t) => t.draftId.equals(draft.draftId))).write(
          FormDraftsCompanion(
            payload: rewritten == null
                ? const Value.absent()
                : Value<String>(rewritten),
            parentId: parentMoved
                ? Value<String?>(serverId)
                : const Value.absent(),
            entityId: entityMoved
                ? Value<String?>(serverId)
                : const Value.absent(),
          ),
        );
      }
    });
  }

  static String? _rewriteRepresentantId(
    String payload,
    String from,
    String to,
  ) {
    final Object? decoded;
    try {
      decoded = jsonDecode(payload);
    } on FormatException {
      return null;
    }
    if (decoded is! Map) return null;
    if (decoded['representantId'] != from) return null;
    return jsonEncode(<String, Object?>{
      ...decoded.cast<String, Object?>(),
      'representantId': to,
    });
  }

  Future<void> _handleBatchFailure(
    List<OutboxData> rows,
    ApiException error,
  ) async {
    _lastPushFailure = error;
    switch (error.kind) {
      case FailureKind.idempotencyInProgress:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: const Duration(seconds: 2),
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.sessionExpired:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.appUpdateRequired:
        // La remontée reste ouverte côté serveur : la file attend la mise à
        // jour, elle ne s'use pas.
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.unreachable:
        // Un envoi qui expire a bien été TENTÉ : le compter est ce qui le rend
        // un jour visible dans « À corriger », là où un réseau absent ne doit
        // rien user.
        final bool sent = error.code == ClientErrorCodes.sendTimeout;
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: sent,
            delay: sent ? null : Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.throttled:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
            exhaustible: false,
            delay: error.retryAfter ?? _backoff.nextDelay(row.attempts + 1),
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.retryable:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
            exhaustible: false,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.terminal:
        await _applyTerminalRefusal(rows, error);
    }
  }

  /// Un refus qui NOMME les opérations fautives ne condamne qu'elles : sur un
  /// lot de deux cents saisies, tout marquer en échec pour une seule malformée
  /// renvoie une journée entière de prospection dans « À corriger ».
  Future<void> _applyTerminalRefusal(
    List<OutboxData> rows,
    ApiException error,
  ) async {
    final Set<int> named = error.rejectedOperations
        .where((int rank) => rank >= 0 && rank < rows.length)
        .toSet();
    if (named.isEmpty) {
      for (final OutboxData row in rows) {
        await _markFailed(row, error.code, error.message);
      }
      return;
    }
    for (int rank = 0; rank < rows.length; rank++) {
      if (named.contains(rank)) {
        await _markFailed(rows[rank], error.code, error.message);
        continue;
      }
      await _requeue(
        rows[rank],
        incrementAttempt: false,
        delay: Duration.zero,
        code: ClientErrorCodes.batchPeerRejected,
        message:
            'Renvoyée seule : le lot avait été refusé pour une autre saisie.',
      );
    }
  }

  /// [exhaustible] : un refus du SERVEUR (429, 5xx) n'est pas une faute de la
  /// saisie. Il fait croître le délai d'attente mais ne consomme pas le quota
  /// qui bascule la ligne dans « À corriger », sans quoi dix minutes de
  /// déploiement condamnent la file entière.
  Future<void> _requeue(
    OutboxData row, {
    required bool incrementAttempt,
    bool exhaustible = true,
    Duration? delay,
    String? code,
    String? message,
  }) async {
    final int counted = incrementAttempt ? row.attempts + 1 : row.attempts;
    final int attempts = exhaustible ? counted : min(counted, maxAttempts - 1);
    if (exhaustible && incrementAttempt && attempts >= maxAttempts) {
      await _markFailed(
        row,
        code ?? ClientErrorCodes.attemptsExhausted,
        message ??
            'Envoi impossible après $maxAttempts tentatives. '
                'Vérifiez la saisie ou réessayez plus tard.',
        attempts: attempts,
      );
      return;
    }
    final Duration wait = delay ?? _backoff.nextDelay(attempts);
    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        attempts: Value<int>(attempts),
        nextAttemptAt: Value<DateTime>(_clock.now().add(wait)),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  Future<void> _requeueBlocked(
    OutboxData row, {
    String? code,
    String? message,
  }) async {
    // Un groupe annulé sans autre explication : une fiche a pu citer une banque
    // ou une IEF que le serveur ne connaît plus. Le miroir tranche, et il ne
    // coûte que trois lectures.
    if (code == ServerErrorCodes.groupTransactionFailed) {
      await requestReferentielsMirror();
    }
    final int blocked = row.blockedAttempts + 1;
    if (blocked >= maxBlockedAttempts) {
      await _markFailed(
        row,
        code ?? ServerErrorCodes.parentRepresentantFailed,
        message ?? _blockedFailureMessage(code),
        blockedAttempts: blocked,
      );
      return;
    }
    final Duration jittered = _backoff.nextDelay(blocked);
    final Duration wait = jittered < blockedFloor ? blockedFloor : jittered;
    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        blockedAttempts: Value<int>(blocked),
        nextAttemptAt: Value<DateTime>(_clock.now().add(wait)),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }

  static String _blockedFailureMessage(String? code) =>
      code == ServerErrorCodes.groupTransactionFailed
      ? 'Le serveur n\'a pas pu enregistrer ce groupe de saisies. '
            'Réessayez ; si le refus persiste, signalez-le.'
      : 'Cette saisie dépend d\'une autre qui ne passe pas. '
            'Corrigez d\'abord la fiche parente.';

  Future<void> _markFailed(
    OutboxData row,
    String code,
    String? message, {
    int? attempts,
    int? blockedAttempts,
  }) async {
    await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.failed),
        attempts: attempts == null
            ? const Value.absent()
            : Value<int>(attempts),
        blockedAttempts: blockedAttempts == null
            ? const Value.absent()
            : Value<int>(blockedAttempts),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
    // Le serveur vient de dire qu'une entrée de liste n'existe plus : les
    // listes du téléphone sont périmées, et le prochain passage les relit en
    // entier plutôt que d'attendre qu'elles bougent.
    if (code == ServerErrorCodes.visiteReferentielUnavailable) {
      await VisitesRepository(_db).demanderMiroirReferentiels();
    }
  }

  static const String cursorKey = 'all';

  /// Applique les pages en LWW par `rev` : le `WHERE excluded.rev > rev` est ce
  /// qui empêche une page rejouée de réécrire une ligne plus récente.
  Future<int> pullChanges({int maxPages = 20}) async {
    if (_pulling) return 0;
    _pulling = true;
    try {
      await pullCallOutcomeReasons();
      await pullStatutsQualification();
      int applied = 0;
      String? cursor = await readCursor();
      bool listesBougees = false;
      bool referentielsBouges = false;

      for (int page = 0; page < maxPages; page++) {
        final PullPage result = await _api.pull(
          cursor: cursor,
          limit: 200,
          payloadVersion: payloadVersion,
        );
        applied += await _applyPage(result);
        listesBougees =
            listesBougees || result.changes.visiteReferentiels.isNotEmpty;
        referentielsBouges = referentielsBouges || _referentielsIn(result);
        final bool advanced = await advanceCursor(
          from: cursor,
          to: result.nextCursor,
        );
        cursor = result.nextCursor;
        if (!advanced || !result.hasMore) break;
      }
      await mirrorVisiteReferentiels(force: listesBougees);
      await mirrorReferentiels(force: referentielsBouges);
      await mirrorAttributions();
      return applied;
    } finally {
      _pulling = false;
    }
  }

  /// Les quatre listes de l'accueil redescendent ENTIÈRES, et ce qui n'y est
  /// plus quitte le téléphone.
  ///
  /// Le flux keyset ne dit que ce qui a changé : une base serveur remontée
  /// réattribue des identifiants neufs aux mêmes intitulés, et l'ancienne
  /// génération restait pour toujours. Le comptoir voyait chaque société deux
  /// fois et la visite partait avec un identifiant mort
  /// (`VISITE_REFERENTIEL_UNAVAILABLE`).
  ///
  /// Relu quand le serveur a bougé une entrée, et une fois sur les téléphones
  /// qui n'ont jamais été mis au miroir — c'est ce qui les soigne sans
  /// migration. Un échec ne casse pas le pull : les listes restent celles
  /// d'hier, ce qui vaut mieux que pas de listes.
  Future<int> mirrorVisiteReferentiels({bool force = false}) async {
    final VisitesRepository listes = VisitesRepository(_db);
    if (!force && !await listes.referentielsJamaisMiroites()) return 0;
    final VisiteReferentielsBundleDto bundle;
    try {
      bundle = await _api.pullVisiteReferentiels();
    } on ApiException {
      return 0;
    }
    return listes.remplacerReferentiels(bundle, maintenant: _clock.now());
  }

  /// Le référentiel des motifs ne voyage PAS par le curseur keyset : il a son
  /// propre point d'entrée et redescend en entier, filtré sur
  /// [payloadVersion]. Il n'y a donc aucun curseur à remettre à zéro pour qu'un
  /// téléphone déjà en service se peuple : la première synchronisation suffit.
  ///
  /// Un échec n'interrompt pas le pull des entités : les motifs se replient sur
  /// les six codes système, alors qu'une page de saisies perdue ne se rattrape
  /// pas.
  Future<int> pullCallOutcomeReasons() async {
    final List<CallOutcomeReasonDto> items;
    try {
      items = await _api.pullCallOutcomeReasons(payloadVersion: payloadVersion);
    } on ApiException {
      return 0;
    }
    if (items.isEmpty) return 0;
    await _db.transaction(() async {
      // Un motif retiré du web reste indispensable tant qu'une tentative déjà
      // en file le cite : sans lui, `_resolveCallAttempt` la juge illisible et
      // elle passe en échec définitif.
      final Set<String> stillCited = await _citedCallReasonCodes();
      final DeleteStatement<CallOutcomeReasons, CallOutcomeReason> stale = _db
          .delete(_db.callOutcomeReasons);
      if (stillCited.isNotEmpty) {
        stale.where(
          (CallOutcomeReasons t) =>
              t.code.isNotIn(stillCited.toList(growable: false)),
        );
      }
      await stale.go();
      for (final CallOutcomeReasonDto r in items) {
        await _db
            .into(_db.callOutcomeReasons)
            .insertOnConflictUpdate(
              CallOutcomeReasonsCompanion.insert(
                code: r.code,
                label: r.label,
                effect: r.effect.value,
                requiresComment: Value<bool>(r.requiresComment),
                requiresCallback: Value<bool>(r.requiresCallback),
                countsAsReached: Value<bool>(r.countsAsReached),
                isActive: Value<bool>(r.isActive),
                sortOrder: Value<int>(r.sortOrder.toInt()),
                color: Value<String?>(r.color),
                minPayloadVersion: Value<int>(r.minPayloadVersion.toInt()),
              ),
            );
      }
    });
    return items.length;
  }

  /// Le vocabulaire de qualification d'un représentant, REMPLACÉ en entier.
  ///
  /// Même route dédiée que les motifs d'appel, hors curseur keyset : un
  /// téléphone déjà en service se peuple à la première synchronisation. Le
  /// remplacement est franc, contrairement aux motifs : le champ est FACULTATIF
  /// dans le contrat, et une tentative en file qui citerait un statut retiré
  /// part sans lui plutôt qu'en échec définitif.
  ///
  /// L'ordre d'affichage se décide au serveur : le rang servi est recopié dans
  /// `position`, faute de quoi la liste se réordonnerait toute seule.
  Future<int> pullStatutsQualification() async {
    final List<StatutQualificationDto> items;
    try {
      items = await _api.pullStatutsQualification(
        payloadVersion: payloadVersion,
      );
    } on ApiException {
      return 0;
    }
    if (items.isEmpty) return 0;
    await _db.transaction(() async {
      await _db.delete(_db.statutsQualification).go();
      for (int rang = 0; rang < items.length; rang++) {
        final StatutQualificationDto statut = items[rang];
        await _db
            .into(_db.statutsQualification)
            .insertOnConflictUpdate(
              StatutsQualificationCompanion.insert(
                code: statut.code,
                id: statut.id,
                label: statut.label,
                effect: statut.effect.value,
                requiresCallback: Value<bool>(statut.requiresCallback),
                retryAfterMinutes: Value<int?>(
                  statut.retryAfterMinutes?.toInt(),
                ),
                relationStatus: Value<String?>(statut.relationStatus?.value),
                isActive: Value<bool>(statut.isActive),
                position: Value<int>(rang),
                minPayloadVersion: Value<int>(statut.minPayloadVersion.toInt()),
              ),
            );
      }
    });
    return items.length;
  }

  /// Le périmètre d'appel du compte, REMPLACÉ en entier.
  ///
  /// Le pull est global : c'est ce miroir qui borne ce qu'un téléconseiller voit
  /// et appelle. Un retrait d'attribution n'est annoncé par rien, d'où le
  /// remplacement plutôt qu'une fusion. Un échec laisse le périmètre d'hier :
  /// une borne périmée vaut mieux qu'un annuaire ouvert en grand.
  Future<int> mirrorAttributions() async {
    final MesAttributionsDto scope;
    try {
      scope = await _api.pullMesAttributions();
    } on ApiException {
      return 0;
    }
    final List<AttributionsCompanion> lignes = <AttributionsCompanion>[
      if (!scope.tout)
        AttributionsCompanion.insert(kind: attributionBorne, id: '1'),
      for (final String id in scope.representantIds)
        AttributionsCompanion.insert(kind: 'representant', id: id),
      for (final String id in scope.prospectIds)
        AttributionsCompanion.insert(kind: 'prospect', id: id),
    ];
    await _db.transaction(() async {
      await _db.delete(_db.attributions).go();
      await _db.batch(
        (Batch batch) => batch.insertAll(_db.attributions, lignes),
      );
    });
    return lignes.length;
  }

  Future<Set<String>> _citedCallReasonCodes() async {
    final List<OutboxData> open =
        await (_db.select(_db.outbox)..where(
              (Outbox o) =>
                  o.entityType.equals(callAttemptEntity) &
                  o.status.isIn(OutboxStatus.open),
            ))
            .get();
    final Set<String> codes = <String>{};
    for (final OutboxData row in open) {
      final Object? decoded = _tryDecode(row.payload);
      if (decoded is! Map) continue;
      final Object? code = decoded['reasonCode'] ?? decoded['outcome'];
      if (code is String && code.isNotEmpty) codes.add(code);
    }
    return codes;
  }

  Future<Set<String>> _entitiesWithOpenWrites(String entityType) async {
    final List<OutboxData> open =
        await (_db.select(_db.outbox)..where(
              (Outbox o) =>
                  o.entityType.equals(entityType) &
                  o.status.isIn(<String>[
                    OutboxStatus.pending,
                    OutboxStatus.syncing,
                  ]),
            ))
            .get();
    return open.map((OutboxData o) => o.entityId).toSet();
  }

  /// Le miroir des cinq référentiels de saisie.
  ///
  /// Le curseur ne descend que les CHANGEMENTS : une ligne effacée du serveur
  /// n'y apparaît jamais, et le téléphone la proposerait pour toujours à côté
  /// de celle qui l'a remplacée. Une base remontée renumérote tout : les deux
  /// générations cohabitent alors dans le sélecteur, et le serveur refuse la
  /// saisie qui cite l'ancienne. La liste ENTIÈRE est le seul moyen de savoir
  /// ce qui existe encore.
  ///
  /// Relu quand le serveur a bougé une entrée, et une fois sur les téléphones
  /// qui n'ont jamais été mis au miroir — c'est ce qui les soigne sans
  /// migration. Un échec n'interrompt pas le pull : le miroir se refait à la
  /// synchronisation suivante, alors qu'une page de saisies perdue, elle, ne
  /// se rattrape pas.
  Future<int> mirrorReferentiels({bool force = false}) async {
    if (!force && !await _referentielsJamaisMiroites()) return 0;
    final ReferentielsSnapshot snapshot;
    try {
      snapshot = await _api.pullReferentiels();
    } on ApiException {
      return 0;
    }
    return _db.transaction(() async {
      int retired = 0;
      retired += await _mirrorKind<DepartementDto>(
        _db.departements,
        snapshot.departements,
        (DepartementDto d) => d.id,
        _upsertDepartement,
      );
      retired += await _mirrorKind<IefDto>(
        _db.iefs,
        snapshot.iefs,
        (IefDto i) => i.id,
        _upsertIef,
      );
      retired += await _mirrorKind<BanqueDto>(
        _db.banques,
        snapshot.banques,
        (BanqueDto b) => b.id,
        _upsertBanque,
      );
      retired += await _mirrorKind<SyndicatDto>(
        _db.syndicats,
        snapshot.syndicats,
        (SyndicatDto s) => s.id,
        _upsertSyndicat,
      );
      retired += await _mirrorKind<CanalProvenanceDto>(
        _db.canauxProvenance,
        snapshot.canauxProvenance,
        (CanalProvenanceDto c) => c.id,
        _upsertCanalProvenance,
      );
      retired += await _mirrorKind<IncomeBandDto>(
        _db.incomeBands,
        snapshot.incomeBands,
        (IncomeBandDto b) => b.id,
        _upsertIncomeBand,
      );
      retired += await _mirrorKind<ProfessionDto>(
        _db.professions,
        snapshot.professions,
        (ProfessionDto p) => p.id,
        _upsertProfession,
      );
      retired += await _mirrorKind<EmployeurDto>(
        _db.employeurs,
        snapshot.employeurs,
        (EmployeurDto e) => e.id,
        _upsertEmployeur,
      );
      retired += await _mirrorKind<PaysDto>(
        _db.pays,
        snapshot.pays,
        (PaysDto p) => p.id,
        _upsertPays,
      );
      // Le marqueur est posé DANS la transaction : une écriture interrompue ne
      // doit pas laisser croire que le miroir est fait.
      await _db
          .into(_db.syncState)
          .insertOnConflictUpdate(
            SyncStateCompanion.insert(
              collection: referentielsMirrorKey,
              lastPulledAt: Value<DateTime?>(_clock.now()),
            ),
          );
      return retired;
    });
  }

  /// Une base remontée réattribue TOUS les identifiants : la page qui la porte
  /// bouge donc au moins un référentiel, et c'est ce qui déclenche le miroir.
  static bool _referentielsIn(PullPage page) =>
      page.changes.departements.isNotEmpty ||
      page.changes.iefs.isNotEmpty ||
      page.changes.banques.isNotEmpty ||
      page.changes.syndicats.isNotEmpty ||
      page.changes.canauxProvenance.isNotEmpty ||
      page.changes.incomeBands.isNotEmpty ||
      page.changes.professions.isNotEmpty ||
      page.changes.employeurs.isNotEmpty ||
      page.changes.pays.isNotEmpty;

  static const String referentielsMirrorKey = 'referentiels_mirror';

  Future<bool> _referentielsJamaisMiroites() async {
    final SyncStateData? row =
        await (_db.select(_db.syncState)..where(
              (SyncState t) => t.collection.equals(referentielsMirrorKey),
            ))
            .getSingleOrNull();
    return row?.lastPulledAt == null;
  }

  /// Redemande un miroir au prochain passage : un refus du serveur sur un
  /// groupe entier dit, entre autres, qu'une fiche a cité un référentiel que le
  /// serveur ne connaît plus. Le miroir est le seul moyen de le savoir.
  Future<void> requestReferentielsMirror() async {
    await (_db.delete(
      _db.syncState,
    )..where((SyncState t) => t.collection.equals(referentielsMirrorKey))).go();
  }

  /// Une liste VIDE ne retire rien : aucun de ces référentiels n'est vide côté
  /// serveur, et une réponse vide est une anomalie de transport, pas une
  /// suppression de masse.
  Future<int> _mirrorKind<D>(
    TableInfo<Table, Object?> table,
    List<D> rows,
    String Function(D) idOf,
    Future<void> Function(D) upsert,
  ) async {
    if (rows.isEmpty) return 0;
    for (final D row in rows) {
      await upsert(row);
    }
    final List<String> ids = <String>[for (final D row in rows) idOf(row)];
    final String holes = _holes(ids.length);
    final List<Variable<Object>> keys = _keys(ids);
    final int retired = await _db.customUpdate(
      'UPDATE ${table.actualTableName} SET deleted_at = ? '
      'WHERE deleted_at IS NULL AND id NOT IN ($holes)',
      variables: <Variable<Object>>[Variable<DateTime>(_clock.now()), ...keys],
      updates: <TableInfo<Table, Object?>>{table},
    );
    // Une restauration qui rend leurs identifiants aux lignes les ramène : le
    // miroir doit savoir les rouvrir, sinon elles resteraient invisibles.
    await _db.customUpdate(
      'UPDATE ${table.actualTableName} SET deleted_at = NULL '
      'WHERE deleted_at IS NOT NULL AND id IN ($holes)',
      variables: keys,
      updates: <TableInfo<Table, Object?>>{table},
    );
    return retired;
  }

  /// Le numéro identifie la PERSONNE, l'identifiant identifie la LIGNE.
  ///
  /// Une base serveur remontée redescend la même personne sous un identifiant
  /// neuf : l'index unique partiel local refuse alors l'insertion, et c'est la
  /// transaction de la page entière — donc toute la synchronisation, pour
  /// toujours — qui s'arrête. La ligne locale que le serveur ne connaît plus
  /// lui cède donc la place.
  ///
  /// Sauf si elle porte des saisies non parties : celles-là ne s'effacent
  /// jamais. C'est alors la ligne SERVEUR qu'on écarte, et l'envoi rendra son
  /// propre conflit de téléphone, qui est ce que « À corriger » sait déjà
  /// montrer et résoudre.
  ///
  /// Rend les identifiants ENTRANTS à ne pas appliquer.
  Future<Set<String>> _retireShadowed(
    TableInfo<Table, Object?> table,
    Map<String, String> incoming, {
    required Set<String> guarded,
  }) async {
    if (incoming.isEmpty) return const <String>{};
    final List<String> phones = incoming.values.toSet().toList(growable: false);
    final String holes = _holes(phones.length);
    final List<QueryRow> locals = await _db
        .customSelect(
          'SELECT id, phone_e164 FROM ${table.actualTableName} '
          'WHERE deleted_at IS NULL AND phone_e164 IN ($holes)',
          variables: _keys(phones),
          readsFrom: <ResultSetImplementation<dynamic, dynamic>>{table},
        )
        .get();

    final Set<String> blocked = <String>{};
    final List<String> retirable = <String>[];
    for (final QueryRow row in locals) {
      final String id = row.read<String>('id');
      if (incoming.containsKey(id)) continue;
      if (guarded.contains(id)) {
        final String phone = row.read<String>('phone_e164');
        blocked.addAll(incoming.keys.where((String k) => incoming[k] == phone));
        continue;
      }
      retirable.add(id);
    }
    if (retirable.isNotEmpty) {
      await _db.customUpdate(
        'UPDATE ${table.actualTableName} SET deleted_at = ? '
        'WHERE id IN (${_holes(retirable.length)})',
        variables: <Variable<Object>>[
          Variable<DateTime>(_clock.now()),
          ..._keys(retirable),
        ],
        updates: <TableInfo<Table, Object?>>{table},
      );
    }
    return blocked;
  }

  static String _holes(int count) => List<String>.filled(count, '?').join(', ');

  static List<Variable<Object>> _keys(List<String> values) =>
      <Variable<Object>>[for (final String v in values) Variable<String>(v)];

  Future<void> _upsertDepartement(DepartementDto d) async {
    await _db
        .into(_db.departements)
        .insert(
          DepartementsCompanion.insert(
            id: d.id,
            code: d.code,
            name: d.name,
            regionId: d.regionId,
            regionName: Value<String>(d.regionName),
            isActive: Value<bool>(d.isActive),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(d.updatedAt),
          ),
          onConflict: DoUpdate<Departements, Departement>(
            (Departements old) => DepartementsCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              name: const CustomExpression<String>('excluded.name'),
              regionId: const CustomExpression<String>('excluded.region_id'),
              regionName: const CustomExpression<String>(
                'excluded.region_name',
              ),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertIef(IefDto i) async {
    await _db
        .into(_db.iefs)
        .insert(
          IefsCompanion.insert(
            id: i.id,
            code: i.code,
            name: i.name,
            departementId: i.departementId,
            departementName: i.departementName,
            isActive: Value<bool>(i.isActive),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(i.updatedAt),
          ),
          onConflict: DoUpdate<Iefs, Ief>(
            (Iefs old) => IefsCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              name: const CustomExpression<String>('excluded.name'),
              departementId: const CustomExpression<String>(
                'excluded.departement_id',
              ),
              departementName: const CustomExpression<String>(
                'excluded.departement_name',
              ),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertBanque(BanqueDto b) async {
    await _db
        .into(_db.banques)
        .insert(
          BanquesCompanion.insert(
            id: b.id,
            name: b.name,
            shortName: b.shortName,
            isActive: Value<bool>(b.isActive),
            sortOrder: Value<int>(b.sortOrder.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(b.updatedAt),
          ),
          onConflict: DoUpdate<Banques, Banque>(
            (Banques old) => BanquesCompanion.custom(
              name: const CustomExpression<String>('excluded.name'),
              shortName: const CustomExpression<String>('excluded.short_name'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertSyndicat(SyndicatDto s) async {
    await _db
        .into(_db.syndicats)
        .insert(
          SyndicatsCompanion.insert(
            id: s.id,
            name: s.name,
            sigle: s.sigle,
            secteur: Value<String?>(s.secteur),
            isActive: Value<bool>(s.isActive),
            sortOrder: Value<int>(s.sortOrder.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(s.updatedAt),
          ),
          onConflict: DoUpdate<Syndicats, Syndicat>(
            (Syndicats old) => SyndicatsCompanion.custom(
              name: const CustomExpression<String>('excluded.name'),
              sigle: const CustomExpression<String>('excluded.sigle'),
              secteur: const CustomExpression<String>('excluded.secteur'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertCanalProvenance(CanalProvenanceDto c) async {
    await _db
        .into(_db.canauxProvenance)
        .insert(
          CanauxProvenanceCompanion.insert(
            id: c.id,
            code: c.code,
            label: c.label,
            isActive: Value<bool>(c.isActive),
            sortOrder: Value<int>(c.position.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(c.updatedAt),
          ),
          onConflict: DoUpdate<CanauxProvenance, CanauxProvenanceData>(
            (CanauxProvenance old) => CanauxProvenanceCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              label: const CustomExpression<String>('excluded.label'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertIncomeBand(IncomeBandDto b) async {
    await _db
        .into(_db.incomeBands)
        .insert(
          IncomeBandsCompanion.insert(
            id: b.id,
            code: b.code,
            label: b.label,
            minXof: Value<int?>(b.minXof?.toInt()),
            maxXof: Value<int?>(b.maxXof?.toInt()),
            isActive: Value<bool>(b.isActive),
            sortOrder: Value<int>(b.position.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(b.updatedAt),
          ),
          onConflict: DoUpdate<IncomeBands, IncomeBand>(
            (IncomeBands old) => IncomeBandsCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              label: const CustomExpression<String>('excluded.label'),
              minXof: const CustomExpression<int>('excluded.min_xof'),
              maxXof: const CustomExpression<int>('excluded.max_xof'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertProfession(ProfessionDto p) async {
    await _db
        .into(_db.professions)
        .insert(
          ProfessionsCompanion.insert(
            id: p.id,
            code: p.code,
            label: p.label,
            isTeaching: Value<bool>(p.isTeaching),
            isActive: Value<bool>(p.isActive),
            sortOrder: Value<int>(p.position.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(p.updatedAt),
          ),
          onConflict: DoUpdate<Professions, Profession>(
            (Professions old) => ProfessionsCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              label: const CustomExpression<String>('excluded.label'),
              isTeaching: const CustomExpression<bool>('excluded.is_teaching'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertEmployeur(EmployeurDto e) async {
    await _db
        .into(_db.employeurs)
        .insert(
          EmployeursCompanion.insert(
            id: e.id,
            code: e.code,
            label: e.label,
            type: e.type.value,
            isActive: Value<bool>(e.isActive),
            sortOrder: Value<int>(e.position.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(e.updatedAt),
          ),
          onConflict: DoUpdate<Employeurs, Employeur>(
            (Employeurs old) => EmployeursCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              label: const CustomExpression<String>('excluded.label'),
              type: const CustomExpression<String>('excluded.type'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<void> _upsertPays(PaysDto p) async {
    await _db
        .into(_db.pays)
        .insert(
          PaysCompanion.insert(
            id: p.id,
            code: p.code,
            label: p.label,
            indicatif: p.indicatif,
            isActive: Value<bool>(p.isActive),
            sortOrder: Value<int>(p.position.toInt()),
            localUpdatedAt: _clock.now(),
            serverUpdatedAt: Value<DateTime?>(p.updatedAt),
          ),
          onConflict: DoUpdate<Pays, PaysRow>(
            (Pays old) => PaysCompanion.custom(
              code: const CustomExpression<String>('excluded.code'),
              label: const CustomExpression<String>('excluded.label'),
              indicatif: const CustomExpression<String>('excluded.indicatif'),
              isActive: const CustomExpression<bool>('excluded.is_active'),
              sortOrder: const CustomExpression<int>('excluded.sort_order'),
              serverUpdatedAt: const CustomExpression<DateTime>(
                'excluded.server_updated_at',
              ),
              localUpdatedAt: const CustomExpression<DateTime>(
                'excluded.local_updated_at',
              ),
            ),
          ),
        );
  }

  Future<int> _applyPage(PullPage page) async {
    int count = 0;
    await _db.transaction(() async {
      final Set<String> guardedRepresentants = await _entitiesWithOpenWrites(
        'representant',
      );
      final Set<String> guardedProspects = await _entitiesWithOpenWrites(
        'prospect',
      );
      for (final DepartementDto d in page.changes.departements) {
        await _upsertDepartement(d);
        count++;
      }
      for (final IefDto i in page.changes.iefs) {
        await _upsertIef(i);
        count++;
      }
      for (final BanqueDto b in page.changes.banques) {
        await _upsertBanque(b);
        count++;
      }
      for (final CanalProvenanceDto c in page.changes.canauxProvenance) {
        await _upsertCanalProvenance(c);
        count++;
      }
      for (final IncomeBandDto b in page.changes.incomeBands) {
        await _upsertIncomeBand(b);
        count++;
      }
      for (final ProfessionDto p in page.changes.professions) {
        await _upsertProfession(p);
        count++;
      }
      for (final EmployeurDto e in page.changes.employeurs) {
        await _upsertEmployeur(e);
        count++;
      }
      for (final PaysDto p in page.changes.pays) {
        await _upsertPays(p);
        count++;
      }
      for (final SyndicatDto s in page.changes.syndicats) {
        await _upsertSyndicat(s);
        count++;
      }
      for (final SyncVisiteReferentielDto r
          in page.changes.visiteReferentiels) {
        await _db
            .into(_db.visiteReferentiels)
            .insertOnConflictUpdate(
              VisiteReferentielsCompanion.insert(
                id: r.id,
                kind: r.kind.value,
                code: r.code,
                label: r.label,
                isActive: Value<bool>(r.isActive),
                sortOrder: Value<int>(r.sortOrder.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(r.updatedAt),
              ),
            );
        count++;
      }
      guardedRepresentants.addAll(
        await _retireShadowed(_db.representants, <String, String>{
          for (final RepresentantDto r in page.changes.representants)
            r.id: r.phoneE164,
        }, guarded: guardedRepresentants),
      );
      guardedProspects.addAll(
        await _retireShadowed(_db.prospects, <String, String>{
          for (final ProspectDto p in page.changes.prospects) p.id: p.phoneE164,
        }, guarded: guardedProspects),
      );
      for (final RepresentantDto r in page.changes.representants) {
        if (guardedRepresentants.contains(r.id)) continue;
        await _db
            .into(_db.representants)
            .insert(
              RepresentantsCompanion.insert(
                id: r.id,
                fullName: r.fullName,
                phoneE164: r.phoneE164,
                notes: Value<String?>(r.notes),
                departementId: r.departementId,
                iefId: Value<String?>(r.iefId),
                relationStatus: Value<String>(r.relationStatus.value),
                statutQualificationId: Value<String?>(r.statutQualificationId),
                whatsappStatus: Value<String>(r.whatsappStatus.value),
                whatsappE164: Value<String?>(r.whatsappE164),
                profession: Value<String?>(r.profession),
                prenom: Value<String?>(r.prenom),
                etablissement: Value<String?>(r.etablissement),
                syndicat: Value<String?>(r.syndicat),
                connaitUes: Value<bool?>(r.connaitUES),
                contacte: Value<bool?>(r.contacte),
                lastCallOutcome: Value<String?>(r.lastCallOutcome?.value),
                lastCallAt: Value<DateTime?>(r.lastCallAt),
                lastCallById: Value<String?>(r.lastCallById),
                callAttemptCount: Value<int>(r.callAttemptCount.toInt()),
                nextCallbackAt: Value<DateTime?>(r.nextCallbackAt),
                createdById: r.createdById,
                clientCreatedAt: r.clientCreatedAt,
                rev: Value<int>(r.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(r.updatedAt),
              ),
              onConflict: DoUpdate<Representants, Representant>(
                (Representants old) => RepresentantsCompanion.custom(
                  fullName: const CustomExpression<String>(
                    'excluded.full_name',
                  ),
                  phoneE164: const CustomExpression<String>(
                    'excluded.phone_e164',
                  ),
                  notes: const CustomExpression<String>('excluded.notes'),
                  departementId: const CustomExpression<String>(
                    'excluded.departement_id',
                  ),
                  iefId: const CustomExpression<String>('excluded.ief_id'),
                  relationStatus: const CustomExpression<String>(
                    'excluded.relation_status',
                  ),
                  statutQualificationId: const CustomExpression<String>(
                    'excluded.statut_qualification_id',
                  ),
                  whatsappStatus: const CustomExpression<String>(
                    'excluded.whatsapp_status',
                  ),
                  whatsappE164: const CustomExpression<String>(
                    'excluded.whatsapp_e164',
                  ),
                  profession: const CustomExpression<String>(
                    'excluded.profession',
                  ),
                  prenom: const CustomExpression<String>('excluded.prenom'),
                  etablissement: const CustomExpression<String>(
                    'excluded.etablissement',
                  ),
                  syndicat: const CustomExpression<String>('excluded.syndicat'),
                  connaitUes: const CustomExpression<bool>(
                    'excluded.connait_ues',
                  ),
                  contacte: const CustomExpression<bool>('excluded.contacte'),
                  lastCallOutcome: const CustomExpression<String>(
                    'excluded.last_call_outcome',
                  ),
                  lastCallAt: const CustomExpression<DateTime>(
                    'excluded.last_call_at',
                  ),
                  lastCallById: const CustomExpression<String>(
                    'excluded.last_call_by_id',
                  ),
                  callAttemptCount: const CustomExpression<int>(
                    'excluded.call_attempt_count',
                  ),
                  nextCallbackAt: const CustomExpression<DateTime>(
                    'excluded.next_callback_at',
                  ),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
                // Un `rev` égal ne revient que sur une page rejouée ou après
                // un curseur remis à zéro : la relire est sans effet, sauf
                // pour les colonnes apparues depuis. Une saisie en file, elle,
                // garde la main jusqu'à sa remontée.
                where: (Representants old) => const CustomExpression<bool>(
                  'excluded.rev > representants.rev OR ('
                  'excluded.rev = representants.rev AND NOT EXISTS ('
                  'SELECT 1 FROM outbox o WHERE o.status IN '
                  "('pending', 'syncing', 'conflict', 'failed') "
                  'AND (o.entity_id = representants.id '
                  'OR o.dependency_key = representants.id)))',
                ),
              ),
            );
        count++;
      }
      for (final ProspectDto p in page.changes.prospects) {
        if (guardedProspects.contains(p.id)) continue;
        await _db
            .into(_db.prospects)
            .insert(
              ProspectsCompanion.insert(
                id: p.id,
                nom: p.nom,
                prenom: p.prenom,
                phoneE164: p.phoneE164,
                banqueId: Value<String?>(p.banqueId),
                syndicatId: Value<String?>(p.syndicatId),
                representantId: Value<String?>(p.representantId),
                projet: Value<String>(p.projet.value),
                type: Value<String?>(p.type?.value),
                profession: Value<String?>(p.profession),
                dureeSystemeMois: Value<int?>(p.dureeSystemeMois?.toInt()),
                canalProvenanceId: Value<String?>(p.canalProvenanceId),
                incomeBandId: Value<String?>(p.incomeBandId),
                employeurId: Value<String?>(p.employeurId),
                employeur: Value<String?>(p.employeur),
                typeContrat: Value<String?>(p.typeContrat?.value),
                ancienneteMois: Value<int?>(p.ancienneteMois?.toInt()),
                lieuActivite: Value<String?>(p.lieuActivite),
                modeEpargne: Value<String?>(p.modeEpargne?.value),
                professionId: Value<String?>(p.professionId),
                paysResidenceId: Value<String?>(p.paysResidenceId),
                villeResidence: Value<String?>(p.villeResidence),
                whatsappE164: Value<String?>(p.whatsappE164),
                relaisNom: Value<String?>(p.relaisNom),
                relaisPhoneE164: Value<String?>(p.relaisPhoneE164),
                lastCallOutcome: Value<String?>(p.lastCallOutcome?.value),
                lastCallAt: Value<DateTime?>(p.lastCallAt),
                lastCallById: Value<String?>(p.lastCallById),
                callAttemptCount: Value<int>(p.callAttemptCount.toInt()),
                createdById: p.ownedByCommercialId,
                statut: Value<String>(p.statut.value),
                clientCreatedAt: p.clientCreatedAt,
                rev: Value<int>(p.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(p.updatedAt),
                deletedAt: Value<DateTime?>(p.deletedAt),
              ),
              onConflict: DoUpdate<Prospects, Prospect>(
                (Prospects old) => ProspectsCompanion.custom(
                  nom: const CustomExpression<String>('excluded.nom'),
                  prenom: const CustomExpression<String>('excluded.prenom'),
                  phoneE164: const CustomExpression<String>(
                    'excluded.phone_e164',
                  ),
                  banqueId: const CustomExpression<String>(
                    'excluded.banque_id',
                  ),
                  syndicatId: const CustomExpression<String>(
                    'excluded.syndicat_id',
                  ),
                  representantId: const CustomExpression<String>(
                    'excluded.representant_id',
                  ),
                  projet: const CustomExpression<String>('excluded.projet'),
                  type: const CustomExpression<String>('excluded.type'),
                  profession: const CustomExpression<String>(
                    'excluded.profession',
                  ),
                  dureeSystemeMois: const CustomExpression<int>(
                    'excluded.duree_systeme_mois',
                  ),
                  canalProvenanceId: const CustomExpression<String>(
                    'excluded.canal_provenance_id',
                  ),
                  incomeBandId: const CustomExpression<String>(
                    'excluded.income_band_id',
                  ),
                  employeurId: const CustomExpression<String>(
                    'excluded.employeur_id',
                  ),
                  employeur: const CustomExpression<String>(
                    'excluded.employeur',
                  ),
                  typeContrat: const CustomExpression<String>(
                    'excluded.type_contrat',
                  ),
                  ancienneteMois: const CustomExpression<int>(
                    'excluded.anciennete_mois',
                  ),
                  lieuActivite: const CustomExpression<String>(
                    'excluded.lieu_activite',
                  ),
                  modeEpargne: const CustomExpression<String>(
                    'excluded.mode_epargne',
                  ),
                  professionId: const CustomExpression<String>(
                    'excluded.profession_id',
                  ),
                  paysResidenceId: const CustomExpression<String>(
                    'excluded.pays_residence_id',
                  ),
                  villeResidence: const CustomExpression<String>(
                    'excluded.ville_residence',
                  ),
                  whatsappE164: const CustomExpression<String>(
                    'excluded.whatsapp_e164',
                  ),
                  relaisNom: const CustomExpression<String>(
                    'excluded.relais_nom',
                  ),
                  relaisPhoneE164: const CustomExpression<String>(
                    'excluded.relais_phone_e164',
                  ),
                  lastCallOutcome: const CustomExpression<String>(
                    'excluded.last_call_outcome',
                  ),
                  lastCallAt: const CustomExpression<DateTime>(
                    'excluded.last_call_at',
                  ),
                  lastCallById: const CustomExpression<String>(
                    'excluded.last_call_by_id',
                  ),
                  callAttemptCount: const CustomExpression<int>(
                    'excluded.call_attempt_count',
                  ),
                  statut: const CustomExpression<String>('excluded.statut'),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                  deletedAt: const CustomExpression<DateTime>(
                    'excluded.deleted_at',
                  ),
                ),
                where: (Prospects old) => const CustomExpression<bool>(
                  'excluded.rev > prospects.rev OR ('
                  'excluded.rev = prospects.rev AND NOT EXISTS ('
                  'SELECT 1 FROM outbox o WHERE o.status IN '
                  "('pending', 'syncing', 'conflict', 'failed') "
                  'AND (o.entity_id = prospects.id '
                  'OR o.dependency_key = prospects.id '
                  "OR o.dependency_key = 'phase2:' || prospects.id)))",
                ),
              ),
            );
        // Les parcours, sans arbitrage : un parcours s'ouvre et ne se ferme
        // pas, le serveur en est seul auteur. C'est eux, et non la colonne
        // `projet`, qui rangent la fiche dans CHUES ou dans Grand Public.
        for (final ProspectJourneyDto j in p.journeys) {
          await _db
              .into(_db.prospectJourneys)
              .insertOnConflictUpdate(
                ProspectJourneysCompanion.insert(
                  prospectId: p.id,
                  projet: j.projet.value,
                  statut: Value<String>(j.statut.value),
                ),
              );
        }
        count++;
      }

      // Le registre : aucune revision, le serveur seul l'ecrit. Un rejeu de
      // pull recopie donc la meme ligne sans arbitrage.
      for (final SyncVisiteDto v in page.changes.visites) {
        await _db
            .into(_db.visites)
            .insertOnConflictUpdate(
              VisitesCompanion.insert(
                id: v.id,
                reference: Value<String?>(v.reference),
                date: v.date,
                time: Value<String?>(v.time),
                visitorName: v.visitorName,
                phone: Value<String?>(v.phone),
                phoneE164: Value<String?>(v.phoneE164),
                entrepriseId: v.entreprise.id,
                entrepriseLabel: v.entreprise.label,
                objetId: v.objet.id,
                objetLabel: v.objet.label,
                directionId: Value<String?>(v.direction?.id),
                directionLabel: Value<String?>(v.direction?.label),
                destinataireId: Value<String?>(v.destinataire?.id),
                destinataireLabel: Value<String?>(v.destinataire?.label),
                comment: Value<String?>(v.comment),
                createdById: v.createdById,
                createdAt: v.createdAt,
                updatedAt: v.updatedAt,
              ),
            );
        count++;
      }

      for (final SyncDeletionDto d in page.deletions) {
        if (d.entity == SyncEntity.representant) {
          if (guardedRepresentants.contains(d.id)) continue;
          await (_db.update(
            _db.representants,
          )..where((Representants t) => t.id.equals(d.id))).write(
            RepresentantsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)),
          );
        } else {
          if (guardedProspects.contains(d.id)) continue;
          await (_db.update(
            _db.prospects,
          )..where((Prospects t) => t.id.equals(d.id))).write(
            ProspectsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)),
          );
        }
        count++;
      }
    });
    return count;
  }

  Future<String?> readCursor() async {
    final SyncStateData? row =
        await (_db.select(_db.syncState)
              ..where((SyncState t) => t.collection.equals(cursorKey)))
            .getSingleOrNull();
    return row?.cursor;
  }

  Future<void> writeCursor(String? cursor) async {
    await _db
        .into(_db.syncState)
        .insertOnConflictUpdate(
          SyncStateCompanion.insert(
            collection: cursorKey,
            cursor: Value<String?>(cursor),
            lastPulledAt: Value<DateTime?>(_clock.now()),
          ),
        );
  }

  Future<bool> advanceCursor({
    required String? from,
    required String? to,
  }) async {
    final int changed = await _db.customUpdate(
      'INSERT INTO sync_state (collection, cursor, last_pulled_at) '
      'VALUES (?1, ?2, ?3) '
      'ON CONFLICT(collection) DO UPDATE SET '
      '  cursor = excluded.cursor, last_pulled_at = excluded.last_pulled_at '
      'WHERE sync_state.cursor IS ?4',
      variables: <Variable<Object>>[
        const Variable<String>(cursorKey),
        Variable<String>(to),
        Variable<DateTime>(_clock.now()),
        Variable<String>(from),
      ],
      updates: <TableInfo<Table, Object?>>{_db.syncState},
    );
    return changed > 0;
  }

  Future<void> dispose() => _db.close();
}

class _SendReport {
  const _SendReport({required this.acknowledged, required this.keepGoing});

  final int acknowledged;

  final bool keepGoing;
}

class _PreparedBatch {
  const _PreparedBatch({
    required this.batchId,
    required this.rows,
    required this.operations,
  });

  final String batchId;
  final List<OutboxData> rows;

  final List<SyncOperationDto> operations;

  int get length => operations.length;

  bool get isEmpty => operations.isEmpty;
}

class SyncOutcome {
  const SyncOutcome.ok({required this.pushed, required this.pulled})
    : status = SyncRunStatus.ok,
      reason = null,
      kind = null;

  const SyncOutcome.skipped(this.reason)
    : status = SyncRunStatus.skipped,
      pushed = 0,
      pulled = 0,
      kind = null;

  const SyncOutcome.failed(this.reason, {required this.kind, this.pushed = 0})
    : status = SyncRunStatus.failed,
      pulled = 0;

  final SyncRunStatus status;
  final int pushed;
  final int pulled;
  final String? reason;
  final FailureKind? kind;

  bool get isOk => status == SyncRunStatus.ok;

  bool get shouldRetry =>
      status == SyncRunStatus.failed &&
      kind != FailureKind.terminal &&
      kind != FailureKind.sessionExpired &&
      kind != FailureKind.appUpdateRequired;

  bool get requiresAppUpdate => kind == FailureKind.appUpdateRequired;
}

enum SyncRunStatus { ok, skipped, failed }
