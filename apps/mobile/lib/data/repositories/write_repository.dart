import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';

import '../../core/sync/clock.dart';
import '../../core/sync/outbox_status.dart';
import '../../core/sync/phase2_directory_sync.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/utils/ids.dart';
import '../../core/utils/whatsapp.dart';
import '../local/database.dart';

const int kCallAttemptCommentMaxLength = 2000;

enum CallAttemptProblem {
  unknownReason,
  unknownMethod,
  methodRequired,
  methodNotAllowed,
  commentRequired,
  commentTooLong;

  String get message => switch (this) {
    CallAttemptProblem.unknownReason =>
      'Motif d\'appel inconnu de cet appareil.',
    CallAttemptProblem.unknownMethod => 'Méthode d\'enrôlement inconnue.',
    CallAttemptProblem.methodRequired =>
      'Choisissez la méthode d\'enrôlement obtenue.',
    CallAttemptProblem.methodNotAllowed =>
      'Une méthode ne se saisit que si elle a été obtenue.',
    CallAttemptProblem.commentRequired =>
      'Précisez ce qui s\'est passé : le commentaire est obligatoire pour ce '
          'motif.',
    CallAttemptProblem.commentTooLong =>
      'Le commentaire dépasse $kCallAttemptCommentMaxLength caractères.',
  };
}

