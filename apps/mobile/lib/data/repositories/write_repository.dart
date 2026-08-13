import 'dart:convert';

import 'package:drift/drift.dart';

import '../../core/sync/clock.dart';
import '../../core/sync/outbox_status.dart';
import '../../core/sync/phase2_directory_sync.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/utils/ids.dart';
import '../local/database.dart';

/// Longueur maximale d'un commentaire de tentative d'appel. Valeur du `CHECK`
/// PostgreSQL `call_attempts_comment_max_length`, reprise ici pour que le champ
/// puisse la faire respecter à la frappe.
const int kCallAttemptCommentMaxLength = 2000;

/// Ce qu'une tentative d'appel peut avoir d'invalide, avec son message.
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

/// Saisie refusée **avant** l'écriture locale.
///
/// Une exception et non un `sealed` de résultat, contrairement au téléphone :
/// ici on ne valide pas à chaque frappe, on valide une fois, au moment
/// d'enregistrer, et l'écran a besoin d'un chemin d'échec net.
class CallAttemptInvalid implements Exception {
  const CallAttemptInvalid(this.problem);

  final CallAttemptProblem problem;

  String get message => problem.message;

  @override
  String toString() => 'CallAttemptInvalid(${problem.name})';
}

/// Toutes les écritures métier de l'app passent par ici — **Dart pur**.
///
/// ## L'invariant, et pourquoi il tient dans une transaction
///
/// Enregistrer, c'est **une transaction et trois instructions** :
///
/// 1. insérer (ou modifier) la ligne métier ;
/// 2. insérer l'opération d'outbox correspondante ;
/// 3. supprimer le brouillon de formulaire.
///
/// Sans transaction, chacune des trois coupures possibles perd quelque chose :
///
/// * après (1), la ligne existe mais ne partira jamais — le commercial la voit
///   dans sa liste et croit l'avoir envoyée ;
/// * après (2), le brouillon survit et l'écran propose « reprendre la saisie »
///   d'une fiche déjà enregistrée, que l'utilisateur va ressaisir, produisant un
///   doublon ;
/// * l'ordre inverse (supprimer le brouillon d'abord) perd la saisie entière si
///   l'insertion échoue.
///
/// **Il n'existe aucun état atteignable où la frappe d'un utilisateur est perdue
/// après qu'il a appuyé sur Enregistrer.** C'est testé.
///
/// ## Sur `dependencyKey`
///
/// Elle vaut toujours l'identifiant du **représentant**, y compris pour un
/// prospect. C'est ce qui rend l'ordre structurel : le prospect partage la
/// partition de son parent et porte un `seq` supérieur, donc il ne peut pas
/// partir avant lui (ADR 0001 §2).
class WriteRepository {
  WriteRepository(this._db, {Clock clock = const SystemClock()}) : _clock = clock;

  final AppDatabase _db;
  final Clock _clock;

  // ── Représentant ───────────────────────────────────────────────────────────

