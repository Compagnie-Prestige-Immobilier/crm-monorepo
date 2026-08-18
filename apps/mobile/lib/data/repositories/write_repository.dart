import 'dart:convert';

import 'package:drift/drift.dart';

import '../../core/sync/clock.dart';
import '../../core/sync/outbox_status.dart';
import '../../core/sync/phase2_directory_sync.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/utils/ids.dart';
import '../local/database.dart';

const int kCallAttemptCommentMaxLength = 2000;

enum CallAttemptProblem {
  unknownOutcome,
  unknownMethod,
  methodRequired,
  methodNotAllowed,
  commentRequired,
  commentTooLong;

  String get message => switch (this) {
    CallAttemptProblem.unknownOutcome => 'Issue d\'appel inconnue.',
    CallAttemptProblem.unknownMethod => 'Méthode d\'enrôlement inconnue.',
    CallAttemptProblem.methodRequired => 'Choisissez la méthode d\'enrôlement obtenue.',
    CallAttemptProblem.methodNotAllowed =>
      'Une méthode ne se saisit que si elle a été obtenue.',
    CallAttemptProblem.commentRequired =>
      'Précisez ce qui s\'est passé : le commentaire est obligatoire pour '
          '« Autre ».',
    CallAttemptProblem.commentTooLong =>
      'Le commentaire dépasse $kCallAttemptCommentMaxLength caractères.',
  };
}

enum DiscardOutcome {
  discarded,

  claimed,

  notFound,
}

class DiscardResult {
  const DiscardResult(this.outcome, {this.removed = 0});

  final DiscardOutcome outcome;

  final int removed;
}

class DiscardPreview {
  const DiscardPreview({required this.operations, required this.prospects});

  final int operations;

  final int prospects;
}

class _ClaimRace implements Exception {
  const _ClaimRace();
}

class CallAttemptInvalid implements Exception {
  const CallAttemptInvalid(this.problem);

  final CallAttemptProblem problem;

  String get message => problem.message;

  @override
  String toString() => 'CallAttemptInvalid(${problem.name})';
}

class WriteRepository {
  WriteRepository(this._db, {Clock clock = const SystemClock()}) : _clock = clock;

  final AppDatabase _db;
  final Clock _clock;


