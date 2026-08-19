import 'dart:convert';
import 'dart:math';

import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../data/local/database.dart';
import '../utils/ids.dart';
import 'api_port.dart';
import 'backoff.dart';
import 'clock.dart';
import 'outbox_status.dart';
import 'phase2_directory_sync.dart'
    show CallEffects, CallReason, EnrollmentMethods, callAttemptEntity, loadCallReasons;
import 'token_store.dart';

class SyncEngine {
  SyncEngine({
    required AppDatabase database,
    required ApiPort api,
    required TokenStore tokens,
    required Clock clock,
    this.maxBatchOps = 200,
    this.maxBatchBytes = 512 * 1024,
    this.maxBatchGroups = 25,
    this.maxAttempts = 8,
    this.maxBlockedAttempts = 12,
    this.blockedFloor = const Duration(seconds: 30),
    this.leaseDuration = const Duration(minutes: 2),
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
  static const int payloadVersion = 2;

  final int maxBatchOps;

  final int maxBatchBytes;

  final int maxBatchGroups;

  final int maxAttempts;

  final int maxBlockedAttempts;

  final Duration blockedFloor;

  final Duration leaseDuration;

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
      return SyncOutcome.failed(failure.code, kind: failure.kind, pushed: pushed);
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
      int acknowledged = 0;
      for (int round = 0; round < 50; round++) {
        await repairClockDrift();
        await reclaimExpiredLeases();
        final List<OutboxData> batch = await claimBatch();
        if (batch.isEmpty) break;

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

  Future<int> reclaimExpiredLeases() async {
    return _db.transaction(() async {
      final DateTime now = _clock.now();
      final List<OutboxData> stale = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.equals(OutboxStatus.syncing))).get();
      final List<OutboxData> expired = stale
          .where((OutboxData o) => o.leaseUntil == null || !o.leaseUntil!.isAfter(now))
          .toList(growable: false);
      if (expired.isEmpty) return 0;

      int reclaimed = 0;
      for (final OutboxData row in expired) {
        reclaimed +=
            await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
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
                (Outbox o) => o.seq.isIn(seqs) & o.status.equals(OutboxStatus.pending),
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

    final List<OutboxData> open = await _db.claimableOutbox(maxRows: 2000).get();

    final Map<String, List<OutboxData>> byKey = <String, List<OutboxData>>{};
    for (final OutboxData row in open) {
      byKey
          .putIfAbsent(row.dependencyKey ?? 'op:${row.id}', () => <OutboxData>[])
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
    return parent is String && parent.isNotEmpty
        ? 'representant:$parent'
        : 'prospect:${row.entityId}';
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
        await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
          OutboxCompanion(batchId: Value<String?>(batchId)),
        );
      }
    });

    return _PreparedBatch(batchId: batchId, rows: accepted, operations: operations);
  }

  static String _stableBatchId(List<OutboxData> rows) {
    final String? first = rows.first.batchId;
    if (first == null || first.isEmpty) return Ids.newId();
    for (final OutboxData row in rows) {
      if (row.batchId != first) return Ids.newId();
    }
    return first;
  }

  static SyncEntity _entityOf(String entityType) => switch (entityType) {
    'representant' => SyncEntity.representant,
    'prospect' => SyncEntity.prospect,
    callAttemptEntity => SyncEntity.callAttempt,
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
      throw FormatException('motif d\'appel « $code » inconnu de cet appareil', payload);
    }
    if (!CallEffects.all.contains(reason.effect)) {
      throw FormatException('effet « ${reason.effect} » inconnu', payload);
    }
    final Object? method = decoded['method'];
    if ((reason.effect == CallEffects.closeMethod) != (method != null)) {
      throw FormatException('méthode incompatible avec l\'effet du motif', payload);
    }
    if (method != null && !EnrollmentMethods.all.contains(method)) {
      throw FormatException('méthode d\'adhésion inconnue', payload);
    }
    return reason;
  }

  /// `outcome` n'y figure plus : le vocabulaire des issues vit maintenant dans
  /// la table locale des motifs, et une valeur qu'elle ignore est refusée par
  /// [_resolveCallAttempt] avec un message qui nomme le motif.
  static final Map<String, List<String>> _enumVocabulary = <String, List<String>>{
    'statut': ProspectStatut.values
        .where((ProspectStatut s) => s != ProspectStatut.unknownDefaultOpenApi)
        .map((ProspectStatut s) => s.value)
        .toList(growable: false),
    'method': EnrollmentMethods.all,
  };

