import 'dart:convert';

import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';

/// Instant fixe : un test qui dépend de `DateTime.now()` est un test qui
/// échouera un jour sans que rien n'ait changé.
final DateTime t0 = DateTime.utc(2026, 8, 12, 9);

/// Base en mémoire, référentiels minimaux déjà posés, clés étrangères actives.
///
/// `PRAGMA foreign_keys = ON` n'est pas cosmétique ici : sans lui, le
/// `ON UPDATE CASCADE` de `prospects.representant_id` : qui porte toute la
/// résolution de doublon : ne se déclenche pas, et les tests de remappage
/// passeraient pour de mauvaises raisons.
Future<AppDatabase> openTestDatabase() async {
  final AppDatabase db = AppDatabase(NativeDatabase.memory());
  await seedReferentials(db);
  return db;
}

/// Les mêmes référentiels, posés sur une base déjà ouverte.
///
/// Extrait d'[openTestDatabase] pour les tests qui ont besoin d'une SOUS-CLASSE
/// d'[AppDatabase] : observer un entrelacement suppose de pouvoir s'intercaler
/// entre deux instructions, ce qu'aucun paramètre de fabrique ne permet.
Future<void> seedReferentials(AppDatabase db) async {
  await db.customStatement('PRAGMA foreign_keys = ON;');
  await db
      .into(db.departements)
      .insert(
        DepartementsCompanion.insert(
          id: 'dep-1',
          code: 'DK',
          name: 'Dakar',
          regionId: 'reg-1',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.banques)
      .insert(
        BanquesCompanion.insert(
          id: 'bq-1',
          name: 'Banque Test',
          shortName: 'BT',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.syndicats)
      .insert(
        SyndicatsCompanion.insert(
          id: 'sy-1',
          name: 'Syndicat Test',
          sigle: 'ST',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.canauxProvenance)
      .insert(
        CanauxProvenanceCompanion.insert(
          id: 'cn-1',
          code: 'PARRAINAGE',
          label: 'Parrainage',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.incomeBands)
      .insert(
        IncomeBandsCompanion.insert(
          id: 'rev-1',
          code: 'B150_300',
          label: 'Revenu Test',
          minXof: const Value<int?>(150000),
          maxXof: const Value<int?>(300000),
          localUpdatedAt: t0,
        ),
      );
  // Deux professions, et l'écart EST le décor : seule l'enseignante ouvre le
  // syndicat, l'autre prouve qu'il reste fermé.
  await db
      .into(db.professions)
      .insert(
        ProfessionsCompanion.insert(
          id: 'pro-ens',
          code: 'INSTITUTEUR',
          label: 'Instituteur Test',
          isTeaching: const Value<bool>(true),
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.professions)
      .insert(
        ProfessionsCompanion.insert(
          id: 'pro-autre',
          code: 'COMPTABLE',
          label: 'Comptable Test',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.employeurs)
      .insert(
        EmployeursCompanion.insert(
          id: 'emp-min',
          code: 'MEN',
          label: 'Ministère Test',
          type: 'MINISTERE',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.employeurs)
      .insert(
        EmployeursCompanion.insert(
          id: 'emp-ent',
          code: 'SONATEL',
          label: 'Entreprise Test',
          type: 'ENTREPRISE',
          localUpdatedAt: t0,
        ),
      );
  await db
      .into(db.pays)
      .insert(
        PaysCompanion.insert(
          id: 'pays-it',
          code: 'IT',
          label: 'Italie',
          indicatif: '39',
          localUpdatedAt: t0,
        ),
      );
}

/// Donne un libellé de région au département du décor et en ajoute un second
/// dans une AUTRE région : c'est le minimum pour qu'une cascade filtre quelque
/// chose. Sans libellé, l'étape « Région » se masque, et c'est voulu.
Future<void> seedRegion(
  AppDatabase db, {
  required String regionId,
  required String regionName,
  String departementId = 'dep-bakel',
  String departementName = 'Bakel',
}) async {
  await (db.update(db.departements)
        ..where((Departements t) => t.id.equals('dep-1')))
      .write(const DepartementsCompanion(regionName: Value<String>('Dakar')));
  await db
      .into(db.departements)
      .insert(
        DepartementsCompanion.insert(
          id: departementId,
          code: 'BK',
          name: departementName,
          regionId: regionId,
          regionName: Value<String>(regionName),
          localUpdatedAt: t0,
        ),
      );
}

Future<void> insertRepresentant(
  AppDatabase db, {
  required String id,
  required String phone,
  String fullName = 'Représentant',
  String? notes,
  String createdById = 'me',
  String relationStatus = 'INCONNU',
  String? statutQualificationId,
  String whatsappStatus = 'NON_DEMANDE',
  String? whatsappE164,
  String? profession,
  String? prenom,
  String? etablissement,
  String? syndicat,
  bool? connaitUES,
  bool? contacte,
  int rev = 1,
  DateTime? serverUpdatedAt,
  DateTime? deletedAt,
  String? lastCallOutcome,
  DateTime? lastCallAt,
  String? lastCallById,
  int callAttemptCount = 0,
}) {
  return db
      .into(db.representants)
      .insert(
        RepresentantsCompanion.insert(
          id: id,
          fullName: fullName,
          phoneE164: phone,
          notes: Value<String?>(notes),
          departementId: 'dep-1',
          relationStatus: Value<String>(relationStatus),
          statutQualificationId: Value<String?>(statutQualificationId),
          whatsappStatus: Value<String>(whatsappStatus),
          whatsappE164: Value<String?>(whatsappE164),
          profession: Value<String?>(profession),
          prenom: Value<String?>(prenom),
          etablissement: Value<String?>(etablissement),
          syndicat: Value<String?>(syndicat),
          connaitUes: Value<bool?>(connaitUES),
          contacte: Value<bool?>(contacte),
          createdById: createdById,
          clientCreatedAt: t0,
          rev: Value<int>(rev),
          localUpdatedAt: t0,
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: Value<DateTime?>(deletedAt),
          lastCallOutcome: Value<String?>(lastCallOutcome),
          lastCallAt: Value<DateTime?>(lastCallAt),
          lastCallById: Value<String?>(lastCallById),
          callAttemptCount: Value<int>(callAttemptCount),
        ),
      );
}

Future<void> insertProspect(
  AppDatabase db, {
  required String id,
  required String representantId,
  required String phone,
  String nom = 'Nom',
  String prenom = 'Prénom',
  String createdById = 'me',
  String projet = 'CHUES',
  DateTime? serverUpdatedAt,
  DateTime? deletedAt,
}) {
  return db
      .into(db.prospects)
      .insert(
        ProspectsCompanion.insert(
          id: id,
          nom: nom,
          prenom: prenom,
          deletedAt: Value<DateTime?>(deletedAt),
          phoneE164: phone,
          banqueId: const Value<String?>('bq-1'),
          syndicatId: const Value<String?>('sy-1'),
          representantId: Value<String?>(representantId),
          projet: Value<String>(projet),
          createdById: createdById,
          clientCreatedAt: t0,
          localUpdatedAt: t0,
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
        ),
      );
}

Future<void> insertVisite(
  AppDatabase db, {
  required String id,
  String? reference = 'V-2026-000412',
  required String date,
  String? time,
  String visitorName = 'Awa Ndiaye',
  String? phone,
  String? phoneE164,
  String entrepriseId = 'e1',
  String entrepriseLabel = 'CPI',
  String objetId = 'o1',
  String objetLabel = 'Achat terrain',
  String? directionId,
  String? directionLabel,
  String? destinataireId,
  String? destinataireLabel,
  String? comment,
  String createdById = 'me',
  DateTime? createdAt,
  DateTime? updatedAt,
}) {
  return db
      .into(db.visites)
      .insert(
        VisitesCompanion.insert(
          id: id,
          reference: Value<String?>(reference),
          date: date,
          time: Value<String?>(time),
          visitorName: visitorName,
          phone: Value<String?>(phone),
          phoneE164: Value<String?>(phoneE164),
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
          createdAt: createdAt ?? t0,
          updatedAt: updatedAt ?? t0,
        ),
      );
}

Future<void> insertComment(
  AppDatabase db, {
  required String id,
  required String representantId,
  required String body,
  String authorId = 'me',
  String authorName = 'Awa Sy',
  DateTime? clientCreatedAt,
}) {
  return db
      .into(db.representantComments)
      .insert(
        RepresentantCommentsCompanion.insert(
          id: id,
          representantId: representantId,
          authorId: authorId,
          authorName: authorName,
          body: body,
          clientCreatedAt: clientCreatedAt ?? t0,
        ),
      );
}

/// Met une opération en file, avec les mêmes conventions que
/// `WriteRepository._enqueue` : `dependencyKey` = identifiant du REPRÉSENTANT,
/// y compris pour un prospect.
Future<int> queueOp(
  AppDatabase db, {
  required String id,
  required String entityType,
  required String entityId,
  String? dependencyKey,
  String op = 'create',
  String status = OutboxStatus.pending,
  Map<String, Object?> payload = const <String, Object?>{},
  int attempts = 0,
  int? baseRev,
  DateTime? nextAttemptAt,
  DateTime? leaseUntil,
  String? claimToken,
}) {
  return db
      .into(db.outbox)
      .insert(
        OutboxCompanion.insert(
          id: id,
          dependencyKey: Value<String?>(dependencyKey ?? entityId),
          entityType: entityType,
          entityId: entityId,
          op: op,
          payload: jsonEncode(payload),
          status: Value<String>(status),
          attempts: Value<int>(attempts),
          baseRev: Value<int?>(baseRev),
          nextAttemptAt: nextAttemptAt ?? t0,
          leaseUntil: Value<DateTime?>(leaseUntil),
          claimToken: Value<String?>(claimToken),
          createdAt: t0,
        ),
      );
}

Future<OutboxData> outboxById(AppDatabase db, String id) =>
    (db.select(db.outbox)..where((Outbox o) => o.id.equals(id))).getSingle();

Future<List<OutboxData>> allOutbox(AppDatabase db) =>
    (db.select(db.outbox)..orderBy(<OrderClauseGenerator<Outbox>>[
          (Outbox o) => OrderingTerm.asc(o.seq),
        ]))
        .get();