enum DiscardOutcome { discarded, claimed, notFound }

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
  WriteRepository(this._db, {Clock clock = const SystemClock()})
    : _clock = clock;

  final AppDatabase _db;
  final Clock _clock;

  /// Le numéro WhatsApp n'est retenu que sur `AUTRE_NUMERO`.
  ///
  /// Le choke point est ici et pas dans l'écran : sur `MEME_NUMERO`, recopier
  /// `phone_e164` donnerait deux numéros à tenir d'accord, et le jour où le
  /// téléphone est corrigé la copie divergerait sans que rien ne le signale.
  static String? _whatsappE164For(String status, String? entered) =>
      status == WhatsappStatus.autreNumero.code ? entered : null;

  /// `reference` reste absente en local : c'est le serveur qui l'attribue, à
  /// la poussée. Elle apparaît au pull suivant, qui recopie la ligne en place
  /// grâce au même `id`.
  Future<String> inscrireVisite({
    required String visitorName,
    required String date,
    required String entrepriseId,
    required String entrepriseLabel,
    required String objetId,
    required String objetLabel,
    required String createdById,
    String? time,
    String? phone,
    String? directionId,
    String? directionLabel,
    String? destinataireId,
    String? destinataireLabel,
    String? comment,
    String? id,
  }) async {
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      await _db
          .into(_db.visites)
          .insert(
            VisitesCompanion.insert(
              id: entityId,
              date: date,
              time: Value<String?>(time),
              visitorName: visitorName,
              phone: Value<String?>(phone),
              entrepriseId: entrepriseId,
              entrepriseLabel: entrepriseLabel,
              objetId: objetId,
              objetLabel: objetLabel,
              directionId: Value<String?>(directionId),
              directionLabel: Value<String?>(directionLabel),
              destinataireId: Value<String?>(destinataireId),
              destinataireLabel: Value<String?>(destinataireLabel),
              comment: Value<String?>(comment),
              createdById: createdById,
              createdAt: now,
              updatedAt: now,
            ),
          );
      await _enqueue(
        // Une inscription ne depend de rien : chaque visite est sa propre
        // partition, comme cote serveur (voir dependencyKeyOf).
        dependencyKey: entityId,
        entityType: 'visite',
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'visitorName': visitorName,
          'visitDate': date,
          'visitTime': ?time,
          'phone': ?phone,
          'entrepriseId': entrepriseId,
          'objetId': objetId,
          'directionId': ?directionId,
          'destinataireId': ?destinataireId,
          'comment': ?comment,
        },
        now: now,
      );
    });
    return entityId;
  }

  Future<String> createRepresentant({
    required String fullName,
    required String phoneE164,
    required String departementId,
    required String createdById,
    String? iefId,
    String? notes,
    String whatsappStatus = 'NON_DEMANDE',
    String? whatsappE164,
    String? profession,
    String? id,
    String? draftId,
  }) async {
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();
    final String? whatsapp = _whatsappE164For(whatsappStatus, whatsappE164);

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
              whatsappStatus: Value<String>(whatsappStatus),
              whatsappE164: Value<String?>(whatsapp),
              profession: Value<String?>(profession),
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
          'whatsappStatus': whatsappStatus,
          'whatsappE164': ?whatsapp,
          'profession': ?profession,
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
    String whatsappStatus = 'NON_DEMANDE',
    String? whatsappE164,
    String? profession,
    String? draftId,
  }) async {
    final DateTime now = _clock.now();
    final String? whatsapp = _whatsappE164For(whatsappStatus, whatsappE164);
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
          whatsappStatus: Value<String>(whatsappStatus),
          whatsappE164: Value<String?>(whatsapp),
          profession: Value<String?>(profession),
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
          'whatsappStatus': whatsappStatus,
          'whatsappE164': whatsapp,
          'profession': profession,
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
      await (_db.update(_db.prospects)..where(
            (Prospects t) => t.representantId.equals(id) & t.deletedAt.isNull(),
          ))
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

  /// Ajout seul. Un commentaire ne se modifie ni ne s'efface : il n'y a donc ni
  /// `rev` à envoyer ni conflit possible, et deux téléconseillers hors ligne qui
  /// commentent la même fiche produisent deux lignes distinctes.
  Future<String> addRepresentantComment({
    required String representantId,
    required String body,
    required String authorId,
    required String authorName,
  }) async {
    final String trimmed = body.trim();
    if (trimmed.isEmpty) {
      throw ArgumentError.value(
        body,
        'body',
        'un commentaire vide ne s\'écrit pas',
      );
    }
    final String entityId = Ids.newId();
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      await _db
          .into(_db.representantComments)
          .insert(
            RepresentantCommentsCompanion.insert(
              id: entityId,
              representantId: representantId,
              authorId: authorId,
              authorName: authorName,
              body: trimmed,
              clientCreatedAt: now,
            ),
          );
      await _enqueue(
        dependencyKey: representantId,
        entityType: 'representant_comment',
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'representantId': representantId,
          'body': trimmed,
          'clientCreatedAt': now.toUtc().toIso8601String(),
        },
        now: now,
      );
    });
    return entityId;
  }

  /// Banque, syndicat et representant sont FACULTATIFS : un teleconseiller ne
  /// les obtient pas toujours, et une fiche Grand Public n'en a aucun.
  Future<String> createProspect({
    required String nom,
    required String prenom,
    required String phoneE164,
    required String createdById,
    String? banqueId,
    String? syndicatId,
    String? representantId,
    String? projet,
    String? type,
    String? profession,
    int? dureeSystemeMois,
    String? canalProvenanceId,
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
              banqueId: Value<String?>(banqueId),
              syndicatId: Value<String?>(syndicatId),
              representantId: Value<String?>(representantId),
              projet: projet == null
                  ? const Value<String>.absent()
                  : Value<String>(projet),
              type: Value<String?>(type),
              profession: Value<String?>(profession),
              createdById: createdById,
              clientCreatedAt: now,
              localUpdatedAt: now,
            ),
          );
      await _enqueue(
        // Sans representant, la fiche ne depend de personne : elle se chaine sur
        // elle-meme plutot que de bloquer derriere une cle vide.
        dependencyKey: representantId ?? entityId,
        entityType: 'prospect',
        entityId: entityId,
        op: 'create',
        // Une cle absente n'est PAS un vidage : le transport JSON supprime les
        // `null`, et le serveur refuse le lot entier sur un champ inconnu. On
        // n'ecrit donc que ce qui a une valeur.
        payload: <String, Object?>{
          'nom': nom,
          'prenom': prenom,
          'phone': phoneE164,
          'banqueId': ?banqueId,
          'syndicatId': ?syndicatId,
          'representantId': ?representantId,
          'projet': ?projet,
          'type': ?type,
          if (profession != null && profession.isNotEmpty)
            'profession': profession,
          'dureeSystemeMois': ?dureeSystemeMois,
          'canalProvenanceId': ?canalProvenanceId,
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
    String? banqueId,
    String? syndicatId,
    String? representantId,
    String? statut,
    String? draftId,
  }) async {
    final DateTime now = _clock.now();
    await _db.transaction(() async {
      final Prospect current = await (_db.select(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(id))).getSingle();
      await (_db.update(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(id))).write(
        ProspectsCompanion(
          nom: Value<String>(nom),
          prenom: Value<String>(prenom),
          phoneE164: Value<String>(phoneE164),
          banqueId: Value<String?>(banqueId),
          syndicatId: Value<String?>(syndicatId),
          representantId: Value<String?>(representantId),
          statut: statut == null ? const Value.absent() : Value<String>(statut),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await _enqueue(
        dependencyKey: representantId ?? id,
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
      await (_db.update(
        _db.prospects,
      )..where((Prospects t) => t.id.equals(id))).write(
        ProspectsCompanion(
          deletedAt: Value<DateTime?>(now),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await _enqueue(
        // Sans representant, la fiche ne depend de personne : elle se chaine sur
        // elle-meme plutot que de bloquer derriere une cle vide.
        dependencyKey: current.representantId ?? id,
        entityType: 'prospect',
        entityId: id,
        op: 'delete',
        baseRev: current.serverUpdatedAt == null ? null : current.rev,
        payload: const <String, Object?>{},
        now: now,
      );
    });
  }

  /// [outcome] et [reasonCode] désignent le MÊME motif : le second l'emporte, le
  /// premier reste le point d'entrée des six codes système, dont le référentiel
  /// garantit qu'ils portent le code de leur issue.
  Future<String> recordCallAttempt({
    required String prospectId,
    required String outcome,
    required String createdById,
    String? reasonCode,
    String? method,
    String? comment,
    DateTime? callbackAt,
    String? recordingPath,
    String? id,
  }) async {
    final CallReason? reason = await resolveCallReason(
      _db,
      reasonCode ?? outcome,
    );
    if (reason == null) {
      throw const CallAttemptInvalid(CallAttemptProblem.unknownReason);
    }
    final String? normalizedComment = normalizeComment(comment);
    final CallAttemptProblem? problem = validateCallAttempt(
      reason: reason,
      method: method,
      comment: normalizedComment,
    );
    if (problem != null) throw CallAttemptInvalid(problem);

    // Le serveur refuse une heure de rappel sur une issue qui n'en programme pas.
    final DateTime? callback = reason.effect == CallEffects.scheduleCallback
        ? callbackAt
        : null;
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();

    await _db.transaction(() async {
      await _db
          .into(_db.callAttempts)
          .insert(
            CallAttemptsCompanion.insert(
              id: entityId,
              prospectId: prospectId,
              outcome: reason.outcome,
              reasonCode: Value<String?>(reason.code),
              effect: Value<String>(reason.effect),
              requiresComment: Value<bool>(reason.requiresComment),
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
          'outcome': reason.outcome,
          'reasonCode': reason.code,
          'method': ?method,
          'comment': ?normalizedComment,
          'callbackAt': ?callback?.toUtc().toIso8601String(),
          'clientCreatedAt': now.toUtc().toIso8601String(),
          '_recordingPath': ?recordingPath,
        },
        now: now,
      );

      final String? closed = CallEffects.phase2Status(reason.effect);
      if (closed != null) {
        await (_db.update(
          _db.phase2Directory,
        )..where((Phase2Directory t) => t.prospectId.equals(prospectId))).write(
          Phase2DirectoryCompanion(
            phase2Status: Value<String>(closed),
            enrollmentMethod: Value<String?>(
              reason.effect == CallEffects.closeMethod ? method : null,
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
    required CallReason reason,
    String? method,
    String? comment,
  }) {
    if (reason.effect == CallEffects.closeMethod) {
      if (method == null) return CallAttemptProblem.methodRequired;
      if (!EnrollmentMethods.all.contains(method)) {
        return CallAttemptProblem.unknownMethod;
      }
    } else if (method != null) {
      return CallAttemptProblem.methodNotAllowed;
    }
    if (reason.requiresComment && (comment == null || comment.isEmpty)) {
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
        await (_db.update(
          _db.outbox,
        )..where((Outbox o) => o.seq.equals(head.seq) & _unclaimed(o))).write(
          OutboxCompanion(
            id: Value<String>(Ids.newId()),
            payload: Value<String>(jsonEncode(merged)),
            payloadVersion: const Value<int>(SyncEngine.payloadVersion),
            baseRev: head.op == 'create'
                ? const Value<int?>(null)
                : Value<int?>(baseRev),
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
                  o.seq.equals(seq) &
                  o.status.isIn(OutboxStatus.needsAttention),
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
        final int removed = await (_db.delete(
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
        for (final OutboxData victim in victims) {
          if (victim.entityType != callAttemptEntity) continue;
          final Object? payload;
          try {
            payload = jsonDecode(victim.payload);
          } on FormatException {
            continue;
          }
          if (payload is! Map<String, dynamic>) continue;
          final Object? path = payload['_recordingPath'];
          if (path is! String || path.isEmpty) continue;
          final File recording = File(path);
          if (recording.existsSync()) await recording.delete();
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
        .where((OutboxData v) => v.op == 'create' && v.entityType == 'prospect')
        .length;
    return DiscardPreview(operations: victims.length, prospects: prospects);
  }
}