  static void _assertNoUnknownEnum(Map<String, dynamic> decoded, String payload) {
    for (final MapEntry<String, List<String>> field in _enumVocabulary.entries) {
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
  static const List<String> _clearableFields = <String>[
    'iefId',
    'notes',
    'whatsappE164',
    'profession',
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

  SyncOperationDto _toOperation(OutboxData row, Map<String, CallReason> reasons) {
    final Object? raw = jsonDecode(row.payload);
    if (raw is! Map<String, dynamic>) {
      throw FormatException('payload non objet', row.payload);
    }
    Map<String, dynamic> decoded = raw;
    if (row.entityType == callAttemptEntity) {
      final CallReason reason = _resolveCallAttempt(decoded, row.payload, reasons);
      // Le motif fait foi : `outcome` n'est que sa projection sur l'énumération
      // fermée du contrat, et une opération mise en file avant que le motif ne
      // change d'effet repart avec l'issue qui lui correspond aujourd'hui.
      decoded = <String, dynamic>{
        ...decoded,
        'outcome': reason.outcome,
        'reasonCode': reason.code,
      };
    }
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

    final Map<String, SyncOperationResultDto> byOpId = <String, SyncOperationResultDto>{
      for (final SyncOperationResultDto r in result.results) r.opId: r,
    };

    int acknowledged = 0;
    for (final OutboxData row in prepared.rows) {
      final SyncOperationResultDto? verdict = byOpId[row.id];
      if (verdict == null) {
        await _requeue(row, incrementAttempt: true, code: ClientErrorCodes.noResult);
        continue;
      }
      acknowledged++;
      await _applyVerdict(row, verdict);
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

  Future<void> _applyVerdict(OutboxData row, SyncOperationResultDto verdict) async {
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

  Future<void> _applyReplayed(OutboxData row, SyncOperationResultDto verdict) async {
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
          await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
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
    if (entityType == callAttemptEntity) return;
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
    if (entityType == callAttemptEntity) return;
    if (entityType == 'representant') {
      await (_db.update(
        _db.representants,
      )..where((Representants t) => t.id.equals(entityId))).write(
        RepresentantsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: clearDeletion ? const Value<DateTime?>(null) : const Value.absent(),
        ),
      );
    } else {
      await (_db.update(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(entityId))).write(
        ProspectsCompanion(
          rev: rev == null ? const Value.absent() : Value<int>(rev),
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: clearDeletion ? const Value<DateTime?>(null) : const Value.absent(),
        ),
      );
    }
  }


  Future<void> _handleConflict(OutboxData row, SyncOperationResultDto verdict) async {
    final bool mergeable =
        verdict.errorCode == ServerErrorCodes.representantPhoneConflict &&
        row.entityType == 'representant' &&
        row.op == 'create';

    if (mergeable) {
      final String? resolved = await _autoMergeRepresentant(row);
      if (resolved != null) {
        await remapEntityId(row.entityId, resolved);
        await (_db.update(_db.outbox)..where((Outbox o) => _ownedBy(o, row))).write(
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
                o.entityType.equals('representant') & o.entityId.equals(localId),
          ))
          .write(OutboxCompanion(entityId: Value<String>(serverId)));

      await (_db.update(_db.outbox)..where((Outbox o) => o.dependencyKey.equals(localId)))
          .write(OutboxCompanion(dependencyKey: Value<String?>(serverId)));

      final List<OutboxData> open = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.status.isIn(OutboxStatus.open))).get();
      for (final OutboxData row in open) {
        final String? rewritten = _rewriteRepresentantId(row.payload, localId, serverId);
        if (rewritten == null) continue;
        await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(row.seq))).write(
          OutboxCompanion(payload: Value<String>(rewritten)),
        );
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
            payload: rewritten == null ? const Value.absent() : Value<String>(rewritten),
            parentId: parentMoved ? Value<String?>(serverId) : const Value.absent(),
            entityId: entityMoved ? Value<String?>(serverId) : const Value.absent(),
          ),
        );
      }
    });
  }

  static String? _rewriteRepresentantId(String payload, String from, String to) {
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


  Future<void> _handleBatchFailure(List<OutboxData> rows, ApiException error) async {
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
      case FailureKind.unreachable:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: false,
            delay: Duration.zero,
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.throttled:
        for (final OutboxData row in rows) {
          await _requeue(
            row,
            incrementAttempt: true,
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
            code: error.code,
            message: error.message,
          );
        }
      case FailureKind.terminal:
        for (final OutboxData row in rows) {
          await _markFailed(row, error.code, error.message);
        }
    }
  }

  Future<void> _requeue(
    OutboxData row, {
    required bool incrementAttempt,
    Duration? delay,
    String? code,
    String? message,
  }) async {
    final int attempts = incrementAttempt ? row.attempts + 1 : row.attempts;
    if (incrementAttempt && attempts >= maxAttempts) {
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

  Future<void> _requeueBlocked(OutboxData row, {String? code, String? message}) async {
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
        attempts: attempts == null ? const Value.absent() : Value<int>(attempts),
        blockedAttempts: blockedAttempts == null
            ? const Value.absent()
            : Value<int>(blockedAttempts),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        lastErrorCode: Value<String?>(code),
        lastErrorMsg: Value<String?>(message),
      ),
    );
  }


  static const String cursorKey = 'all';

  /// Applique les pages en LWW par `rev` : le `WHERE excluded.rev > rev` est ce
  /// qui empêche une page rejouée de réécrire une ligne plus récente.
  Future<int> pullChanges({int maxPages = 20}) async {
    if (_pulling) return 0;
    _pulling = true;
    try {
      await pullCallOutcomeReasons();
      int applied = 0;
      String? cursor = await readCursor();

      for (int page = 0; page < maxPages; page++) {
        final PullPage result = await _api.pull(cursor: cursor, limit: 200);
        applied += await _applyPage(result);
        final bool advanced = await advanceCursor(from: cursor, to: result.nextCursor);
        cursor = result.nextCursor;
        if (!advanced || !result.hasMore) break;
      }
      return applied;
    } finally {
      _pulling = false;
    }
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
      await _db.delete(_db.callOutcomeReasons).go();
      for (final CallOutcomeReasonDto r in items) {
        await _db
            .into(_db.callOutcomeReasons)
            .insert(
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

  Future<Set<String>> _entitiesWithOpenWrites(String entityType) async {
    final List<OutboxData> open =
        await (_db.select(_db.outbox)..where(
              (Outbox o) =>
                  o.entityType.equals(entityType) &
                  o.status.isIn(<String>[OutboxStatus.pending, OutboxStatus.syncing]),
            ))
            .get();
    return open.map((OutboxData o) => o.entityId).toSet();
  }

  Future<int> _applyPage(PullPage page) async {
    int count = 0;
    await _db.transaction(() async {
      final Set<String> guardedRepresentants = await _entitiesWithOpenWrites(
        'representant',
      );
      final Set<String> guardedProspects = await _entitiesWithOpenWrites('prospect');
      for (final DepartementDto d in page.changes.departements) {
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
                  regionName: const CustomExpression<String>('excluded.region_name'),
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
        count++;
      }
      for (final IefDto i in page.changes.iefs) {
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
        count++;
      }
      for (final BanqueDto b in page.changes.banques) {
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
        count++;
      }
      for (final SyndicatDto s in page.changes.syndicats) {
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
        count++;
      }
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
                whatsappStatus: Value<String>(r.whatsappStatus.value),
                whatsappE164: Value<String?>(r.whatsappE164),
                profession: Value<String?>(r.profession),
                createdById: r.createdById,
                clientCreatedAt: r.clientCreatedAt,
                rev: Value<int>(r.rev.toInt()),
                localUpdatedAt: _clock.now(),
                serverUpdatedAt: Value<DateTime?>(r.updatedAt),
              ),
              onConflict: DoUpdate<Representants, Representant>(
                (Representants old) => RepresentantsCompanion.custom(
                  fullName: const CustomExpression<String>('excluded.full_name'),
                  phoneE164: const CustomExpression<String>('excluded.phone_e164'),
                  notes: const CustomExpression<String>('excluded.notes'),
                  departementId: const CustomExpression<String>(
                    'excluded.departement_id',
                  ),
                  iefId: const CustomExpression<String>('excluded.ief_id'),
                  relationStatus: const CustomExpression<String>(
                    'excluded.relation_status',
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
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                ),
                where: (Representants old) =>
                    const CustomExpression<int>('excluded.rev').isBiggerThan(old.rev),
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
                banqueId: p.banqueId,
                syndicatId: p.syndicatId,
                representantId: p.representantId,
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
                  phoneE164: const CustomExpression<String>('excluded.phone_e164'),
                  banqueId: const CustomExpression<String>('excluded.banque_id'),
                  syndicatId: const CustomExpression<String>('excluded.syndicat_id'),
                  representantId: const CustomExpression<String>(
                    'excluded.representant_id',
                  ),
                  statut: const CustomExpression<String>('excluded.statut'),
                  rev: const CustomExpression<int>('excluded.rev'),
                  serverUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.server_updated_at',
                  ),
                  localUpdatedAt: const CustomExpression<DateTime>(
                    'excluded.local_updated_at',
                  ),
                  deletedAt: const CustomExpression<DateTime>('excluded.deleted_at'),
                ),
                where: (Prospects old) =>
                    const CustomExpression<int>('excluded.rev').isBiggerThan(old.rev),
              ),
            );
        count++;
      }

      for (final SyncDeletionDto d in page.deletions) {
        if (d.entity == SyncEntity.representant) {
          if (guardedRepresentants.contains(d.id)) continue;
          await (_db.update(_db.representants)
                ..where((Representants t) => t.id.equals(d.id)))
              .write(RepresentantsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)));
        } else {
          if (guardedProspects.contains(d.id)) continue;
          await (_db.update(_db.prospects)..where((Prospects t) => t.id.equals(d.id)))
              .write(ProspectsCompanion(deletedAt: Value<DateTime?>(d.deletedAt)));
        }
        count++;
      }
    });
    return count;
  }

  Future<String?> readCursor() async {
    final SyncStateData? row = await (_db.select(
      _db.syncState,
    )..where((SyncState t) => t.collection.equals(cursorKey))).getSingleOrNull();
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

  Future<bool> advanceCursor({required String? from, required String? to}) async {
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
      kind != FailureKind.sessionExpired;
}

enum SyncRunStatus { ok, skipped, failed }
