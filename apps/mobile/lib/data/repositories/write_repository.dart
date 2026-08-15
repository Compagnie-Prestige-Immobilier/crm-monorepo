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

/// Ce qu'un abandon a fait, ou pourquoi il n'a rien fait.
///
/// Un simple compteur ne suffisait pas : « zéro opération retirée » recouvrait
/// deux situations que l'utilisateur doit distinguer, « il n'y avait rien » et
/// « je refuse parce que c'est en cours d'envoi ». L'écran affichait donc la
/// même absence de réaction dans les deux cas, et l'utilisateur rappuyait.
enum DiscardOutcome {
  /// Les opérations ont été retirées de la file, avec leurs fiches métier.
  discarded,

  /// Refusé : au moins une des lignes visées porte une réservation d'envoi.
  claimed,

  /// Il n'y avait rien à abandonner.
  notFound,
}

/// Résultat d'un [WriteRepository.discardOperation].
class DiscardResult {
  const DiscardResult(this.outcome, {this.removed = 0});

  final DiscardOutcome outcome;

  /// Nombre d'opérations réellement retirées de la file (cascade comprise).
  final int removed;
}

/// Une réservation d'envoi est apparue entre la lecture et l'écriture.
///
/// Levée pour **annuler la transaction** : c'est le seul moyen, en drift, de
/// défaire des suppressions déjà émises dans le même bloc. Elle ne sort jamais
/// de [WriteRepository].
class _ClaimRace implements Exception {
  const _ClaimRace();
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

/// Toutes les écritures métier de l'app passent par ici : **Dart pur**.
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
/// * après (1), la ligne existe mais ne partira jamais : le commercial la voit
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
    /// IEF de rattachement, facultative. Voir `iefs` dans `schema.drift`.
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
        // `baseRev` transforme une écriture aveugle en écriture conditionnelle :
        // si le serveur a bougé entre-temps, il répond `REV_CONFLICT` au lieu
        // d'écraser en silence la modification d'un autre appareil.
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

  // ── Phase 2 : tentative d'appel ────────────────────────────────────────────

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

  /// L'opération ouverte de plus petit `seq` pour cette entité, ou `null`.
  ///
  /// C'est celle qui partira ensuite, donc celle qui décrit l'état visible par
  /// l'utilisateur : les deux vues SQL de `schema.drift` la définissent
  /// exactement pareil.
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

  // ── Réservation d'envoi ────────────────────────────────────────────────────

  /// Vrai si une réservation d'envoi vit encore sur cette ligne.
  ///
  /// ═══ UN BAIL EXPIRÉ NE PROUVE PAS QUE PERSONNE N'ENVOIE ═══
  ///
  /// C'est toute la raison d'être du jeton de possession. `SyncEngine.claimBatch`
  /// écrit le bail ET le jeton dans la même instruction ; le bail dit *jusqu'à
  /// quand* on espérait avoir fini, le jeton dit *que quelqu'un est parti avec
  /// la ligne*. Sur un lien 2G, un `push` dépasse couramment les deux minutes de
  /// bail : la ligne est alors `syncing`, bail périmé, jeton posé, **requête en
  /// vol**. Se fier au bail seul, comme le faisait l'abandon, revenait à
  /// déclarer sûre exactement la ligne la plus dangereuse de la file.
  ///
  /// Le statut est testé en plus du jeton, et pas à la place : c'est la même
  /// condition vue par ses deux faces, et une ligne `syncing` sans jeton (héritée
  /// d'un build antérieur au jeton, ou posée à la main) doit être traitée comme
  /// en vol, pas comme libre.
  ///
  /// **Ce que ce verrou ne couvre pas, et qu'aucun verrou local ne peut
  /// couvrir.** `SyncEngine.reclaimExpiredLeases` efface le jeton d'un isolat
  /// présumé mort alors que sa requête peut encore être physiquement sur le fil.
  /// Après cette reprise, la ligne est de nouveau abandonnable alors qu'un
  /// envoi fantôme peut encore aboutir côté serveur. C'est le risque résiduel
  /// que la reprise assume déjà par ailleurs (l'idempotence par `opId` le rend
  /// inoffensif pour un renvoi, pas pour une suppression). Le jeton ferme la
  /// grande fenêtre, celle qui dure le temps d'un envoi lent ; il ne ferme pas
  /// celle-là.
  static bool _isClaimed(OutboxData row) =>
      row.claimToken != null || row.status == OutboxStatus.syncing;