  /// Crée un représentant. Renvoie son identifiant local, qui est aussi celui
  /// que le serveur utilisera : les identifiants sont générés par le client
  /// (ADR 0001 §1).
  Future<String> createRepresentant({
    required String fullName,
    required String phoneE164,
    required String departementId,
    required String createdById,
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
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      await _enqueue(
        dependencyKey: id,
        entityType: 'representant',
        entityId: id,
        op: 'update',
        // `baseRev` transforme une écriture aveugle en écriture conditionnelle :
        // si le serveur a bougé entre-temps, il répond `REV_CONFLICT` au lieu
        // d'écraser en silence la modification d'un autre appareil.
        baseRev: current.serverUpdatedAt == null ? null : current.rev,
        payload: <String, Object?>{
          'fullName': fullName,
          'phone': phoneE164,
          'departementId': departementId,
          'notes': notes,
        },
        now: now,
      );
      await _dropDraft(draftId);
    });
  }

  /// Suppression **logique**, jamais physique.
  ///
  /// Une suppression physique romprait la clé étrangère des prospects
  /// (`ON DELETE RESTRICT`) et, surtout, ne pourrait plus être synchronisée : il
  /// ne resterait rien à envoyer au serveur pour lui dire d'effacer sa copie.
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
      // Les prospects rattachés suivent : côté serveur la fiche parente
      // disparaît, et laisser localement des prospects visibles pointant vers un
      // représentant supprimé produirait une liste incohérente.
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

  // ── Prospect ───────────────────────────────────────────────────────────────

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
        // La clé du PARENT, jamais celle du prospect : c'est toute la garantie
        // d'ordre du système.
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

  // ── Phase 2 — tentative d'appel ────────────────────────────────────────────

  /// Enregistre une tentative d'appel et la met en file, **en une transaction**.
  ///
  /// Trois écritures indissociables :
  ///
  /// 1. la ligne de journal dans `call_attempts` ;
  /// 2. l'opération d'outbox correspondante ;
  /// 3. le miroir optimiste sur `phase2_directory`, si l'issue est terminale.
  ///
  /// Séparées, elles laisseraient l'écran affirmer « enregistré » sur une saisie
  /// qui ne partira jamais, ou rendre un numéro déjà traité à nouveau saisissable
  /// : deux mensonges que l'utilisateur ne peut pas détecter depuis l'app.
  ///
  /// ## La validation est locale, et c'est le point
  ///
  /// Trois `CHECK` PostgreSQL gouvernent `call_attempts` côté serveur. Les
  /// découvrir à la synchronisation, c'est les découvrir potentiellement trois
  /// semaines après l'appel, quand plus personne ne se souvient de ce qui a été
  /// dit et que la correction est impossible. On refuse donc **avant** d'écrire,
  /// avec un message que le commercial peut corriger dans la seconde.
  ///
  /// Les mêmes règles sont en outre reposées en `CHECK` dans `schema.drift` : la
  /// validation Dart donne le message, le `CHECK` garantit qu'aucun chemin de
  /// code ne peut la contourner.
  Future<String> recordCallAttempt({
    required String prospectId,
    required String outcome,
    required String createdById,
    String? method,
    String? comment,
    String? id,
  }) async {
    final String? normalizedComment = normalizeComment(comment);
    final CallAttemptProblem? problem = validateCallAttempt(
      outcome: outcome,
      method: method,
      comment: normalizedComment,
    );
    if (problem != null) throw CallAttemptInvalid(problem);

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
              clientCreatedAt: now,
              createdById: createdById,
            ),
          );
      await _enqueue(
        // La clé du PROSPECT, exactement comme le serveur groupe
        // (`prospect:<id>`). Deux tentatives sur le même numéro partent donc
        // dans l'ordre où elles ont été saisies, et un rappel après un
        // « rappeler plus tard » ne double jamais le premier.
        dependencyKey: 'phase2:$prospectId',
        entityType: callAttemptEntity,
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'prospectId': prospectId,
          'outcome': outcome,
          'method': ?method,
          'comment': ?normalizedComment,
          'clientCreatedAt': now.toUtc().toIso8601String(),
        },
        now: now,
      );

      // Miroir optimiste. `rev` reste volontairement inchangée : c'est ce qui
      // permet au pull suivant de corriger si le serveur a tranché autrement.
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

  /// Un commentaire vide ou fait d'espaces vaut `null`.
  ///
  /// Le serveur applique `btrim` dans son `CHECK` et `.trim()` dans son
  /// normalisateur : sans ce ramené-à-null, un `OTHER` commenté d'une seule
  /// espace passerait la validation Dart et serait refusé par PostgreSQL.
  static String? normalizeComment(String? raw) {
    if (raw == null) return null;
    final String trimmed = raw.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  /// Les quatre règles du serveur, vérifiées ici. Renvoie `null` si tout va bien.
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
      // Le serveur REFUSE une méthode sur une autre issue, il ne l'ignore pas.
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

  // ── Outbox ─────────────────────────────────────────────────────────────────

  Future<void> _enqueue({
    required String dependencyKey,
    required String entityType,
    required String entityId,
    required String op,
    required Map<String, Object?> payload,
    required DateTime now,
    int? baseRev,
  }) {
    return _db
        .into(_db.outbox)
        .insert(
          OutboxCompanion.insert(
            id: Ids.newId(),
            dependencyKey: Value<String?>(dependencyKey),
            entityType: entityType,
            entityId: entityId,
            op: op,
            // JSON brut, jamais un objet typé sérialisé : une opération peut
            // rester en file à travers une mise à jour de l'app.
            payload: jsonEncode(payload),
            payloadVersion: const Value<int>(SyncEngine.payloadVersion),
            baseRev: Value<int?>(baseRev),
            status: const Value<String>(OutboxStatus.pending),
            // Éligible tout de suite : le premier essai ne doit pas attendre.
            nextAttemptAt: now,
            createdAt: now,
          ),
        );
  }

  Future<void> _dropDraft(String? draftId) async {
    if (draftId == null) return;
    await (_db.delete(
      _db.formDrafts,
    )..where((FormDrafts t) => t.draftId.equals(draftId))).go();
  }

  // ── File « À corriger » ────────────────────────────────────────────────────

  /// Remet une opération bloquée en file, immédiatement et compteur remis à zéro.
  ///
  /// Le compteur repart de zéro parce que l'utilisateur vient d'agir : soit il a
  /// corrigé la saisie, soit il sait quelque chose que l'app ignore (le réseau
  /// est revenu, le doublon a été supprimé côté web). Conserver huit tentatives
  /// épuisées ferait mourir sa correction au premier échec.
  Future<void> retryOperation(int seq) async {
    await (_db.update(_db.outbox)..where((Outbox o) => o.seq.equals(seq))).write(
      OutboxCompanion(
        status: const Value(OutboxStatus.pending),
        attempts: const Value<int>(0),
        nextAttemptAt: Value<DateTime>(_clock.now()),
        leaseUntil: const Value<DateTime?>(null),
        lastErrorCode: const Value<String?>(null),
        lastErrorMsg: const Value<String?>(null),
      ),
    );
  }

  /// Supprime **une seule** opération, sans cascade et sans toucher aux lignes
  /// métier.
  ///
  /// Le seul appelant légitime est la résolution « Rattacher mes prospects » :
  /// après un remappage, la création du représentant est devenue inutile — la
  /// fiche existe déjà côté serveur — mais ses prospects, eux, viennent d'être
  /// repointés vers la bonne fiche et doivent partir. Passer par
  /// [discardOperation] les emporterait avec elle, ce qui est exactement le
  /// contraire de ce que l'utilisateur vient de demander.
  Future<void> discardOwnCreateOnly(String opId) async {
    await (_db.delete(_db.outbox)..where((Outbox o) => o.id.equals(opId))).go();
  }

  /// Abandonne une opération.
  ///
  /// **Abandonner un `create` supprime en cascade toutes les opérations
  /// ultérieures de la même `dependencyKey`.** Sans cette cascade, les prospects
  /// saisis sous ce représentant partiraient vers un parent qui n'existera
  /// jamais côté serveur : le serveur répondrait `REPRESENTANT_NOT_FOUND` à
  /// chaque tentative, indéfiniment, et l'utilisateur verrait une file qui ne
  /// se vide pas sans comprendre pourquoi.
  ///
  /// Les lignes métier correspondantes sont supprimées elles aussi : les
  /// conserver afficherait des fiches que rien ne synchronisera plus jamais,
  /// avec un badge « en attente » mensonger.
  Future<int> discardOperation(int seq) async {
    return _db.transaction(() async {
      final OutboxData? row = await (_db.select(
        _db.outbox,
      )..where((Outbox o) => o.seq.equals(seq))).getSingleOrNull();
      if (row == null) return 0;

      // La cascade ne vaut QUE pour la création du représentant, tête de la
      // clé de dépendance. Abandonner cette création-là condamne tout ce qui
      // en dépend : sans la cascade, les prospects partiraient vers un parent
      // qui n'existera jamais côté serveur.
      //
      // Un prospect abandonné, lui, ne retire que lui-même : ses frères ont
      // leur propre existence et le même parent, encore valide.
      final List<OutboxData> victims;
      if (row.op == 'create' &&
          row.entityType == 'representant' &&
          row.dependencyKey != null) {
        victims =
            await (_db.select(_db.outbox)..where(
                  (Outbox o) =>
                      o.dependencyKey.equals(row.dependencyKey!) &
                      o.seq.isBiggerOrEqualValue(row.seq) &
                      o.status.isIn(OutboxStatus.open),
                ))
                .get();
      } else {
        victims = <OutboxData>[row];
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
      // Les représentants en dernier : `ON DELETE RESTRICT` interdit d'effacer
      // un parent tant qu'un prospect le référence.
      for (final OutboxData victim in victims) {
        if (victim.op == 'create' && victim.entityType == 'representant') {
          await (_db.delete(
            _db.representants,
          )..where((Representants t) => t.id.equals(victim.entityId))).go();
        }
      }

      await (_db.delete(
        _db.outbox,
      )..where((Outbox o) => o.seq.isIn(victims.map((OutboxData v) => v.seq)))).go();
      return victims.length;
    });
  }
}
