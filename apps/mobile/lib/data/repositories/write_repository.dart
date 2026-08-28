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

const int kCallAttemptEmailMaxLength = 160;

/// Ancienneté dans l'établissement, en mois : cinquante ans de carrière.
const int kDureeEtablissementMaxMois = 600;

/// Tolérance d'horloge admise par le serveur entre la saisie et le rendez-vous.
/// Un téléphone de terrain dérive : sans elle, un rendez-vous « tout de suite »
/// serait refusé pour être né deux minutes avant son propre appel.
const Duration kRendezVousSkew = Duration(minutes: 5);

/// Le format vaut ce que vaut celui du serveur : une adresse en une arobase,
/// sans espace, avec un point dans le domaine. Il refuse les fautes de frappe,
/// il ne prétend pas décider si la boîte existe.
final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$');

enum CallAttemptProblem {
  unknownReason,
  unknownMethod,
  methodRequired,
  methodNotAllowed,
  commentRequired,
  commentTooLong,
  emailInvalid,
  dureeEtablissementInvalid,
  rendezVousRequired,
  rendezVousNotAllowed,
  rendezVousPast;

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
    CallAttemptProblem.emailInvalid =>
      'L\'adresse e-mail n\'est pas valide. Exemple : awa.sy@exemple.sn',
    CallAttemptProblem.dureeEtablissementInvalid =>
      'La durée dans l\'établissement va de 0 à $kDureeEtablissementMaxMois '
          'mois.',
    CallAttemptProblem.rendezVousRequired =>
      'Choisissez la date et l\'heure du rendez-vous.',
    CallAttemptProblem.rendezVousNotAllowed =>
      'Une date de rendez-vous ne se saisit que sur une prise de rendez-vous.',
    CallAttemptProblem.rendezVousPast =>
      'Le rendez-vous est déjà passé. Choisissez une date à venir.',
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

/// Une correction que la file ne peut plus reprendre : l'opération est déjà
/// réservée par une poussée en cours, ou n'existe plus.
class CorrectionVisiteImpossible implements Exception {
  const CorrectionVisiteImpossible(this.message);

  final String message;

  @override
  String toString() => message;
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

  /// Corrige une visite qui n'est PAS encore partie.
  ///
  /// La file ne sait pas modifier une création : l'opération est retirée — ce
  /// qui efface aussi la ligne locale (`discardOperation`) — et la visite est
  /// réinscrite sous un identifiant neuf. Le serveur ne verra qu'une visite,
  /// la bonne, et tout ceci marche hors ligne.
  Future<String> corrigerVisiteEnFile({
    required String visiteId,
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
  }) async {
    final OutboxData? creation = await headOperation('visite', visiteId);
    if (creation == null || creation.op != 'create') {
      throw const CorrectionVisiteImpossible(
        'Cette visite est déjà partie. Rechargez le registre.',
      );
    }
    final DiscardResult retrait = await discardOperation(creation.seq);
    if (retrait.outcome != DiscardOutcome.discarded) {
      throw const CorrectionVisiteImpossible(
        'Cette visite est en train de partir. Réessayez dans un instant.',
      );
    }
    return inscrireVisite(
      visitorName: visitorName,
      date: date,
      time: time,
      phone: phone,
      entrepriseId: entrepriseId,
      entrepriseLabel: entrepriseLabel,
      objetId: objetId,
      objetLabel: objetLabel,
      directionId: directionId,
      directionLabel: directionLabel,
      destinataireId: destinataireId,
      destinataireLabel: destinataireLabel,
      comment: comment,
      createdById: createdById,
    );
  }

