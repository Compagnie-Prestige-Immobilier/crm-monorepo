import 'dart:io';

import 'package:cpi_go/data/local/database.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/sqlite3.dart';

/// Instants fixes : un test qui dépend de `DateTime.now()` est un test qui
/// échouera un jour sans que rien n'ait changé.
final DateTime t0 = DateTime.utc(2026, 8, 12, 9);

Future<AppDatabase> _open() async {
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

Future<void> _insertRepresentant(
  AppDatabase db, {
  required String id,
  required String phone,
  DateTime? serverUpdatedAt,
  DateTime? deletedAt,
}) {
  return db
      .into(db.representants)
      .insert(
        RepresentantsCompanion.insert(
          id: id,
          fullName: 'Représentant $id',
          phoneE164: phone,
          departementId: 'dep-1',
          createdById: 'user-1',
          clientCreatedAt: t0,
          localUpdatedAt: t0,
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
          deletedAt: Value<DateTime?>(deletedAt),
        ),
      );
}

Future<void> _insertProspect(
  AppDatabase db, {
  required String id,
  required String representantId,
  required String phone,
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
          banqueId: const Value<String?>('bq-1'),
          syndicatId: const Value<String?>('sy-1'),
          representantId: Value<String?>(representantId),
          createdById: 'user-1',
          clientCreatedAt: t0,
          localUpdatedAt: t0,
          serverUpdatedAt: Value<DateTime?>(serverUpdatedAt),
        ),
      );
}

Future<void> _queueOp(
  AppDatabase db, {
  required String id,
  required String entityType,
  required String entityId,
  String op = 'create',
  String status = 'pending',
  String? dependencyKey,
  DateTime? nextAttemptAt,
}) {
  return db
      .into(db.outbox)
      .insert(
        OutboxCompanion.insert(
          id: id,
          entityType: entityType,
          entityId: entityId,
          op: op,
          payload: '{}',
          dependencyKey: Value<String?>(dependencyKey),
          status: Value<String>(status),
          nextAttemptAt: nextAttemptAt ?? t0,
          createdAt: t0,
        ),
      );
}

