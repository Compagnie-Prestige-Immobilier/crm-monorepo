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
  return db;
}

Future<void> insertRepresentant(
  AppDatabase db, {
  required String id,
  required String phone,
  String fullName = 'Représentant',
  String createdById = 'me',
  int rev = 1,
  DateTime? serverUpdatedAt,
  DateTime? deletedAt,
}) {
  return db
      .into(db.representants)
      .insert(
        RepresentantsCompanion.insert(
          id: id,
          fullName: fullName,
          phoneE164: phone,
          departementId: 'dep-1',
          createdById: createdById,
          clientCreatedAt: t0,
          rev: Value<int>(rev),
          localUpdatedAt: t0,
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: Value<DateTime?>(deletedAt),
        ),
      );
}

Future<void> insertProspect(
  AppDatabase db, {
  required String id,
  required String representantId,
  required String phone,
  String createdById = 'me',
  DateTime? serverUpdatedAt,
}) {
  return db
      .into(db.prospects)
      .insert(
        ProspectsCompanion.insert(
          id: id,
          nom: 'Nom',
          prenom: 'Prénom',
          phoneE164: phone,
          banqueId: 'bq-1',
          syndicatId: 'sy-1',
          representantId: representantId,
          createdById: createdById,
          clientCreatedAt: t0,
          localUpdatedAt: t0,
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
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

Future<List<OutboxData>> allOutbox(AppDatabase db) => (db.select(
  db.outbox,
)..orderBy(<OrderClauseGenerator<Outbox>>[(Outbox o) => OrderingTerm.asc(o.seq)])).get();