  /// Recopie en local la correction qu'un `PATCH /visites/:id` vient
  /// d'accepter. Rien n'entre dans la file : la modification est déjà chez le
  /// serveur, et le prochain pull réécrira la ligne par-dessus.
  Future<void> appliquerCorrectionVisite({
    required String visiteId,
    required String visitorName,
    required String entrepriseId,
    required String entrepriseLabel,
    required String objetId,
    required String objetLabel,
    String? phone,
    String? directionId,
    String? directionLabel,
    String? destinataireId,
    String? destinataireLabel,
    String? comment,
  }) async {
    await (_db.update(
      _db.visites,
    )..where((Visites t) => t.id.equals(visiteId))).write(
      VisitesCompanion(
        visitorName: Value<String>(visitorName),
        phone: Value<String?>(phone),
        entrepriseId: Value<String>(entrepriseId),
        entrepriseLabel: Value<String>(entrepriseLabel),
        objetId: Value<String>(objetId),
        objetLabel: Value<String>(objetLabel),
        directionId: Value<String?>(directionId),
        directionLabel: Value<String?>(directionLabel),
        destinataireId: Value<String?>(destinataireId),
        destinataireLabel: Value<String?>(destinataireLabel),
        comment: Value<String?>(comment),
        updatedAt: Value<DateTime>(_clock.now()),
      ),
    );
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
    String? relationStatus,
    String? relationReason,
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
          relationStatus: relationStatus == null
              ? const Value<String>.absent()
              : Value<String>(relationStatus),
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
          // Absent tant que rien n'a bougé : le serveur ne rejoue une bascule
          // que sur une demande explicite, un renvoi systematique remplirait la
          // chronologie de la relation de lignes sans geste derriere.
          'relationStatus': ?relationStatus,
          'relationReason': ?relationReason,
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

    return _db.transaction<String>(() async {
      final Prospect? existing =
          await (_db.select(_db.prospects)
                ..where(
                  (Prospects row) =>
                      row.phoneE164.equals(phoneE164) & row.deletedAt.isNull(),
                )
                ..limit(1))
              .getSingleOrNull();
      // Le meme numero rejoint un second projet : on lui OUVRE un parcours, on
      // ne deplace pas la fiche. Reecrire `projet` la retirerait du projet
      // d'origine, ou elle a deja son historique et ses appels.
      final bool dejaDansLeProjet =
          existing != null &&
          await _hasJourney(existing.id, projet ?? existing.projet);
      if (existing != null && projet != null && !dejaDansLeProjet) {
        await _openJourney(existing.id, projet);
        await (_db.update(
          _db.prospects,
        )..where((Prospects row) => row.id.equals(existing.id))).write(
          ProspectsCompanion(
            type: Value<String?>(type ?? existing.type),
            profession: Value<String?>(profession ?? existing.profession),
            dureeSystemeMois: Value<int?>(
              dureeSystemeMois ?? existing.dureeSystemeMois,
            ),
            canalProvenanceId: Value<String?>(
              canalProvenanceId ?? existing.canalProvenanceId,
            ),
            localUpdatedAt: Value<DateTime>(now),
          ),
        );
        await _enqueue(
          dependencyKey: existing.id,
          entityType: 'prospect',
          entityId: existing.id,
          op: 'update',
          baseRev: existing.serverUpdatedAt == null ? null : existing.rev,
          payload: <String, Object?>{
            // `phone` est exige sur TOUTE operation de prospect, mise a jour
            // comprise : sans lui le lot repart en `invalid` et le second
            // parcours n'atteint jamais le serveur.
            'phone': phoneE164,
            'projet': projet,
            'type': ?type,
            if (profession != null && profession.isNotEmpty)
              'profession': profession,
            'dureeSystemeMois': ?dureeSystemeMois,
            'canalProvenanceId': ?canalProvenanceId,
          },
          now: now,
        );
        await _dropDraft(draftId);
        return existing.id;
      }
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
              dureeSystemeMois: Value<int?>(dureeSystemeMois),
              canalProvenanceId: Value<String?>(canalProvenanceId),
              createdById: createdById,
              clientCreatedAt: now,
              localUpdatedAt: now,
            ),
          );
      await _openJourney(entityId, projet ?? 'CHUES');
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
      return entityId;
    });
  }

  /// Le parcours s'ecrit des la saisie, sans attendre le serveur : hors ligne,
  /// la fiche doit apparaitre tout de suite dans la liste de son projet.
  Future<void> _openJourney(String prospectId, String projet) {
    return _db
        .into(_db.prospectJourneys)
        .insert(
          ProspectJourneysCompanion.insert(
            prospectId: prospectId,
            projet: projet,
          ),
          mode: InsertMode.insertOrIgnore,
        );
  }

  Future<bool> _hasJourney(String prospectId, String projet) async {
    final ProspectJourney? row =
        await (_db.select(_db.prospectJourneys)..where(
              (ProspectJourneys j) =>
                  j.prospectId.equals(prospectId) & j.projet.equals(projet),
            ))
            .getSingleOrNull();
    return row != null;
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
  ///
  /// [nom], [prenom], [profession], [banqueId] et [syndicatId] ne sont PAS
  /// écrits en local : c'est le serveur qui les pose sur le prospect lié, et
  /// les recopier ici donnerait deux vérités à tenir d'accord jusqu'au pull.
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
    String? nom,
    String? prenom,
    String? profession,
    String? banqueId,
    String? syndicatId,
    String? email,
    bool? fonctionnaire,
    bool? engagementEnCours,
    int? dureeEtablissementMois,
    DateTime? rendezVousAt,
  }) async {
    final CallReason? reason = await resolveCallReason(
      _db,
      reasonCode ?? outcome,
    );
    if (reason == null) {
      throw const CallAttemptInvalid(CallAttemptProblem.unknownReason);
    }
    final String? normalizedComment = normalizeComment(comment);
    final String? normalizedEmail = normalizeComment(email);
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();
    final CallAttemptProblem? problem = validateCallAttempt(
      reason: reason,
      method: method,
      comment: normalizedComment,
      email: normalizedEmail,
      dureeEtablissementMois: dureeEtablissementMois,
      rendezVousAt: rendezVousAt,
      clientCreatedAt: now,
    );
    if (problem != null) throw CallAttemptInvalid(problem);

    // Le serveur refuse une heure de rappel sur une issue qui n'en programme pas.
    final DateTime? callback = reason.effect == CallEffects.scheduleCallback
        ? callbackAt
        : null;

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
              email: Value<String?>(normalizedEmail),
              fonctionnaire: Value<bool?>(fonctionnaire),
              engagementEnCours: Value<bool?>(engagementEnCours),
              dureeEtablissementMois: Value<int?>(dureeEtablissementMois),
              rendezVousAt: Value<DateTime?>(rendezVousAt),
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
          'nom': ?normalizeComment(nom),
          'prenom': ?normalizeComment(prenom),
          'profession': ?normalizeComment(profession),
          'banqueId': ?banqueId,
          'syndicatId': ?syndicatId,
          'email': ?normalizedEmail,
          // Le `?` n'omet que le NUL : `false` est une réponse et part, là où
          // son absence se lirait « question non posée ».
          'fonctionnaire': ?fonctionnaire,
          'engagementEnCours': ?engagementEnCours,
          'dureeEtablissementMois': ?dureeEtablissementMois,
          'rendezVousAt': ?rendezVousAt?.toUtc().toIso8601String(),
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

  Future<String> recordRepCallAttempt({
    required String representantId,
    required String outcome,
    String? relationStatus,
    String? whatsappStatus,
    String? whatsappE164,
    String? comment,
    DateTime? callbackAt,
    String? suggestedPhone,
    String? suggestedName,
    String? suggestedNote,
    String? id,
  }) async {
    final String entityId = id ?? Ids.newId();
    final DateTime now = _clock.now();
    final String? normalizedComment = normalizeComment(comment);
    // Le serveur ne retient le nom et la note qu'avec un numéro : sans lui, la
    // suggestion ne désigne personne et l'envoi partirait avec des restes.
    final String? suggested = normalizeComment(suggestedPhone);
    final String? suggestedFullName = suggested == null
        ? null
        : normalizeComment(suggestedName);
    final String? suggestedComment = suggested == null
        ? null
        : normalizeComment(suggestedNote);
    final String? whatsapp = whatsappStatus == null
        ? null
        : _whatsappE164For(whatsappStatus, whatsappE164);
    if (whatsappStatus == WhatsappStatus.autreNumero.code && whatsapp == null) {
      throw ArgumentError.value(whatsappE164, 'whatsappE164');
    }
    const Set<String> terminal = <String>{
      'REACHED',
      'PROSPECTS_PROMISED',
      'REFUSED',
      'WRONG_NUMBER',
    };

    await _db.transaction(() async {
      final Representant? representant =
          await (_db.select(_db.representants)
                ..where((Representants row) => row.id.equals(representantId)))
              .getSingleOrNull();
      await (_db.update(
        _db.representants,
      )..where((Representants row) => row.id.equals(representantId))).write(
        RepresentantsCompanion(
          relationStatus: relationStatus == null
              ? const Value<String>.absent()
              : Value<String>(relationStatus),
          whatsappStatus: whatsappStatus == null
              ? const Value<String>.absent()
              : Value<String>(whatsappStatus),
          whatsappE164: whatsappStatus == null
              ? const Value<String?>.absent()
              : Value<String?>(whatsapp),
          localUpdatedAt: Value<DateTime>(now),
        ),
      );
      if (terminal.contains(outcome)) {
        await (_db.update(_db.repCallTasks)..where(
              (RepCallTasks row) =>
                  row.representantId.equals(representantId) &
                  row.status.equals('OPEN'),
            ))
            .write(
              RepCallTasksCompanion(
                status: const Value<String>('DONE'),
                updatedAt: Value<DateTime>(now),
              ),
            );
      }
      if (callbackAt != null) {
        await _db
            .into(_db.repCallbackReminders)
            .insert(
              RepCallbackRemindersCompanion.insert(
                id: entityId,
                representantId: representantId,
                fullName: representant?.fullName ?? '',
                phoneE164: representant?.phoneE164 ?? '',
                scheduledAt: callbackAt,
                createdAt: now,
              ),
            );
      }
      await _enqueue(
        dependencyKey: representantId,
        entityType: repCallAttemptEntity,
        entityId: entityId,
        op: 'create',
        payload: <String, Object?>{
          'id': entityId,
          'representantId': representantId,
          'outcome': outcome,
          'comment': ?normalizedComment,
          'relationStatus': ?relationStatus,
          'whatsappStatus': ?whatsappStatus,
          'whatsappE164': ?whatsapp,
          'callbackAt': ?callbackAt?.toUtc().toIso8601String(),
          'suggestedPhone': ?suggested,
          'suggestedName': ?suggestedFullName,
          'suggestedNote': ?suggestedComment,
          'clientCreatedAt': now.toUtc().toIso8601String(),
        },
        now: now,
      );
    });
    return entityId;
  }

  /// Efface les rappels promis à ce représentant : l'appel qui vient d'être
  /// saisi les honore, quelle qu'en soit l'issue. Rend les identifiants effacés,
  /// qui sont ceux des notifications locales à annuler.
  ///
  /// [except] est le rappel que l'appel vient lui-même de programmer : sans lui,
  /// consigner « à rappeler » effacerait la promesse dans le geste qui la prend.
  Future<List<String>> honourRepCallbacks({
    required String representantId,
    String? except,
  }) async {
    final List<RepCallbackReminder> promis =
        await (_db.select(_db.repCallbackReminders)..where(
              (RepCallbackReminders row) =>
                  row.representantId.equals(representantId),
            ))
            .get();
    final List<String> honores = promis
        .map((RepCallbackReminder r) => r.id)
        .where((String id) => id != except)
        .toList(growable: false);
    if (honores.isEmpty) return honores;
    await (_db.delete(
      _db.repCallbackReminders,
    )..where((RepCallbackReminders row) => row.id.isIn(honores))).go();
    return honores;
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
    String? email,
    int? dureeEtablissementMois,
    DateTime? rendezVousAt,
    DateTime? clientCreatedAt,
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
    if (email != null && validateCallAttemptEmail(email) != null) {
      return CallAttemptProblem.emailInvalid;
    }
    if (dureeEtablissementMois != null &&
        (dureeEtablissementMois < 0 ||
            dureeEtablissementMois > kDureeEtablissementMaxMois)) {
      return CallAttemptProblem.dureeEtablissementInvalid;
    }
    return _validateRendezVous(method, rendezVousAt, clientCreatedAt);
  }

  /// Publique : l'écran reproche la faute de frappe SOUS le champ, pendant la
  /// saisie, et il doit le faire avec la règle exacte de l'enregistrement.
  static CallAttemptProblem? validateCallAttemptEmail(String email) =>
      email.length > kCallAttemptEmailMaxLength ||
          !_emailPattern.hasMatch(email)
      ? CallAttemptProblem.emailInvalid
      : null;

  static CallAttemptProblem? _validateRendezVous(
    String? method,
    DateTime? rendezVousAt,
    DateTime? clientCreatedAt,
  ) {
    if (method == EnrollmentMethods.appointment) {
      if (rendezVousAt == null) return CallAttemptProblem.rendezVousRequired;
      final DateTime? floor = clientCreatedAt?.subtract(kRendezVousSkew);
      if (floor != null && rendezVousAt.toUtc().isBefore(floor.toUtc())) {
        return CallAttemptProblem.rendezVousPast;
      }
      return null;
    }
    return rendezVousAt == null
        ? null
        : CallAttemptProblem.rendezVousNotAllowed;
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
          if (victim.op == 'create' && victim.entityType == 'visite') {
            await (_db.delete(
              _db.visites,
            )..where((Visites t) => t.id.equals(victim.entityId))).go();
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
