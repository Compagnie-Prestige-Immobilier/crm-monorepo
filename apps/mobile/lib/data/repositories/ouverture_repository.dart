import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart';

import '../../core/sync/api_port.dart';
import '../../core/sync/clock.dart';
import '../../core/sync/outbox_status.dart';
import '../../core/sync/sync_engine.dart';
import '../../core/utils/ids.dart';
import '../local/database.dart';

/// La fiche qu'un compte tient déjà. [ficheNom] est nul quand elle vient de la
/// base locale, qui ne porte pas le nom : l'écran le retrouve au référentiel.
typedef FicheTenue = ({
  String id,
  String? representantId,
  String? prospectId,
  String? ficheNom,
});

/// Ce que l'ouverture a donné.
///
/// [tenue] non nulle : le compte tient DÉJÀ une autre fiche, et c'est elle que
/// l'écran doit proposer de rouvrir. Le serveur refuse sans la nommer, seule
/// `GET /v1/ouvertures/courante` la dit.
typedef OuvertureResultat = ({OuverturesFicheData? ouverte, FicheTenue? tenue});

/// Le brouillon part sans ses réponses nulles : le contrat les type `Object`,
/// et une réponse absente se relit de toute façon comme nulle.
Map<String, Object> _sansNuls(Map<String, Object?> draft) => <String, Object>{
  for (final MapEntry<String, Object?> reponse in draft.entries)
    if (reponse.value != null) reponse.key: reponse.value!,
};

class OuvertureRepository {
  OuvertureRepository(this._db, this._api, {Clock clock = const SystemClock()})
    : _clock = clock;

  final AppDatabase _db;
  final ApiPort _api;
  final Clock _clock;

  /// La fiche que ce compte tient sur CET appareil. Le verrou se lit d'abord
  /// ici : hors ligne, le serveur ne répond pas et la fiche en cours doit
  /// quand même se rouvrir.
  Future<OuverturesFicheData?> courante(String openedById) =>
      _db.ouvertureCourante(openedById: openedById).getSingleOrNull();

  Stream<OuverturesFicheData?> watchCourante(String openedById) =>
      _db.ouvertureCourante(openedById: openedById).watchSingleOrNull();

  Future<OuverturesFicheData?> parId(String id) => (_db.select(
    _db.ouverturesFiche,
  )..where((OuverturesFiche o) => o.id.equals(id))).getSingleOrNull();

  /// Confirme l'ouverture. Le serveur est consulté EN PREMIER quand le réseau
  /// répond : c'est le seul endroit où le verrou d'un autre appareil se voit.
  /// Sans réseau la ligne part en file et l'écran s'ouvre quand même.
  Future<OuvertureResultat> ouvrir({
    required String openedById,
    String? representantId,
    String? prospectId,
  }) async {
    final OuverturesFicheData? deja = await courante(openedById);
    if (deja != null) {
      final bool memeFiche =
          deja.representantId == representantId &&
          deja.prospectId == prospectId;
      if (!memeFiche) return (ouverte: null, tenue: _versFicheTenue(deja));
      return (ouverte: deja, tenue: null);
    }

    final String id = Ids.newId();
    final DateTime openedAt = _clock.now();
    bool enFile = false;
    try {
      await _api.ouvrirFiche(
        OuvrirFicheDto(
          id: id,
          // `toJson` sérialise l'instant tel quel : sans `toUtc`, la chaîne
          // part sans fuseau et le serveur la relit dans le sien.
          openedAt: openedAt.toUtc(),
          representantId: representantId,
          prospectId: prospectId,
        ),
      );
    } on ApiException catch (error) {
      if (error.code == ouvertureFicheDejaOuverteCode) {
        final FicheTenue? tenue = await _tenueParLeServeur();
        if (tenue != null) return (ouverte: null, tenue: tenue);
      }
      if (!error.retryable) rethrow;
      enFile = true;
    }

    final OuverturesFicheData ligne = await _db.transaction(() async {
      final OuverturesFicheData ecrite = await _db
          .into(_db.ouverturesFiche)
          .insertReturning(
            OuverturesFicheCompanion.insert(
              id: id,
              openedById: openedById,
              representantId: Value<String?>(representantId),
              prospectId: Value<String?>(prospectId),
              openedAt: openedAt,
            ),
          );
      if (enFile) {
        await _enfiler(
          id: id,
          representantId: representantId,
          prospectId: prospectId,
          openedAt: openedAt,
          now: openedAt,
        );
      }
      return ecrite;
    });
    return (ouverte: ligne, tenue: null);
  }