  Future<String> createRepresentant({
    required String fullName,
    required String phoneE164,
    required String departementId,
    required String createdById,
    String? iefId,
    String? notes,
    String? id,
    String? draftId,
  }) async {
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();

    await _db.transaction(() async {
      await _db
          .into(_db.representants)
          .insert(
            RepresentantsCompanion.insert(
              id: entityId,
              fullName: fullName,
              phoneE164: phoneE164,
              notes: Value<String?>(notes),
              departementId: departementId,
              iefId: Value<String?>(iefId),
              createdById: createdById,
              clientCreatedAt: now,
              localUpdatedAt: now,
            ),
          );
      await _enqueue(
        dependencyKey: entityId,
        entityType: 'representant',
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'fullName': fullName,
          'phone': phoneE164,
          'departementId': departementId,
          'iefId': ?iefId,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          'clientCreatedAt': now.toUtc().toIso8601String(),
        },
        now: now,
      );
      await _dropDraft(draftId);
    });
    return entityId;
  }

  Future<void> updateRepresentant({
    required String id,
    required String fullName,
    required String phoneE164,
    required String departementId,
    String? iefId,
    String? notes,
    String? draftId,
  }) async {
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      final Representant current = await (_db.select(
        _db.representants,
      )..where((Representants t) => t.id.equals(id))).getSingle();
      await (_db.update(
        _db.representants,
      )..where((Representants t) => t.id.equals(id))).write(
        RepresentantsCompanion(
          fullName: Value<String>(fullName),
          phoneE164: Value<String>(phoneE164),
          notes: Value<String?>(notes),
          departementId: Value<String>(departementId),
          iefId: Value<String?>(iefId),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await _enqueue(
        dependencyKey: id,
        entityType: 'representant',
        entityId: id,
        op: 'update',
        baseRev: current.serverUpdatedAt == null ? null : current.rev,
        amendBlockedHead: true,
        payload: <String, Object?>{
          'fullName': fullName,
          'phone': phoneE164,
          'departementId': departementId,
          'iefId': iefId,
          'notes': notes,
        },
        now: now,
      );
      await _dropDraft(draftId);
    });
  }

  Future<void> deleteRepresentant(String id) async {
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      final Representant current = await (_db.select(
        _db.representants,
      )..where((Representants t) => t.id.equals(id))).getSingle();
      await (_db.update(
        _db.representants,
      )..where((Representants t) => t.id.equals(id))).write(
        RepresentantsCompanion(
          deletedAt: Value<DateTime?>(now),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await (_db.update(_db.prospects)
            ..where((Prospects t) => t.representantId.equals(id) & t.deletedAt.isNull()))
          .write(
            ProspectsCompanion(
              deletedAt: Value<DateTime?>(now),
              localUpdatedAt: Value<DateTime>(now),
            ),
          );
      await _enqueue(
        dependencyKey: id,
        entityType: 'representant',
        entityId: id,
        op: 'delete',
        baseRev: current.serverUpdatedAt == null ? null : current.rev,
        payload: const <String, Object?>{},
        now: now,
      );
    });
  }


  Future<String> createProspect({
    required String nom,
    required String prenom,
    required String phoneE164,
    required String banqueId,
    required String syndicatId,
    required String representantId,
    required String createdById,
    String? id,
    String? draftId,
  }) async {
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();

    await _db.transaction(() async {
      await _db
          .into(_db.prospects)
          .insert(
            ProspectsCompanion.insert(
              id: entityId,
              nom: nom,
              prenom: prenom,
              phoneE164: phoneE164,
              banqueId: banqueId,
              syndicatId: syndicatId,
              representantId: representantId,
              createdById: createdById,
              clientCreatedAt: now,
              localUpdatedAt: now,
            ),
          );
      await _enqueue(
        dependencyKey: representantId,
        entityType: 'prospect',
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'nom': nom,
          'prenom': prenom,
          'phone': phoneE164,
          'banqueId': banqueId,
          'syndicatId': syndicatId,
          'representantId': representantId,
          'clientCreatedAt': now.toUtc().toIso8601String(),
        },
        now: now,
      );
      await _dropDraft(draftId);
    });
    return entityId;
  }

  Future<void> updateProspect({
    required String id,
    required String nom,
    required String prenom,
    required String phoneE164,
    required String banqueId,
    required String syndicatId,
    required String representantId,
    String? statut,
    String? draftId,
  }) async {
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      final Prospect current = await (_db.select(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(id))).getSingle();
      await (_db.update(_db.prospects)..where((Prospects t) => t.id.equals(id))).write(
        ProspectsCompanion(
          nom: Value<String>(nom),
          prenom: Value<String>(prenom),
          phoneE164: Value<String>(phoneE164),
          banqueId: Value<String>(banqueId),
          syndicatId: Value<String>(syndicatId),
          representantId: Value<String>(representantId),
          statut: statut == null ? const Value.absent() : Value<String>(statut),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await _enqueue(
        dependencyKey: representantId,
        entityType: 'prospect',
        entityId: id,
        op: 'update',
        baseRev: current.serverUpdatedAt == null ? null : current.rev,
        amendBlockedHead: true,
        payload: <String, Object?>{
          'nom': nom,
          'prenom': prenom,
          'phone': phoneE164,
          'banqueId': banqueId,
          'syndicatId': syndicatId,
          'representantId': representantId,
          'statut': ?statut,
        },
        now: now,
      );
      await _dropDraft(draftId);
    });
  }

  Future<void> deleteProspect(String id) async {
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      final Prospect current = await (_db.select(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(id))).getSingle();
      await (_db.update(_db.prospects)..where((Prospects t) => t.id.equals(id))).write(
        ProspectsCompanion(
          deletedAt: Value<DateTime?>(now),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await _enqueue(
        dependencyKey: current.representantId,
        entityType: 'prospect',
        entityId: id,
        op: 'delete',
        baseRev: current.serverUpdatedAt == null ? null : current.rev,
        payload: const <String, Object?>{},
        now: now,
      );
    });
  }


  Future<String> recordCallAttempt({
    required String prospectId,
    required String outcome,
    required String createdById,
    String? method,
    String? comment,
    DateTime? callbackAt,
    String? id,
  }) async {
    final String? normalizedComment = normalizeComment(comment);
    final CallAttemptProblem? problem = validateCallAttempt(
      outcome: outcome,
      method: method,
      comment: normalizedComment,
    );
    if (problem != null) throw CallAttemptInvalid(problem);

    // Le serveur refuse une heure de rappel sur une autre issue que CALLBACK.
    final DateTime? callback = outcome == CallOutcomes.callback ? callbackAt : null;
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();

    await _db.transaction(() async {
      await _db
          .into(_db.callAttempts)
          .insert(
            CallAttemptsCompanion.insert(
              id: entityId,
              prospectId: prospectId,
              outcome: outcome,
              method: Value<String?>(method),
              comment: Value<String?>(normalizedComment),
              callbackAt: Value<DateTime?>(callback),
              clientCreatedAt: now,
              createdById: createdById,
            ),
          );
      await _enqueue(
        dependencyKey: 'phase2:$prospectId',
        entityType: callAttemptEntity,
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'prospectId': prospectId,
          'outcome': outcome,
          'method': ?method,
          'comment': ?normalizedComment,
          'callbackAt': ?callback?.toUtc().toIso8601String(),
          'clientCreatedAt': now.toUtc().toIso8601String(),
        },
        now: now,
      );

      if (CallOutcomes.terminal.contains(outcome)) {
        await (_db.update(
          _db.phase2Directory,
        )..where((Phase2Directory t) => t.prospectId.equals(prospectId))).write(
          Phase2DirectoryCompanion(
            phase2Status: Value<String>(outcome),
            enrollmentMethod: Value<String?>(
              outcome == CallOutcomes.methodObtained ? method : null,
            ),
            updatedAt: Value<DateTime>(now),
          ),
        );
      }
    });
    return entityId;
  }

  static String? normalizeComment(String? raw) {
    if (raw == null) return null;
    final String trimmed = raw.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  static CallAttemptProblem? validateCallAttempt({
    required String outcome,
    String? method,
    String? comment,
  }) {
    if (!CallOutcomes.all.contains(outcome)) {
      return CallAttemptProblem.unknownOutcome;
    }
    if (outcome == CallOutcomes.methodObtained) {
      if (method == null) return CallAttemptProblem.methodRequired;
      if (!EnrollmentMethods.all.contains(method)) {
        return CallAttemptProblem.unknownMethod;
      }
    } else if (method != null) {
      return CallAttemptProblem.methodNotAllowed;
    }
    if (outcome == CallOutcomes.other && (comment == null || comment.isEmpty)) {
      return CallAttemptProblem.commentRequired;
    }
    if (comment != null && comment.length > kCallAttemptCommentMaxLength) {
      return CallAttemptProblem.commentTooLong;
    }
    return null;
  }


  Future<OutboxData?> headOperation(String entityType, String entityId) {
    return (_db.select(_db.outbox)
          ..where(
            (Outbox o) =>
                o.entityType.equals(entityType) &
                o.entityId.equals(entityId) &
                o.status.isIn(OutboxStatus.open),
          )
          ..orderBy(<OrderClauseGenerator<Outbox>>[
            (Outbox o) => OrderingTerm.asc(o.seq),
          ])
          ..limit(1))
        .getSingleOrNull();
  }


  static bool _isClaimed(OutboxData row) =>
      row.claimToken != null || row.status == OutboxStatus.syncing;

  static Expression<bool> _unclaimed(Outbox o) =>
      o.claimToken.isNull() & o.status.equals(OutboxStatus.syncing).not();

  Future<void> _enqueue({
    required String dependencyKey,
    required String entityType,
    required String entityId,
    required String op,
    required Map<String, Object?> payload,
    required DateTime now,
    int? baseRev,

    bool amendBlockedHead = false,
  }) async {
    if (amendBlockedHead) {
      final OutboxData? head = await headOperation(entityType, entityId);
      if (head != null &&
          OutboxStatus.needsAttention.contains(head.status) &&
          head.op != 'delete') {
        final bool amended = await _amendInPlace(
          head: head,
          payload: payload,
          now: now,
          baseRev: baseRev,
        );
        if (amended) return;
      }
    }
    await _db
        .into(_db.outbox)
        .insert(
          OutboxCompanion.insert(
            id: Ids.newId(),
            dependencyKey: Value<String?>(dependencyKey),
            entityType: entityType,
            entityId: entityId,
            op: op,
            payload: jsonEncode(payload),
            payloadVersion: const Value<int>(SyncEngine.payloadVersion),
            baseRev: Value<int?>(baseRev),
            status: const Value<String>(OutboxStatus.pending),
            nextAttemptAt: now,
            createdAt: now,
          ),
        );
  }

  Future<bool> _amendInPlace({
    required OutboxData head,
    required Map<String, Object?> payload,
    required DateTime now,
    int? baseRev,
  }) async {
    final Object? previous = _tryDecode(head.payload);
    final Map<String, Object?> merged = <String, Object?>{
      if (previous is Map) ...previous.cast<String, Object?>(),
      ...payload,
    };
    final int amended =
        await (_db.update(_db.outbox)
              ..where((Outbox o) => o.seq.equals(head.seq) & _unclaimed(o)))
            .write(
      OutboxCompanion(
        id: Value<String>(Ids.newId()),
        payload: Value<String>(jsonEncode(merged)),
        payloadVersion: const Value<int>(SyncEngine.payloadVersion),
        baseRev: head.op == 'create' ? const Value<int?>(null) : Value<int?>(baseRev),
        status: const Value<String>(OutboxStatus.pending),
        attempts: const Value<int>(0),
        blockedAttempts: const Value<int>(0),
        nextAttemptAt: Value<DateTime>(now),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        batchId: const Value<String?>(null),
        lastErrorCode: const Value<String?>(null),
        lastErrorMsg: const Value<String?>(null),
      ),
    );
    return amended > 0;
  }

  static Object? _tryDecode(String payload) {
    try {
      return jsonDecode(payload);
    } on FormatException {
      return null;
    }
  }

  Future<void> _dropDraft(String? draftId) async {
    if (draftId == null) return;
    await (_db.delete(
      _db.formDrafts,
    )..where((FormDrafts t) => t.draftId.equals(draftId))).go();
  }


  Future<bool> retryOperation(int seq) async {
    final int changed =
        await (_db.update(_db.outbox)..where(
              (Outbox o) =>
                  o.seq.equals(seq) & o.status.isIn(OutboxStatus.needsAttention),
            ))
            .write(
              OutboxCompanion(
                status: const Value(OutboxStatus.pending),
                attempts: const Value<int>(0),
                blockedAttempts: const Value<int>(0),
                nextAttemptAt: Value<DateTime>(_clock.now()),
                leaseUntil: const Value<DateTime?>(null),
                claimToken: const Value<String?>(null),
                lastErrorCode: const Value<String?>(null),
                lastErrorMsg: const Value<String?>(null),
              ),
            );
    return changed > 0;
  }

  Future<DiscardResult> discardOwnCreateOnly(String opId) async {
    try {
      return await _db.transaction(() async {
        final OutboxData? row = await (_db.select(
          _db.outbox,
        )..where((Outbox o) => o.id.equals(opId))).getSingleOrNull();
        if (row == null ||
            row.op != 'create' ||
            row.entityType != 'representant') {
          return const DiscardResult(DiscardOutcome.notFound);
        }
        if (_isClaimed(row)) return const DiscardResult(DiscardOutcome.claimed);

        final int removed =
            await (_db.delete(_db.outbox)..where(
                  (Outbox o) =>
                      o.id.equals(opId) &
                      o.op.equals('create') &
                      o.entityType.equals('representant') &
                      _unclaimed(o),
                ))
                .go();
        if (removed != 1) {
          throw const _ClaimRace();
        }
        return const DiscardResult(DiscardOutcome.discarded, removed: 1);
      });
    } on _ClaimRace {
      return const DiscardResult(DiscardOutcome.claimed);
    }
  }

  Future<DiscardResult> discardOperation(int seq) async {
    try {
      return await _db.transaction(() async {
        final OutboxData? row = await (_db.select(
          _db.outbox,
        )..where((Outbox o) => o.seq.equals(seq))).getSingleOrNull();
        if (row == null) return const DiscardResult(DiscardOutcome.notFound);
        if (_isClaimed(row)) return const DiscardResult(DiscardOutcome.claimed);

        final List<OutboxData> victims = await _discardVictims(row);
        if (victims.any(_isClaimed)) {
          return const DiscardResult(DiscardOutcome.claimed);
        }

        final List<int> seqs = victims
            .map((OutboxData v) => v.seq)
            .toList(growable: false);
        final int removed =
            await (_db.delete(
              _db.outbox,
            )..where((Outbox o) => o.seq.isIn(seqs) & _unclaimed(o))).go();
        if (removed != victims.length) {
          throw const _ClaimRace();
        }

        for (final OutboxData victim in victims) {
          if (victim.op == 'create') {
            if (victim.entityType == 'prospect') {
              await (_db.delete(
                _db.prospects,
              )..where((Prospects t) => t.id.equals(victim.entityId))).go();
            }
          }
        }
        for (final OutboxData victim in victims) {
          if (victim.op == 'create' && victim.entityType == 'representant') {
            await (_db.delete(
              _db.representants,
            )..where((Representants t) => t.id.equals(victim.entityId))).go();
          }
        }

        return DiscardResult(DiscardOutcome.discarded, removed: removed);
      });
    } on _ClaimRace {
      return const DiscardResult(DiscardOutcome.claimed);
    }
  }

  Future<List<OutboxData>> _discardVictims(OutboxData row) async {
    if (row.op != 'create' ||
        row.entityType != 'representant' ||
        row.dependencyKey == null) {
      return <OutboxData>[row];
    }
    return (_db.select(_db.outbox)..where(
          (Outbox o) =>
              o.dependencyKey.equals(row.dependencyKey!) &
              o.seq.isBiggerOrEqualValue(row.seq) &
              o.status.isIn(OutboxStatus.open),
        ))
        .get();
  }

  Future<DiscardPreview> previewDiscard(int seq) async {
    final OutboxData? row = await (_db.select(
      _db.outbox,
    )..where((Outbox o) => o.seq.equals(seq))).getSingleOrNull();
    if (row == null) {
      return const DiscardPreview(operations: 0, prospects: 0);
    }
    final List<OutboxData> victims = await _discardVictims(row);
    final int prospects = victims
        .where(
          (OutboxData v) => v.op == 'create' && v.entityType == 'prospect',
        )
        .length;
    return DiscardPreview(operations: victims.length, prospects: prospects);
  }
}
