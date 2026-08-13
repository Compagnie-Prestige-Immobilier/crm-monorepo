import 'dart:convert';

import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
// `isNull`/`isNotNull` existent des deux côtés : ici on parle de matchers, pas
// d'expressions SQL.
import 'package:flutter_test/flutter_test.dart';
import 'package:sqlite3/common.dart';

import '../support/db_fixture.dart';

void main() {
  late AppDatabase db;
  late FakeClock clock;
  late WriteRepository repo;
  late DraftRepository drafts;

  setUp(() async {
    db = await openTestDatabase();
    clock = FakeClock(t0);
    repo = WriteRepository(db, clock: clock);
    drafts = DraftRepository(db, clock: clock);
  });
  tearDown(() => db.close());

  Future<void> seedDraft(String draftId) => drafts.save(
    draftId: draftId,
    formKey: 'representant.create',
    values: <String, Object?>{'fullName': 'Awa Sy'},
  );

  group('l\'invariant d\'enregistrement', () {
    test('ligne métier + opération d\'outbox + suppression du brouillon', () async {
      await seedDraft('d1');
      final String id = await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        draftId: 'd1',
      );

      // 1. la ligne métier
      final Representant rep = (await db.select(db.representants).get()).single;
      expect(rep.id, id);
      expect(rep.phoneE164, '+221770000001');

      // 2. l'opération d'outbox, avec la clé de dépendance du représentant
      final OutboxData op = (await allOutbox(db)).single;
      expect(op.entityType, 'representant');
      expect(op.entityId, id);
      expect(op.op, 'create');
      expect(op.dependencyKey, id);
      expect(op.status, OutboxStatus.pending);
      expect(op.payloadVersion, SyncEngine.payloadVersion);
      // Éligible tout de suite : le premier essai ne doit pas attendre.
      expect(op.nextAttemptAt, t0);

      // 3. le brouillon a disparu — sinon l'écran proposerait « reprendre la
      //    saisie » d'une fiche déjà enregistrée, que l'utilisateur ressaisirait.
      expect(await drafts.read('d1'), isNull);
      expect(await db.select(db.formDrafts).get(), isEmpty);
    });

    test(
      'si l\'insertion échoue, le brouillon SURVIT et rien n\'est mis en file',
      () async {
        // Le numéro est déjà pris : l'index unique partiel refuse la ligne.
        await insertRepresentant(db, id: 'deja', phone: '+221770000001');
        await seedDraft('d1');

        await expectLater(
          repo.createRepresentant(
            fullName: 'Awa Sy',
            phoneE164: '+221770000001',
            departementId: 'dep-1',
            createdById: 'me',
            draftId: 'd1',
          ),
          throwsA(isA<SqliteException>()),
        );

        // C'est TOUT le point : il n'existe aucun état atteignable où la frappe de
        // l'utilisateur est perdue après qu'il a appuyé sur Enregistrer.
        expect(await drafts.read('d1'), isNotNull);
        expect(await allOutbox(db), isEmpty);
        expect((await db.select(db.representants).get()).single.id, 'deja');
      },
    );

    test('l\'ordre inverse est impossible : le brouillon ne part jamais seul', () async {
      await seedDraft('d1');
      // Une clé étrangère invalide fait échouer l'insertion métier.
      await expectLater(
        repo.createRepresentant(
          fullName: 'Awa Sy',
          phoneE164: '+221770000002',
          departementId: 'departement-inexistant',
          createdById: 'me',
          draftId: 'd1',
        ),
        throwsA(isA<SqliteException>()),
      );
      expect(await drafts.read('d1'), isNotNull);
      expect(await allOutbox(db), isEmpty);
      expect(await db.select(db.representants).get(), isEmpty);
    });

    test('les trois écritures sont dans UNE transaction', () async {
      await seedDraft('d1');
      // Une erreur levée dans la transaction de l'appelant doit tout annuler :
      // si les trois instructions committaient séparément, la ligne métier
      // resterait sans opération d'outbox — visible, jamais envoyée.
      await expectLater(
        db.transaction(() async {
          await repo.createRepresentant(
            fullName: 'Awa Sy',
            phoneE164: '+221770000003',
            departementId: 'dep-1',
            createdById: 'me',
            draftId: 'd1',
          );
          throw const _Interrupted();
        }),
        throwsA(isA<_Interrupted>()),
      );
      expect(await db.select(db.representants).get(), isEmpty);
      expect(await allOutbox(db), isEmpty);
      expect(await drafts.read('d1'), isNotNull);
    });

    test('un prospect porte la clé de dépendance de son PARENT', () async {
      final String repId = await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
      );
      await seedDraft('d2');
      final String prospectId = await repo.createProspect(
        nom: 'Diallo',
        prenom: 'Mamadou',
        phoneE164: '+221780000001',
        banqueId: 'bq-1',
        syndicatId: 'sy-1',
        representantId: repId,
        createdById: 'me',
        draftId: 'd2',
      );

      final List<OutboxData> ops = await allOutbox(db);
      expect(ops, hasLength(2));
      // Même partition, `seq` supérieur : le prospect ne PEUT pas partir avant
      // son représentant. C'est une propriété de la sélection, pas un contrôle.
      expect(ops[1].dependencyKey, repId);
      expect(ops[1].entityId, prospectId);
      expect(ops[1].seq, greaterThan(ops[0].seq));
      expect(await drafts.read('d2'), isNull);
    });

    test('une mise à jour connue du serveur emporte sa baseRev', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 7,
        serverUpdatedAt: t0,
      );
      await repo.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Sy Diop',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
      );
      // `baseRev` transforme une écriture aveugle en écriture conditionnelle.
      expect((await allOutbox(db)).single.baseRev, 7);
    });

    test('une fiche jamais vue du serveur n\'a pas de baseRev', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001', rev: 7);
      await repo.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Sy Diop',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
      );
      expect((await allOutbox(db)).single.baseRev, isNull);
    });

    test('supprimer un représentant emporte logiquement ses prospects', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(db, id: 'p1', representantId: 'repA', phone: '+221780000001');
      await repo.deleteRepresentant('repA');

      final Representant rep = (await db.select(db.representants).get()).single;
      expect(rep.deletedAt, t0);
      expect((await db.select(db.prospects).get()).single.deletedAt, t0);
      expect((await allOutbox(db)).single.op, 'delete');
    });
  });

  group('abandon d\'une opération', () {
    /// Un représentant en conflit, deux prospects derrière lui, et une autre
    /// chaîne parfaitement saine.
    Future<Map<String, int>> seedChains() async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(db, id: 'pA1', representantId: 'repA', phone: '+221780000001');
      await insertProspect(db, id: 'pA2', representantId: 'repA', phone: '+221780000002');
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await insertProspect(db, id: 'pB1', representantId: 'repB', phone: '+221780000003');

      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.conflict,
      );
      await queueOp(
        db,
        id: 'A2',
        entityType: 'prospect',
        entityId: 'pA1',
        dependencyKey: 'repA',
      );
      await queueOp(
        db,
        id: 'A3',
        entityType: 'prospect',
        entityId: 'pA2',
        dependencyKey: 'repA',
      );
      await queueOp(db, id: 'B1', entityType: 'representant', entityId: 'repB');
      await queueOp(
        db,
        id: 'B2',
        entityType: 'prospect',
        entityId: 'pB1',
        dependencyKey: 'repB',
      );

      return <String, int>{for (final OutboxData o in await allOutbox(db)) o.id: o.seq};
    }

    test('abandonner un `create` emporte toute la suite de sa clé', () async {
      final Map<String, int> seqs = await seedChains();

      final int removed = await repo.discardOperation(seqs['A1']!);

      // Sans cette cascade, les prospects partiraient vers un parent qui
      // n'existera jamais côté serveur : REPRESENTANT_NOT_FOUND à chaque
      // tentative, indéfiniment, et une file qui ne se vide pas.
      expect(removed, 3);
      final List<OutboxData> left = await allOutbox(db);
      expect(left.map((OutboxData o) => o.id), <String>['B1', 'B2']);

      // Les lignes métier partent avec : les garder afficherait des fiches que
      // rien ne synchronisera plus jamais, avec un badge « en attente » menteur.
      expect(
        (await db.select(db.representants).get()).map((Representant r) => r.id),
        <String>['repB'],
      );
      expect((await db.select(db.prospects).get()).map((Prospect p) => p.id), <String>[
        'pB1',
      ]);
    });

    test('la chaîne voisine est intacte', () async {
      final Map<String, int> seqs = await seedChains();
      await repo.discardOperation(seqs['A1']!);
      expect((await outboxById(db, 'B1')).status, OutboxStatus.pending);
      expect((await outboxById(db, 'B2')).dependencyKey, 'repB');
    });

    test('abandonner un prospect ne touche ni son parent ni ses frères', () async {
      final Map<String, int> seqs = await seedChains();
      final int removed = await repo.discardOperation(seqs['A2']!);
      expect(removed, 1);
      final List<OutboxData> left = await allOutbox(db);
      expect(left.map((OutboxData o) => o.id), <String>['A1', 'A3', 'B1', 'B2']);
      expect((await db.select(db.prospects).get()).map((Prospect p) => p.id), <String>[
        'pA2',
        'pB1',
      ]);
    });

    test('abandonner un `update` ne supprime que lui-même', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        status: OutboxStatus.failed,
      );
      final OutboxData u1 = await outboxById(db, 'U1');
      expect(await repo.discardOperation(u1.seq), 1);
      expect(await allOutbox(db), isEmpty);
      // La fiche existe côté serveur : la supprimer localement la ferait
      // revenir au prochain pull, en donnant l'illusion d'un bug.
      expect(await db.select(db.representants).get(), hasLength(1));
    });

    test('discardOwnCreateOnly laisse partir les prospects repointés', () async {
      final Map<String, int> seqs = await seedChains();
      expect(seqs, contains('A1'));
      // « Rattacher mes prospects » : la création du représentant est devenue
      // inutile, mais ses prospects viennent d'être repointés et doivent partir.
      await repo.discardOwnCreateOnly('A1');
      final List<OutboxData> left = await allOutbox(db);
      expect(left.map((OutboxData o) => o.id), <String>['A2', 'A3', 'B1', 'B2']);
      expect(await db.select(db.prospects).get(), hasLength(3));
    });

    test('abandonner une opération inexistante ne fait rien', () async {
      await seedChains();
      expect(await repo.discardOperation(99999), 0);
      expect(await allOutbox(db), hasLength(5));
    });
  });

  group('reprise manuelle', () {
    test('retryOperation remet le compteur à zéro et rend la ligne due', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.failed,
        attempts: 8,
        nextAttemptAt: t0.add(const Duration(days: 1)),
      );
      final OutboxData before = await outboxById(db, 'A1');
      clock.advance(const Duration(minutes: 5));
      await repo.retryOperation(before.seq);

      final OutboxData after = await outboxById(db, 'A1');
      expect(after.status, OutboxStatus.pending);
      // L'utilisateur vient d'agir : conserver huit tentatives épuisées ferait
      // mourir sa correction au premier échec.
      expect(after.attempts, 0);
      expect(after.nextAttemptAt, clock.now());
      expect(after.lastErrorCode, isNull);
      expect(after.leaseUntil, isNull);
    });
  });

  group('payload', () {
    test('le payload est du JSON brut, relisible après mise à jour de l\'app', () async {
      await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        notes: 'Marché de Thiaroye',
      );
      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload) as Map<String, Object?>;
      expect(payload['fullName'], 'Awa Sy');
      expect(payload['phone'], '+221770000001');
      expect(payload['departementId'], 'dep-1');
      expect(payload['notes'], 'Marché de Thiaroye');
      expect(payload['clientCreatedAt'], t0.toIso8601String());
    });

    test('une note vide n\'est pas envoyée', () async {
      await repo.createRepresentant(
        fullName: 'Awa Sy',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        notes: '',
      );
      final Map<String, Object?> payload =
          jsonDecode((await allOutbox(db)).single.payload) as Map<String, Object?>;
      expect(payload.containsKey('notes'), isFalse);
    });
  });
}

class _Interrupted implements Exception {
  const _Interrupted();
}