void main() {
  late AppDatabase db;

  setUp(() async => db = await _open());
  tearDown(() async => db.close());

  group('index unique partiel sur representants(phone_e164)', () {
    test('deux fiches vivantes ne peuvent pas partager un numéro', () async {
      await _insertRepresentant(db, id: 'r1', phone: '+221770000001');
      expect(
        () => _insertRepresentant(db, id: 'r2', phone: '+221770000001'),
        throwsA(isA<SqliteException>()),
      );
    });

    test('le numéro redevient libre après suppression logique', () async {
      // C'est TOUT l'intérêt de l'index partiel : un `UNIQUE` ordinaire
      // réserverait ce numéro à vie et le commercial ne pourrait plus jamais
      // ressaisir la fiche qu'il vient de supprimer par erreur.
      await _insertRepresentant(
        db,
        id: 'r1',
        phone: '+221770000001',
        deletedAt: t0,
      );
      await _insertRepresentant(db, id: 'r2', phone: '+221770000001');
      final List<Representant> rows = await db.select(db.representants).get();
      expect(rows, hasLength(2));
    });
  });

  group('ON UPDATE CASCADE sur prospects.representant_id', () {
    test('réécrire l\'id du représentant emporte ses prospects', () async {
      await _insertRepresentant(db, id: 'local-uuid', phone: '+221770000010');
      await _insertProspect(
        db,
        id: 'p1',
        representantId: 'local-uuid',
        phone: '+221780000001',
      );
      await _insertProspect(
        db,
        id: 'p2',
        representantId: 'local-uuid',
        phone: '+221780000002',
      );

      // Résolution d'un doublon : le serveur a renvoyé son propre identifiant.
      // Une seule instruction, pas une boucle de rattrapage.
      await db.customStatement(
        'UPDATE representants SET id = ? WHERE id = ?',
        <Object?>['server-uuid', 'local-uuid'],
      );

      final List<Prospect> prospects = await db.select(db.prospects).get();
      expect(prospects, hasLength(2));
      expect(prospects.map((Prospect p) => p.representantId).toSet(), <String>{
        'server-uuid',
      });
    });

    test(
      'un représentant référencé ne peut pas être supprimé physiquement',
      () async {
        await _insertRepresentant(db, id: 'r1', phone: '+221770000020');
        await _insertProspect(
          db,
          id: 'p1',
          representantId: 'r1',
          phone: '+221780000010',
        );
        expect(
          () => db.customStatement(
            'DELETE FROM representants WHERE id = ?',
            <Object?>['r1'],
          ),
          throwsA(isA<SqliteException>()),
        );
      },
    );
  });

  group('representant_sync_view', () {
    test('sans opération et sans horodatage serveur : draft', () async {
      await _insertRepresentant(db, id: 'r1', phone: '+221770000030');
      final RepresentantSyncViewData row =
          (await db.representantsWithStatus().get()).single;
      expect(row.syncStatus, 'draft');
    });

    test('sans opération mais déjà vu du serveur : synced', () async {
      await _insertRepresentant(
        db,
        id: 'r1',
        phone: '+221770000031',
        serverUpdatedAt: t0,
      );
      final RepresentantSyncViewData row =
          (await db.representantsWithStatus().get()).single;
      expect(row.syncStatus, 'synced');
    });

    test('le statut suit l\'opération de tête', () async {
      await _insertRepresentant(db, id: 'r1', phone: '+221770000032');
      await _queueOp(db, id: 'op1', entityType: 'representant', entityId: 'r1');
      expect(
        (await db.representantsWithStatus().get()).single.syncStatus,
        'pending',
      );

      await db.customStatement(
        'UPDATE outbox SET status = ? WHERE id = ?',
        <Object?>['syncing', 'op1'],
      );
      expect(
        (await db.representantsWithStatus().get()).single.syncStatus,
        'syncing',
      );

      await db.customStatement(
        'UPDATE outbox SET status = ? WHERE id = ?',
        <Object?>['conflict', 'op1'],
      );
      expect(
        (await db.representantsWithStatus().get()).single.syncStatus,
        'conflict',
      );
    });

    test('la tête est la plus ancienne opération non terminée', () async {
      await _insertRepresentant(
        db,
        id: 'r1',
        phone: '+221770000033',
        serverUpdatedAt: t0,
      );
      await _queueOp(
        db,
        id: 'op1',
        entityType: 'representant',
        entityId: 'r1',
        status: 'failed',
      );
      await _queueOp(
        db,
        id: 'op2',
        entityType: 'representant',
        entityId: 'r1',
        op: 'update',
      );
      // op2 est plus récente, mais op1 n'est pas passée : c'est elle qui décrit
      // la réalité pour l'utilisateur.
      expect(
        (await db.representantsWithStatus().get()).single.syncStatus,
        'failed',
      );
    });

    test('une opération terminée ne compte plus', () async {
      await _insertRepresentant(
        db,
        id: 'r1',
        phone: '+221770000034',
        serverUpdatedAt: t0,
      );
      await _queueOp(
        db,
        id: 'op1',
        entityType: 'representant',
        entityId: 'r1',
        status: 'done',
      );
      expect(
        (await db.representantsWithStatus().get()).single.syncStatus,
        'synced',
      );
    });
  });

  group('prospect_sync_view', () {
    setUp(() async {
      await _insertRepresentant(db, id: 'r1', phone: '+221770000040');
      await _insertProspect(
        db,
        id: 'p1',
        representantId: 'r1',
        phone: '+221780000020',
      );
    });

    Future<String?> statusOfP1() async {
      final ProspectSyncViewData row =
          (await db
                  .prospectsForRepresentant(representantId: 'r1', maxRows: 200)
                  .get())
              .single;
      return row.syncStatus;
    }

    test('draft quand rien n\'est parti', () async {
      expect(await statusOfP1(), 'draft');
    });

    test('blocked quand le parent est en conflit', () async {
      await _queueOp(
        db,
        id: 'opR',
        entityType: 'representant',
        entityId: 'r1',
        status: 'conflict',
      );
      await _queueOp(db, id: 'opP', entityType: 'prospect', entityId: 'p1');
      // Le prospect lui-même est simplement « pending ». Mais le pousser
      // maintenant créerait une clé étrangère orpheline : l'UI doit le dire.
      expect(await statusOfP1(), 'blocked');
    });

    test('blocked quand le parent a échoué', () async {
      await _queueOp(
        db,
        id: 'opR',
        entityType: 'representant',
        entityId: 'r1',
        status: 'failed',
      );
      expect(await statusOfP1(), 'blocked');
    });

    test('le conflit propre au prospect prime sur blocked', () async {
      await _queueOp(
        db,
        id: 'opR',
        entityType: 'representant',
        entityId: 'r1',
        status: 'failed',
      );
      await _queueOp(
        db,
        id: 'opP',
        entityType: 'prospect',
        entityId: 'p1',
        status: 'conflict',
      );
      expect(await statusOfP1(), 'conflict');
    });

    test('un parent seulement en attente ne bloque pas', () async {
      await _queueOp(db, id: 'opR', entityType: 'representant', entityId: 'r1');
      await _queueOp(db, id: 'opP', entityType: 'prospect', entityId: 'p1');
      expect(await statusOfP1(), 'pending');
    });
  });

  group('outbox', () {
    test('seq est monotone et jamais réutilisé après purge', () async {
      await _queueOp(db, id: 'op1', entityType: 'representant', entityId: 'r1');
      await _queueOp(db, id: 'op2', entityType: 'representant', entityId: 'r2');
      final List<OutboxData> first = await db.select(db.outbox).get();
      final int maxSeq = first
          .map((OutboxData o) => o.seq)
          .reduce((int a, int b) => a > b ? a : b);

      await db.customStatement('DELETE FROM outbox');
      await _queueOp(db, id: 'op3', entityType: 'representant', entityId: 'r3');
      final OutboxData reborn = (await db.select(db.outbox).get()).single;

      // AUTOINCREMENT, et pas MAX(seq)+1 : sans lui, `op3` reprendrait le seq
      // d'`op1` et un accusé de réception en retard s'appliquerait à la
      // mauvaise opération.
      expect(reborn.seq, greaterThan(maxSeq));
    });

    test('id reste unique', () async {
      await _queueOp(db, id: 'op1', entityType: 'representant', entityId: 'r1');
      expect(
        () =>
            _queueOp(db, id: 'op1', entityType: 'representant', entityId: 'r2'),
        throwsA(isA<SqliteException>()),
      );
    });

    test('les statuts hors énumération sont refusés', () async {
      expect(
        () => _queueOp(
          db,
          id: 'opX',
          entityType: 'representant',
          entityId: 'r1',
          status: 'peut-etre',
        ),
        throwsA(isA<SqliteException>()),
      );
    });

    test('claimableOutbox écarte la suite d\'une chaîne empoisonnée', () async {
      await _queueOp(
        db,
        id: 'tete-morte',
        entityType: 'representant',
        entityId: 'r1',
        dependencyKey: 'r1',
        status: 'failed',
      );
      await _queueOp(
        db,
        id: 'derriere',
        entityType: 'prospect',
        entityId: 'p1',
        dependencyKey: 'r1',
      );
      await _queueOp(
        db,
        id: 'autre-cle',
        entityType: 'representant',
        entityId: 'r2',
        dependencyKey: 'r2',
      );
      // Sans `dependency_key` : sa propre partition, rien ne l'empoisonne.
      await _queueOp(
        db,
        id: 'solo',
        entityType: 'representant',
        entityId: 'r3',
      );

      final List<OutboxData> claimable = await db
          .claimableOutbox(maxRows: 50)
          .get();
      expect(claimable.map((OutboxData o) => o.id), <String>[
        'autre-cle',
        'solo',
      ]);
    });

    test('une masse de lignes mortes ne masque pas le travail restant', () async {
      // Le sélecteur lisait « les N premières lignes ouvertes ». Un échec de lot
      // terminal en marque 200 d'un coup : la fenêtre de lecture se remplissait
      // de travail mort et le travail réel, plus loin, devenait invisible.
      for (int i = 0; i < 50; i++) {
        await _queueOp(
          db,
          id: 'mort-$i',
          entityType: 'representant',
          entityId: 'rm$i',
          dependencyKey: 'rm$i',
          status: 'failed',
        );
      }
      await _queueOp(
        db,
        id: 'vivant',
        entityType: 'representant',
        entityId: 'rv',
        dependencyKey: 'rv',
      );

      final List<OutboxData> claimable = await db
          .claimableOutbox(maxRows: 10)
          .get();
      expect(claimable.map((OutboxData o) => o.id), <String>['vivant']);
    });

    test(
      'countSchedulableOutbox ignore ce qu\'aucun worker ne débloquera',
      () async {
        await _queueOp(db, id: 'a', entityType: 'representant', entityId: 'r1');
        await _queueOp(
          db,
          id: 'b',
          entityType: 'representant',
          entityId: 'r2',
          status: 'syncing',
        );
        await _queueOp(
          db,
          id: 'c',
          entityType: 'representant',
          entityId: 'r3',
          status: 'failed',
        );
        await _queueOp(
          db,
          id: 'd',
          entityType: 'representant',
          entityId: 'r4',
          status: 'conflict',
        );

        expect(await db.countPendingOutbox().getSingle(), 4);
        expect(await db.countSchedulableOutbox().getSingle(), 2);
        // Les deux compteurs de l'écran se partagent exactement la file : ce
        // qui partira, et ce qui attend une main. Aucune ligne des deux côtés.
        expect(await db.countBlockedOutbox().getSingle(), 2);
      },
    );
  });

  test(
    'la file représentants garde seulement les tâches ouvertes dans l’ordre',
    () async {
      await _insertRepresentant(db, id: 'r1', phone: '+221770000001');
      await _insertRepresentant(db, id: 'r2', phone: '+221770000002');
      await db
          .into(db.repCallCampaigns)
          .insert(
            RepCallCampaignsCompanion.insert(
              id: 'camp-1',
              name: 'Relance CHUES',
              updatedAt: t0,
            ),
          );
      await db
          .into(db.repCallTasks)
          .insert(
            RepCallTasksCompanion.insert(
              id: 'task-2',
              campaignId: 'camp-1',
              representantId: 'r2',
              position: 2,
              updatedAt: t0,
            ),
          );
      await db
          .into(db.repCallTasks)
          .insert(
            RepCallTasksCompanion.insert(
              id: 'task-1',
              campaignId: 'camp-1',
              representantId: 'r1',
              position: 1,
              status: const Value<String>('DONE'),
              updatedAt: t0,
            ),
          );

      final List<RepCampaignQueueResult> queue = await db
          .repCampaignQueue(campaignId: 'camp-1')
          .get();

      expect(
        queue.map((RepCampaignQueueResult row) => row.representantId),
        <String>['r2'],
      );
      expect(queue.single.fullName, 'Représentant r2');
    },
  );

  group('compteurs', () {
    test('les lignes supprimées logiquement ne comptent pas', () async {
      await _insertRepresentant(db, id: 'r1', phone: '+221770000050');
      await _insertRepresentant(
        db,
        id: 'r2',
        phone: '+221770000051',
        deletedAt: t0,
      );
      expect(await db.countRepresentants().getSingle(), 1);
    });

    test('countPendingOutbox ignore les opérations terminées', () async {
      await _queueOp(db, id: 'op1', entityType: 'representant', entityId: 'r1');
      await _queueOp(
        db,
        id: 'op2',
        entityType: 'representant',
        entityId: 'r2',
        status: 'done',
      );
      await _queueOp(
        db,
        id: 'op3',
        entityType: 'representant',
        entityId: 'r3',
        status: 'failed',
      );
      expect(await db.countPendingOutbox().getSingle(), 2);
    });
  });

  group('brouillons et curseurs', () {
    test('un brouillon se relit par sa clé', () async {
      await db
          .into(db.formDrafts)
          .insert(
            FormDraftsCompanion.insert(
              draftId: 'd1',
              formKey: 'representant',
              payload: '{"fullName":"A"}',
              updatedAt: t0,
            ),
          );
      final FormDraft draft = (await db.select(db.formDrafts).get()).single;
      expect(draft.formKey, 'representant');
      expect(draft.step, 0);
      expect(draft.schemaVersion, 1);
    });

    test('le curseur de pull se stocke par collection', () async {
      await db
          .into(db.syncState)
          .insert(
            SyncStateCompanion.insert(
              collection: 'representants',
              cursor: const Value<String?>('2026-08-12T09:00:00.000Z|r1'),
              lastPulledAt: Value<DateTime?>(t0),
            ),
          );
      final SyncStateData row = (await db.select(db.syncState).get()).single;
      expect(row.cursor, '2026-08-12T09:00:00.000Z|r1');
    });
  });

  test('les DATETIME sont stockés en texte ISO-8601', () async {
    await _insertRepresentant(db, id: 'r1', phone: '+221770000060');
    final QueryRow row = await db
        .customSelect(
          'SELECT typeof(client_created_at) AS t FROM representants',
        )
        .getSingle();
    // Stockés en secondes UNIX, deux écritures faites dans la même seconde
    // deviendraient indiscernables : or c'est ce que le curseur keyset doit
    // départager.
    expect(row.read<String>('t'), 'text');
  });

  test('la base du téléphone ouvre avec ses PRAGMAs', () async {
    // Les autres tests posent `foreign_keys` eux-mêmes : la configuration
    // réelle, celle de `openAppDatabaseConnection`, n'était vérifiée nulle
    // part. Sans elle, l'isolat de fond et l'interface se bloquent
    // mutuellement et les suppressions en cascade ne se font plus.
    final Directory dir = await Directory.systemTemp.createTemp('cpi_pragmas');
    // Sur un fichier : le mode journal d'une base en mémoire vaut « memory »
    // quoi qu'on demande, et le WAL est justement ce qui laisse l'isolat de
    // fond écrire pendant que l'écran lit.
    final Database file = sqlite3.open('${dir.path}/cpi_go.sqlite');
    addTearDown(() async {
      file.close();
      await dir.delete(recursive: true);
    });

    AppDatabase.applyPragmas(file);
    String pragma(String name) =>
        '${file.select('PRAGMA $name;').first.values.first}'.toLowerCase();

    expect(pragma('journal_mode'), 'wal');
    expect(pragma('foreign_keys'), '1');
    expect(pragma('busy_timeout'), '5000');
  });
}