  /// Le brouillon, remplacé EN ENTIER. Local d'abord : c'est lui qui rouvre le
  /// formulaire après un plantage. La remontée est au mieux, et une passe
  /// perdue est rattrapée par la suivante, qui porte le brouillon complet.
  Future<void> enregistrerBrouillon({
    required String id,
    required Map<String, Object?> draft,
  }) async {
    await (_db.update(
      _db.ouverturesFiche,
    )..where((OuverturesFiche o) => o.id.equals(id))).write(
      OuverturesFicheCompanion(draft: Value<String?>(jsonEncode(draft))),
    );
    try {
      await _api.enregistrerBrouillonOuverture(
        id: id,
        corps: EnregistrerBrouillonDto(draft: _sansNuls(draft)),
      );
    } on ApiException catch (error) {
      developer.log(
        'Brouillon d\'ouverture $id non remonté : ${error.code}',
        name: 'cpi.ouvertures',
      );
    }
  }

  /// La qualification lève le verrou. Le serveur, lui, ferme par le champ
  /// `ouvertureId` de la tentative : une ouverture inconnue ou déjà fermée y
  /// est ignorée en silence, rien ne peut donc échouer des deux côtés.
  Future<void> fermer({required String id, String? closingAttemptId}) async {
    await (_db.update(_db.ouverturesFiche)
          ..where((OuverturesFiche o) => o.id.equals(id) & o.closedAt.isNull()))
        .write(
          OuverturesFicheCompanion(
            closedAt: Value<DateTime?>(_clock.now()),
            closingAttemptId: Value<String?>(closingAttemptId),
          ),
        );
  }

  /// La libération, décidée par l'encadrement depuis le web. L'appareil ne
  /// l'apprend qu'en redemandant la fiche courante : sans cette réconciliation
  /// le verrou local tiendrait pour toujours sur une fiche déjà rendue.
  Future<OuverturesFicheData?> reconcilier(String openedById) async {
    final OuverturesFicheData? locale = await courante(openedById);
    if (locale == null) return null;
    final OuvertureFicheDto? distante;
    try {
      distante = await _api.ouvertureCourante();
    } on ApiException {
      return locale;
    }
    if (distante != null && distante.id == locale.id) return locale;
    // Le serveur ne tient plus cette ouverture : elle a été libérée ou fermée
    // ailleurs. La garder ouverte ici enfermerait le téléconseiller.
    await (_db.update(
      _db.ouverturesFiche,
    )..where((OuverturesFiche o) => o.id.equals(locale.id))).write(
      OuverturesFicheCompanion(closedAt: Value<DateTime?>(_clock.now())),
    );
    return null;
  }

  Future<FicheTenue?> _tenueParLeServeur() async {
    try {
      final OuvertureFicheDto? distante = await _api.ouvertureCourante();
      if (distante == null) return null;
      return (
        id: distante.id,
        representantId: distante.representantId,
        prospectId: distante.prospectId,
        ficheNom: distante.ficheNom,
      );
    } on ApiException {
      return null;
    }
  }

  static FicheTenue _versFicheTenue(OuverturesFicheData ligne) => (
    id: ligne.id,
    representantId: ligne.representantId,
    prospectId: ligne.prospectId,
    ficheNom: null,
  );

  Future<void> _enfiler({
    required String id,
    required String? representantId,
    required String? prospectId,
    required DateTime openedAt,
    required DateTime now,
  }) async {
    await _db
        .into(_db.outbox)
        .insert(
          OutboxCompanion.insert(
            id: Ids.newId(),
            // Même partition que les tentatives de la fiche : l'ouverture doit
            // atteindre le serveur avant la qualification qui la ferme.
            dependencyKey: Value<String?>(representantId ?? prospectId),
            entityType: ouvertureEntity,
            entityId: id,
            op: 'create',
            payload: jsonEncode(<String, Object?>{
              'id': id,
              'representantId': ?representantId,
              'prospectId': ?prospectId,
              'openedAt': openedAt.toUtc().toIso8601String(),
            }),
            payloadVersion: const Value<int>(SyncEngine.payloadVersion),
            status: const Value<String>(OutboxStatus.pending),
            nextAttemptAt: now,
            createdAt: now,
          ),
        );
  }
}