  /// La traduction SQL de « personne ne possède cette ligne ».
  ///
  /// Jumelle obligatoire de [_isClaimed] : la lire en Dart puis écrire sans la
  /// reposer dans le `WHERE` laisse précisément la fenêtre qu'on prétend
  /// fermer. C'est le pendant de `SyncEngine._ownedBy` pour les actions
  /// manuelles : le moteur écrit « cette ligne, **et si je la possède
  /// encore** », l'utilisateur écrit « cette ligne, **et si personne ne la
  /// possède** ». Même mécanisme, polarité opposée.
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

    /// Corriger sur place au lieu d'empiler, quand la tête est bloquée.
    ///
    /// **C'est la seule façon dont une correction peut sortir du téléphone.**
    /// Une `create` en `conflict` reste la tête de sa `dependencyKey` : le
    /// sélecteur ignore alors la clé entière (ADR 0001 §2). Empiler un `update`
    /// derrière elle produisait donc une opération que rien n'émettrait jamais,
    /// pendant que l'écran « À corriger » continuait d'afficher l'ANCIENNE
    /// erreur, sur l'ANCIEN contenu. L'utilisateur corrigeait, réessayait, et
    /// voyait le même refus : il ne pouvait pas savoir que sa correction dormait
    /// dans une opération inatteignable.
    bool amendBlockedHead = false,
  }) async {
    if (amendBlockedHead) {
      final OutboxData? head = await headOperation(entityType, entityId);
      if (head != null &&
          OutboxStatus.needsAttention.contains(head.status) &&
          head.op != 'delete' &&
          !_isClaimed(head)) {
        final bool amended = await _amendInPlace(
          head: head,
          payload: payload,
          now: now,
          baseRev: baseRev,
        );
        // Amendement refusé : la ligne a été réservée entre la lecture et
        // l'écriture. On empile, voir [_amendInPlace].
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

  /// Réécrit le payload d'une opération bloquée et la relance.
  ///
  /// Le nouveau contenu est **fusionné** sur l'ancien, il ne le remplace pas :
  /// une `create` porte des champs qu'un `update` n'envoie pas
  /// (`clientCreatedAt`), et les perdre ferait refuser la création par le
  /// serveur pour un champ obligatoire manquant. L'opération garde donc sa
  /// nature : on corrige ce qu'elle dit, pas ce qu'elle fait.
  ///
  /// ═══ UN PAYLOAD CORRIGÉ EST UNE OPÉRATION NEUVE, DONC UN `opId` NEUF ═══
  ///
  /// La correction gardait l'`opId` d'origine et n'effaçait que le `batchId`.
  /// C'était insuffisant, parce que l'idempotence du serveur a DEUX niveaux :
  /// le lot (`Idempotency-Key`) et **l'opération** (`claimOperation`,
  /// `sync.service.ts`), qui mémorise un verdict par `opId` et le réémet tel
  /// quel. La séquence perdait la correction sans laisser de trace :
  ///
  /// 1. l'envoi applique le payload P1, le serveur enregistre l'`opId` ;
  /// 2. la réponse est illisible, le client la classe terminale, la ligne
  ///    passe en `failed` ;
  /// 3. l'utilisateur corrige, P2 est écrit sous le MÊME `opId` ;
  /// 4. au rejeu, `claimOperation` reconnaît l'`opId` et rend le verdict
  ///    mémorisé, celui de P1 ;
  /// 5. le client lit un `duplicate` sans erreur, marque la ligne `done`.
  ///
  /// P2 n'est jamais parti, il a quitté la file, et un pull ultérieur restaure
  /// P1 par-dessus. L'utilisateur voit sa correction s'enregistrer, puis
  /// disparaître.
  ///
  /// Le `opId` est donc renouvelé, **dans la même instruction que le payload**,
  /// donc dans la même transaction : les deux ne peuvent pas diverger. Rien
  /// n'est à défaire côté serveur : l'ancienne opération a réellement eu lieu,
  /// et son verdict mémorisé reste juste pour ce qu'elle était.
  ///
  /// ═══ ET L'AMENDEMENT NE VOLE JAMAIS UNE RÉSERVATION ═══
  ///
  /// L'écriture désignait la ligne par son seul `seq`, et remettait
  /// inconditionnellement `claim_token` à NULL. Écrite ainsi, elle est la seule
  /// mutation d'une ligne d'outbox qui **efface la possession de quelqu'un
  /// d'autre** au lieu de la respecter : si un envoi était parti avec cette
  /// ligne, l'amendement lui retirait sa ligne sous les pieds, lui donnait un
  /// `opId` neuf, et la même intention utilisateur pouvait s'appliquer deux fois
  /// côté serveur, une fois sous l'ancien identifiant encore en vol, une fois
  /// sous le nouveau.
  ///
  /// La condition est donc reposée dans le `WHERE` ([_unclaimed]) et le nombre
  /// de lignes touchées est relu : le lire en Dart puis écrire sans le reposer
  /// laisse exactement la fenêtre qu'on prétend fermer.
  ///
  /// **Ce qu'on fait quand la ligne est réservée : on empile, on ne refuse
  /// pas.** Les trois issues possibles étaient attendre, refuser, ou n'amender
  /// que si la ligne est libre :
  ///
  /// * **attendre** demanderait de tenir la transaction d'enregistrement
  ///   ouverte le temps d'un envoi réseau, c'est-à-dire de bloquer toute la base
  ///   pendant une minute sur un lien lent ;
  /// * **refuser** ferait remonter une exception depuis `updateProspect` ou
  ///   `updateRepresentant`, donc annulerait la transaction appelante, donc
  ///   **perdrait aussi l'écriture de la fiche métier**. C'est très exactement
  ///   la promesse que cette classe ne rompt jamais : il n'existe aucun état
  ///   atteignable où la frappe de l'utilisateur est perdue après qu'il a appuyé
  ///   sur Enregistrer. Un défaut de concurrence ne justifie pas de la
  ///   rétablir ;
  /// * **empiler** est ce qui reste, et c'est correct : une ligne réservée est
  ///   une ligne en cours d'envoi, donc pas une chaîne empoisonnée, donc rien
  ///   n'empêche l'opération suivante de partir derrière elle. La correction
  ///   devient une opération de plus dans la file au lieu d'une réécriture de
  ///   celle qui vole. Elle n'est ni perdue, ni silencieuse : elle est visible
  ///   dans le compteur d'attente et repart au prochain cycle.
  ///
  /// Renvoie `true` si la ligne a réellement été amendée, `false` s'il faut
  /// empiler à la place.
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
        // Contenu neuf, donc opération neuve : voir la doc ci-dessus.
        id: Value<String>(Ids.newId()),
        payload: Value<String>(jsonEncode(merged)),
        payloadVersion: const Value<int>(SyncEngine.payloadVersion),
        // Une création corrigée reste une création : la fiche n'existe pas
        // encore côté serveur, donc il n'y a aucune révision à opposer.
        baseRev: head.op == 'create' ? const Value<int?>(null) : Value<int?>(baseRev),
        status: const Value<String>(OutboxStatus.pending),
        // L'utilisateur vient d'agir : les compteurs repartent de zéro, sinon sa
        // correction mourrait au premier échec avec huit essais déjà épuisés.
        attempts: const Value<int>(0),
        blockedAttempts: const Value<int>(0),
        nextAttemptAt: Value<DateTime>(now),
        leaseUntil: const Value<DateTime?>(null),
        claimToken: const Value<String?>(null),
        // Contenu différent, donc clé d'idempotence différente. Rejouer
        // l'ancienne ferait rendre au serveur le verdict mémorisé du contenu
        // ERRONÉ, c'est-à-dire le refus que l'utilisateur vient de corriger.
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

  // ── File « À corriger » ────────────────────────────────────────────────────

  /// Remet une opération bloquée en file, immédiatement et compteur remis à zéro.
  ///
  /// Le compteur repart de zéro parce que l'utilisateur vient d'agir : soit il a
  /// corrigé la saisie, soit il sait quelque chose que l'app ignore (le réseau
  /// est revenu, le doublon a été supprimé côté web). Conserver huit tentatives
  /// épuisées ferait mourir sa correction au premier échec.
  /// **Le filtre sur `status` n'est pas une précaution, c'est la correction.**
  /// Un `seq` désigne aussi bien une ligne en `syncing`, bail vivant, requête en
  /// vol. La remettre en `pending` et effacer son bail la rend immédiatement
  /// resélectionnable : le lot repart sous une clé d'idempotence neuve pendant
  /// que le premier envoi est encore en cours, et le serveur applique deux fois
  /// une écriture qu'il ne peut plus rapprocher. L'écran « À corriger » ne
  /// montre que `conflict` et `failed` : ce sont donc les seuls états qu'un
  /// « Réessayer » a le droit de toucher.
  ///
  /// Renvoie `true` si une ligne a réellement été remise en file.
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

  /// Supprime **une seule** opération, sans cascade et sans toucher aux lignes
  /// métier.
  ///
  /// Le seul appelant légitime est la résolution « Rattacher mes prospects » :
  /// après un remappage, la création du représentant est devenue inutile : la
  /// fiche existe déjà côté serveur : mais ses prospects, eux, viennent d'être
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
  ///
  /// ═══ POURQUOI LE BAIL NE DÉCIDE PLUS RIEN ICI ═══
  ///
  /// La garde lisait « `syncing` **et** bail encore valide ». Elle déclarait
  /// donc abandonnable la ligne la plus dangereuse de la file : celle dont
  /// l'envoi dure plus longtemps que son bail, ce qui est le cas ordinaire sur
  /// un lien 2G. La suite est mécanique : la suppression retire la ligne
  /// d'outbox et la fiche métier pendant que le serveur applique la requête, le
  /// verdict revient et ne trouve plus de ligne où atterrir, et il reste côté
  /// serveur un enregistrement que rien sur ce téléphone ne sait plus
  /// rattacher : ni la liste, ni « À corriger », ni le prochain pull, qui le
  /// ramènerait comme une fiche neuve que personne n'a demandée. Les données
  /// locales, elles, sont parties.
  ///
  /// On lit donc la **possession** ([_isClaimed]) et non l'échéance, et on la
  /// repose dans le `WHERE` de la suppression ([_unclaimed]) : lue en Dart puis
  /// non reposée, elle ne fermerait pas la fenêtre qu'elle prétend fermer.
  ///
  /// **La cascade est vérifiée en entier, pas seulement la ligne visée.**
  /// Abandonner la création d'un représentant emporte tous ses prospects : ils
  /// sont réservés et envoyés dans le même lot que lui, donc les ignorer
  /// revenait à ne contrôler qu'une des lignes qu'on supprime.
  ///
  /// **Un refus est rendu, pas silencieux.** L'attente est bornée : la reprise
  /// des baux expirés (`SyncEngine.reclaimExpiredLeases`) tourne en tête de
  /// chaque tour de vidange, réseau ou pas, et rend la ligne abandonnable dès
  /// que son porteur est présumé mort.
  Future<DiscardResult> discardOperation(int seq) async {
    try {
      return await _db.transaction(() async {
        final OutboxData? row = await (_db.select(
          _db.outbox,
        )..where((Outbox o) => o.seq.equals(seq))).getSingleOrNull();
        if (row == null) return const DiscardResult(DiscardOutcome.notFound);
        if (_isClaimed(row)) return const DiscardResult(DiscardOutcome.claimed);

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
        if (victims.any(_isClaimed)) {
          return const DiscardResult(DiscardOutcome.claimed);
        }

        // L'outbox EN PREMIER, et sous garde de possession. C'est cette
        // instruction qui décide : tant qu'elle n'a pas retiré exactement les
        // lignes qu'on a lues, aucune fiche métier ne doit disparaître.
        //
        // `seq IN (…) AND non réservé` plutôt qu'une disjonction de
        // `SyncEngine._ownedBy` ligne à ligne : les victimes viennent d'être
        // relues non réservées, les deux formes sont donc équivalentes, et
        // celle-ci ne construit pas un `OR` de deux cents termes qui frôlerait
        // la profondeur d'expression maximale de SQLite.
        final List<int> seqs = victims
            .map((OutboxData v) => v.seq)
            .toList(growable: false);
        final int removed =
            await (_db.delete(
              _db.outbox,
            )..where((Outbox o) => o.seq.isIn(seqs) & _unclaimed(o))).go();
        if (removed != victims.length) {
          // Une réservation est apparue entre la lecture et la suppression. On
          // annule tout : un abandon partiel laisserait une fiche métier sans
          // opération, ou l'inverse.
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
        // Les représentants en dernier : `ON DELETE RESTRICT` interdit d'effacer
        // un parent tant qu'un prospect le référence.
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
}
