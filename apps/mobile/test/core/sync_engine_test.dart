import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/stub_api.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/sync_engine_factory.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:crm_api_client/crm_api_client.dart';
// `isNull`/`isNotNull` existent des deux côtés : ici on parle de matchers, pas
// d'expressions SQL.
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

void main() {
  group('pureté de lib/core/sync', () {
    // Contrainte d'architecture vérifiée mécaniquement plutôt que par revue :
    // le worker WorkManager n'a ni arbre de widgets, ni conteneur Riverpod, ni
    // plugins. Un import Flutter glissé ici ne casserait rien avant la
    // production, sur un appareil hors ligne.
    test('aucun fichier n\'importe flutter ni flutter_riverpod', () {
      final Directory dir = Directory('lib/core/sync');
      expect(dir.existsSync(), isTrue, reason: 'exécuter depuis apps/mobile');

      final List<String> offenders = <String>[];
      for (final FileSystemEntity entity in dir.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        for (final String line in entity.readAsLinesSync()) {
          final String trimmed = line.trim();
          if (!trimmed.startsWith('import ') &&
              !trimmed.startsWith('export ')) {
            continue;
          }
          if (trimmed.contains('package:flutter/') ||
              trimmed.contains('package:flutter_riverpod/') ||
              trimmed.contains('package:flutter_localizations/') ||
              trimmed.contains('package:drift_flutter/') ||
              trimmed.contains('package:flutter_secure_storage/') ||
              trimmed.contains('package:shared_preferences/')) {
            offenders.add('${entity.path}: $trimmed');
          }
        }
      }
      expect(offenders, isEmpty);
    });

    test('la base elle-même reste ouvrable hors Flutter', () {
      final File file = File('lib/data/local/database.dart');
      final String source = file.readAsStringSync();
      expect(source, isNot(contains('package:flutter/')));
      expect(source, isNot(contains('package:drift_flutter/')));
    });
  });

  group('buildSyncEngine', () {
    late AppDatabase db;

    setUp(() => db = AppDatabase(NativeDatabase.memory()));
    tearDown(() => db.close());

    test('assemble le moteur à partir des quatre collaborateurs', () {
      final SyncEngine engine = buildSyncEngine(
        database: db,
        api: const StubApi(),
        tokens: InMemoryTokenStore(),
        clock: FakeClock(DateTime.utc(2026, 8, 12)),
      );
      expect(engine.database, same(db));
      expect(engine.api, isA<StubApi>());
      expect(engine.tokens, isA<InMemoryTokenStore>());
      expect(engine.clock, isA<FakeClock>());
      expect(engine.maxBatchOps, 200);
      expect(engine.maxBatchBytes, 512 * 1024);
      expect(engine.maxAttempts, 8);
    });

    test('sans session, le cycle ne touche pas au réseau', () async {
      final SyncEngine engine = buildSyncEngine(
        database: db,
        api: const ExplodingApi(),
        tokens: InMemoryTokenStore(),
        clock: const SystemClock(),
      );
      final SyncOutcome outcome = await engine.runOnce();
      expect(outcome.status, SyncRunStatus.skipped);
      expect(outcome.reason, 'no_session');
    });

    test('une file vide ne produit aucun lot', () async {
      final FakeApi api = FakeApi();
      final SyncEngine engine = buildSyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'jeton', userId: 'me'),
        clock: const SystemClock(),
      );
      final SyncOutcome outcome = await engine.runOnce();
      expect(outcome.isOk, isTrue);
      expect(outcome.pushed, 0);
      expect(api.calls, isEmpty);
    });
  });

  group('sélection : une clé empoisonnée ne bloque qu\'elle-même', () {
    late AppDatabase db;
    late FakeApi api;
    late FakeClock clock;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      clock = FakeClock(t0);
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: clock,
        random: Random(1),
      );
    });
    tearDown(() => db.close());

    /// Deux représentants, deux prospects chacun. `dependencyKey` = l'id du
    /// représentant, y compris pour les prospects : c'est la convention de
    /// `WriteRepository`.
    Future<void> seedTwoChains() async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      await queueOp(
        db,
        id: 'A2',
        entityType: 'prospect',
        entityId: 'pA1',
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
    }

    test(
      'une tête `failed` retire toute sa clé du lot, les autres passent',
      () async {
        await seedTwoChains();
        // repA est empoisonné : sa tête a définitivement échoué.
        await (db.update(
          db.outbox,
        )..where((Outbox o) => o.id.equals('A1'))).write(
          const OutboxCompanion(status: Value<String>(OutboxStatus.failed)),
        );

        final List<OutboxData> batch = await engine.selectBatch();
        expect(
          batch.map((OutboxData o) => o.id),
          <String>['B1', 'B2'],
          reason: 'A2 est pending et dû, mais sa clé est empoisonnée',
        );
      },
    );

    test('une tête `conflict` retire toute sa clé du lot', () async {
      await seedTwoChains();
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.id.equals('A1'))).write(
        const OutboxCompanion(status: Value<String>(OutboxStatus.conflict)),
      );
      final List<OutboxData> batch = await engine.selectBatch();
      expect(batch.map((OutboxData o) => o.id), <String>['B1', 'B2']);
    });

    test(
      'la vidange draine les autres clés et ne touche jamais la clé morte',
      () async {
        await seedTwoChains();
        await (db.update(
          db.outbox,
        )..where((Outbox o) => o.id.equals('A1'))).write(
          const OutboxCompanion(status: Value<String>(OutboxStatus.failed)),
        );

        final int acknowledged = await engine.drain();

        expect(acknowledged, 2);
        expect(api.receivedOpIds, <String>['B1', 'B2']);
        // A2 est intact : ni tentative consommée, ni statut changé. Lui brûler ses
        // essais pour la faute de son parent la tuerait pour rien.
        final OutboxData a2 = await outboxById(db, 'A2');
        expect(a2.status, OutboxStatus.pending);
        expect(a2.attempts, 0);
        expect((await outboxById(db, 'B1')).status, OutboxStatus.done);
        expect((await outboxById(db, 'B2')).status, OutboxStatus.done);
      },
    );

    test(
      'le préfixe est CONTIGU : une opération non due arrête sa chaîne',
      () async {
        await seedTwoChains();
        // A1 est dû, A2 attend son back-off. A2 ne doit pas passer devant A1…
        await (db.update(
          db.outbox,
        )..where((Outbox o) => o.id.equals('A2'))).write(
          OutboxCompanion(
            nextAttemptAt: Value<DateTime>(t0.add(const Duration(minutes: 5))),
          ),
        );
        final List<OutboxData> batch = await engine.selectBatch();
        expect(batch.map((OutboxData o) => o.id), <String>['A1', 'B1', 'B2']);
      },
    );

    test('une tête non due gèle sa clé sans gêner les voisines', () async {
      await seedTwoChains();
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.id.equals('A1'))).write(
        OutboxCompanion(
          nextAttemptAt: Value<DateTime>(t0.add(const Duration(minutes: 5))),
        ),
      );
      expect((await engine.selectBatch()).map((OutboxData o) => o.id), <String>[
        'B1',
        'B2',
      ]);
      // Le back-off expire : la clé repart entière, dans l'ordre.
      clock.advance(const Duration(minutes: 6));
      expect((await engine.selectBatch()).map((OutboxData o) => o.id), <String>[
        'A1',
        'A2',
        'B1',
        'B2',
      ]);
    });

    test(
      'un prospect ne peut structurellement pas précéder son représentant',
      () async {
        await seedTwoChains();
        final List<OutboxData> batch = await engine.selectBatch();
        final List<String> chainA = batch
            .where((OutboxData o) => o.dependencyKey == 'repA')
            .map((OutboxData o) => o.id)
            .toList();
        expect(chainA, <String>['A1', 'A2']);
        // `isA<List<int>>()` était garanti par le type de retour : l'assertion ne
        // pouvait pas échouer. Ce qui doit tenir, c'est que le lot est trié par
        // `seq` STRICTEMENT croissant, dans la chaîne comme entre les chaînes :
        // c'est cet ordre, et lui seul, qui garantit qu'un prospect ne précède
        // jamais le `create` de son représentant.
        final List<int> seqs = batch.map((OutboxData o) => o.seq).toList();
        expect(seqs, hasLength(4));
        for (int i = 1; i < seqs.length; i++) {
          expect(seqs[i], greaterThan(seqs[i - 1]));
        }
        final int repASeq = batch
            .firstWhere((OutboxData o) => o.id == 'A1')
            .seq;
        final int prospectSeq = batch
            .firstWhere((OutboxData o) => o.id == 'A2')
            .seq;
        expect(prospectSeq, greaterThan(repASeq));
      },
    );

    test('une opération sans dependencyKey est sa propre partition', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await db
          .into(db.outbox)
          .insert(
            OutboxCompanion.insert(
              id: 'solo',
              dependencyKey: const Value<String?>(null),
              entityType: 'representant',
              entityId: 'repA',
              op: 'update',
              payload: '{}',
              nextAttemptAt: t0,
              createdAt: t0,
            ),
          );
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.id.equals('A1'))).write(
        const OutboxCompanion(status: Value<String>(OutboxStatus.failed)),
      );
      // `solo` n'a pas de clé : l'échec d'A1 ne la concerne pas.
      expect(
        (await engine.selectBatch()).map((OutboxData o) => o.id),
        contains('solo'),
      );
    });

    test('le lot s\'arrête au plafond d\'opérations', () async {
      // Cinq entités DISTINCTES, une par clé : c'est le plafond d'opérations
      // qu'on mesure ici. Cinq écritures sur la MÊME fiche seraient bornées
      // bien avant par une autre règle, celle qui n'en laisse passer qu'une par
      // lot (voir [SyncEngine.selectBatch]), et le test ne mesurerait plus rien.
      for (int i = 0; i < 5; i++) {
        await insertRepresentant(db, id: 'rep$i', phone: '+22177000000$i');
        await queueOp(
          db,
          id: 'op$i',
          entityType: 'representant',
          entityId: 'rep$i',
          dependencyKey: 'k$i',
        );
      }
      final SyncEngine small = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r'),
        clock: clock,
        maxBatchOps: 2,
      );
      expect(await small.selectBatch(), hasLength(2));
    });
  });

  group('bail et récupération', () {
    late AppDatabase db;
    late FakeApi api;
    late FakeClock clock;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      clock = FakeClock(t0);
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: clock,
        random: Random(3),
      );
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
    });
    tearDown(() => db.close());

    test('un bail expiré revient en file', () async {
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.syncing,
        leaseUntil: t0.subtract(const Duration(seconds: 1)),
      );
      expect(await engine.reclaimExpiredLeases(), 1);
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.pending);
      expect(row.leaseUntil, isNull);
    });

    test('un bail encore valide reste pris', () async {
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.syncing,
        leaseUntil: t0.add(const Duration(minutes: 1)),
      );
      expect(await engine.reclaimExpiredLeases(), 0);
      expect((await outboxById(db, 'A1')).status, OutboxStatus.syncing);
    });

    test('deux vidanges concurrentes n\'émettent qu\'un seul lot', () async {
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      final List<int> counts = await Future.wait(<Future<int>>[
        engine.drain(),
        engine.drain(),
      ]);
      // Sans le garde de vol unique, le même lot partirait deux fois sous deux
      // clés d'idempotence différentes : que le serveur ne peut pas rapprocher.
      expect(api.calls, hasLength(1));
      expect(counts.reduce((int a, int b) => a + b), 1);
    });
  });

  group('rejeu idempotent', () {
    late AppDatabase db;
    late FakeApi api;
    late FakeClock clock;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      clock = FakeClock(t0);
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: clock,
        random: Random(5),
      );
    });
    tearDown(() => db.close());

    test('le même lot envoyé deux fois ne produit qu\'une ligne', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        payload: <String, Object?>{
          'fullName': 'Awa Sy',
          'phone': '+221770000001',
          'departementId': 'dep-1',
        },
      );

      // Premier envoi : le serveur applique, la réponse se perd au retour. C'est
      // le seul scénario qui produit un doublon si l'idempotence est cassée.
      api.loseNextResponse = true;
      await engine.drain();

      expect(api.calls, hasLength(1));
      expect(api.rows.keys, <String>['repA']);
      final OutboxData afterLoss = await outboxById(db, 'A1');
      expect(afterLoss.status, OutboxStatus.pending);
      expect(afterLoss.attempts, 1);

      // Le back-off s'écoule, le cycle suivant repart.
      clock.advance(const Duration(minutes: 30));
      await engine.drain();

      expect(api.calls, hasLength(2));
      expect(api.receivedOpIds, <String>['A1', 'A1']);
      expect(
        api.rows,
        hasLength(1),
        reason: 'le second envoi porte le même opId : aucune seconde ligne',
      );
      expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
    });

    /// L'accueil saisit hors ligne et l'écran annonce « inscrit(e) au
    /// registre ». Tant que `_entityOf` ignorait `'visite'`, la ligne partait
    /// en échec définitif : une journée d'accueil disparaissait sans un mot.
    test('une visite saisie hors ligne part vraiment', () async {
      await queueOp(
        db,
        id: 'V1',
        entityType: 'visite',
        entityId: 'vis-1',
        payload: <String, Object?>{
          'visitorName': 'Awa Ndiaye',
          'visitDate': '2026-08-12',
          'entrepriseId': 'e1',
          'objetId': 'o1',
        },
      );

      await engine.drain();

      expect(api.calls, hasLength(1));
      final SyncOperationDto envoyee = api.calls.single.operations.single;
      expect(envoyee.entity, SyncEntity.visite);
      expect(envoyee.data?.visitorName, 'Awa Ndiaye');
      expect((await outboxById(db, 'V1')).status, OutboxStatus.done);
    });

    test('un verdict `duplicate` est un succès, pas un échec', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      api.verdicts['A1'] = SyncOperationResultDto(
        opId: 'A1',
        status: SyncOpStatus.duplicate,
        entityId: 'repA',
        rev: 4,
        serverUpdatedAt: t0,
        errorCode: null,
        error: null,
      );
      await engine.drain();
      expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
      final Representant rep = await (db.select(
        db.representants,
      )..where((Representants t) => t.id.equals('repA'))).getSingle();
      expect(rep.rev, 4);
      expect(rep.serverUpdatedAt, t0);
    });

    test('le batchId est STABLE tant que le lot ne change pas', () async {
      // C'est toute la raison d'être de `Idempotency-Key` : la réponse s'est
      // perdue au retour, le lot est déjà appliqué côté serveur, et le rejeu
      // doit tomber sur le cache de `sync_batches` au lieu de refaire le
      // travail. Un identifiant neuf à chaque tentative rendait ce cache
      // systématiquement froid : il n'avait jamais pu servir.
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      api.loseNextResponse = true;
      await engine.drain();
      clock.advance(const Duration(minutes: 30));
      await engine.drain();
      expect(api.calls, hasLength(2));
      expect(api.calls[0].batchId, api.calls[1].batchId);
      expect(api.calls[0].opIds, api.calls[1].opIds);
      expect(api.calls[0].payloadVersion, SyncEngine.payloadVersion);
    });

    test('un lot recomposé prend un batchId neuf', () async {
      // Rejouer une clé d'idempotence sous un CONTENU différent serait pire que
      // de ne pas la rejouer : le serveur rendrait le verdict mémorisé d'un
      // autre ensemble d'opérations.
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      api.loseNextResponse = true;
      await engine.drain();

      // Une deuxième opération rejoint la file entre les deux tentatives.
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await queueOp(db, id: 'B1', entityType: 'representant', entityId: 'repB');

      clock.advance(const Duration(minutes: 30));
      await engine.drain();

      expect(api.calls, hasLength(2));
      expect(api.calls[1].opIds, containsAll(<String>['A1', 'B1']));
      expect(api.calls[0].batchId, isNot(api.calls[1].batchId));
    });
  });

  group('409 sur téléphone : fusion automatique et remappage', () {
    late AppDatabase db;
    late FakeApi api;
    late FakeClock clock;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      clock = FakeClock(t0);
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: clock,
        random: Random(11),
      );
    });
    tearDown(() => db.close());

    /// Un représentant saisi hors ligne, deux prospects sous lui, un brouillon
    /// en cours qui pointe vers lui.
    Future<void> seedLocalChain() async {
      await insertRepresentant(db, id: 'local-rep', phone: '+221770000001');
      await insertProspect(
        db,
        id: 'p1',
        representantId: 'local-rep',
        phone: '+221780000001',
      );
      await insertProspect(
        db,
        id: 'p2',
        representantId: 'local-rep',
        phone: '+221780000002',
      );
      await queueOp(
        db,
        id: 'R1',
        entityType: 'representant',
        entityId: 'local-rep',
        payload: <String, Object?>{
          'fullName': 'Awa Sy',
          'phone': '+221770000001',
          'departementId': 'dep-1',
        },
      );
      await queueOp(
        db,
        id: 'P1',
        entityType: 'prospect',
        entityId: 'p1',
        dependencyKey: 'local-rep',
        payload: <String, Object?>{
          'nom': 'Diallo',
          'prenom': 'Mamadou',
          'phone': '+221780000001',
          'banqueId': 'bq-1',
          'syndicatId': 'sy-1',
          'representantId': 'local-rep',
        },
      );
      await queueOp(
        db,
        id: 'P2',
        entityType: 'prospect',
        entityId: 'p2',
        dependencyKey: 'local-rep',
        payload: <String, Object?>{
          'nom': 'Ba',
          'prenom': 'Fatou',
          'phone': '+221780000002',
          'banqueId': 'bq-1',
          'syndicatId': 'sy-1',
          'representantId': 'local-rep',
        },
      );
      await db
          .into(db.formDrafts)
          .insert(
            FormDraftsCompanion.insert(
              draftId: 'd1',
              formKey: 'prospect.create',
              parentId: const Value<String?>('local-rep'),
              payload: jsonEncode(<String, Object?>{
                'nom': 'Sow',
                'representantId': 'local-rep',
              }),
              updatedAt: t0,
            ),
          );
    }

    test('fiche du MÊME commercial : fusion silencieuse, tout suit', () async {
      await seedLocalChain();
      api.verdicts['R1'] = conflictOn('R1');
      api.onLookup = (String phone) => RepresentantLookup(
        found: true,
        phoneE164: phone,
        representant: representantDto(id: 'server-rep', phoneE164: phone),
        ownedByCommercialId: 'me',
        ownedByCommercialName: 'Awa Sy',
      );

      await engine.drain();

      expect(api.lookups, <String>['+221770000001']);

      // 1. l'identifiant du représentant est réécrit
      final List<Representant> reps = await db.select(db.representants).get();
      expect(reps.map((Representant r) => r.id), <String>['server-rep']);

      // 2. ON UPDATE CASCADE a emporté les prospects
      final List<Prospect> prospects = await db.select(db.prospects).get();
      expect(prospects.map((Prospect p) => p.representantId).toSet(), <String>{
        'server-rep',
      });

      // 3. outbox.entityId
      expect((await outboxById(db, 'R1')).entityId, 'server-rep');

      // 4. outbox.dependencyKey : sans ça les prospects tombent dans une
      //    partition orpheline et ne partent jamais.
      for (final String id in <String>['R1', 'P1', 'P2']) {
        expect((await outboxById(db, id)).dependencyKey, 'server-rep');
      }

      // 5. le representantId À L'INTÉRIEUR de chaque payload en attente : aucune
      //    cascade SQL n'atteint du JSON figé.
      for (final String id in <String>['P1', 'P2']) {
        final Map<String, Object?> payload =
            jsonDecode((await outboxById(db, id)).payload)
                as Map<String, Object?>;
        expect(payload['representantId'], 'server-rep');
      }

      // 6. le brouillon en cours suit lui aussi
      final FormDraft draft = await (db.select(
        db.formDrafts,
      )..where((FormDrafts t) => t.draftId.equals('d1'))).getSingle();
      expect(draft.parentId, 'server-rep');
      expect(
        (jsonDecode(draft.payload) as Map<String, Object?>)['representantId'],
        'server-rep',
      );

      // 7. l'opération de création en conflit est marquée appliquée : la fiche
      //    existe déjà côté serveur, la recréer n'a plus de sens.
      final OutboxData r1 = await outboxById(db, 'R1');
      expect(r1.status, OutboxStatus.done);
      expect(r1.lastErrorCode, isNull);
    });

    test(
      'fiche d\'un AUTRE commercial : aucune fusion, le propriétaire est nommé',
      () async {
        await seedLocalChain();
        api.verdicts['R1'] = conflictOn('R1');
        api.onLookup = (String phone) => RepresentantLookup(
          found: true,
          phoneE164: phone,
          representant: representantDto(
            id: 'server-rep',
            phoneE164: phone,
            createdById: 'moussa',
          ),
          ownedByCommercialId: 'moussa',
          ownedByCommercialName: 'Moussa Fall',
        );

        await engine.drain();

        // L'attribution détermine la commission : rattacher en silence les
        // prospects d'Awa à Moussa produirait une paie fausse que personne ne
        // remonterait jusqu'à une fusion faite six semaines plus tôt.
        final OutboxData r1 = await outboxById(db, 'R1');
        expect(r1.status, OutboxStatus.conflict);
        expect(r1.entityId, 'local-rep');
        expect(r1.lastErrorCode, ServerErrorCodes.representantPhoneConflict);
        expect(r1.lastErrorMsg, isNotNull);

        final List<Representant> reps = await db.select(db.representants).get();
        expect(reps.map((Representant r) => r.id), <String>['local-rep']);
        expect((await outboxById(db, 'P1')).dependencyKey, 'local-rep');

        // Et la clé est maintenant empoisonnée : les prospects ne partiront pas
        // vers un parent qui n'existe pas.
        expect(await engine.selectBatch(), isEmpty);
      },
    );

    test('lookup indisponible : on ne fusionne pas à l\'aveugle', () async {
      await seedLocalChain();
      api.verdicts['R1'] = conflictOn('R1');
      api.onLookup = (String phone) =>
          throw const ApiException('offline', kind: FailureKind.retryable);
      // `onLookup` qui lève est traité comme « je ne sais pas » : sans savoir à
      // qui appartient la fiche, la fusion est exactement ce qu'il ne faut pas
      // tenter.
      await engine.drain();
      expect((await outboxById(db, 'R1')).status, OutboxStatus.conflict);
      expect((await db.select(db.representants).get()).single.id, 'local-rep');
    });

    test('numéro inconnu du serveur : pas de fusion possible', () async {
      await seedLocalChain();
      api.verdicts['R1'] = conflictOn('R1');
      api.onLookup = (String phone) =>
          RepresentantLookup(found: false, phoneE164: phone);
      await engine.drain();
      expect((await outboxById(db, 'R1')).status, OutboxStatus.conflict);
    });

    test('un 409 sur un `update` ne se fusionne jamais', () async {
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
        payload: <String, Object?>{'phone': '+221770000001'},
      );
      api.verdicts['U1'] = conflictOn(
        'U1',
        errorCode: ServerErrorCodes.revConflict,
      );
      await engine.drain();
      expect((await outboxById(db, 'U1')).status, OutboxStatus.conflict);
      expect(api.lookups, isEmpty);
    });
  });

  group('remapEntityId', () {
    late AppDatabase db;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      engine = SyncEngine(
        database: db,
        api: FakeApi(),
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: FakeClock(t0),
        random: Random(13),
      );
    });
    tearDown(() => db.close());

    test(
      'tout se fait dans UNE transaction : une erreur en aval annule tout',
      () async {
        await insertRepresentant(db, id: 'local-rep', phone: '+221770000001');
        await insertProspect(
          db,
          id: 'p1',
          representantId: 'local-rep',
          phone: '+221780000001',
        );
        await queueOp(
          db,
          id: 'P1',
          entityType: 'prospect',
          entityId: 'p1',
          dependencyKey: 'local-rep',
          payload: <String, Object?>{'representantId': 'local-rep'},
        );

        // Interrompue au milieu, la suite de réécritures laisserait des prospects
        // orphelins ou des opérations pointant vers un identifiant disparu. Elle
        // doit donc participer à la transaction de l'appelant, pas committer par
        // morceaux.
        await expectLater(
          db.transaction(() async {
            await engine.remapEntityId('local-rep', 'server-rep');
            throw const _Interrupted();
          }),
          throwsA(isA<_Interrupted>()),
        );

        expect(
          (await db.select(db.representants).get()).single.id,
          'local-rep',
        );
        expect(
          (await db.select(db.prospects).get()).single.representantId,
          'local-rep',
        );
        final OutboxData p1 = await outboxById(db, 'P1');
        expect(p1.dependencyKey, 'local-rep');
        expect(
          (jsonDecode(p1.payload) as Map<String, Object?>)['representantId'],
          'local-rep',
        );
      },
    );

    test(
      'la fiche serveur déjà présente localement : on repointe puis on purge',
      () async {
        // Un pull a ramené la fiche serveur entre-temps. Renommer l'identifiant
        // local violerait la clé primaire.
        await insertRepresentant(db, id: 'local-rep', phone: '+221770000001');
        await insertProspect(
          db,
          id: 'p1',
          representantId: 'local-rep',
          phone: '+221780000001',
        );
        await insertRepresentant(
          db,
          id: 'server-rep',
          phone: '+221770000009',
          serverUpdatedAt: t0,
        );

        await engine.remapEntityId('local-rep', 'server-rep');

        final List<Representant> reps = await db.select(db.representants).get();
        expect(reps.map((Representant r) => r.id), <String>['server-rep']);
        expect(
          (await db.select(db.prospects).get()).single.representantId,
          'server-rep',
        );
      },
    );

    test('remapper vers soi-même est un no-op', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await engine.remapEntityId('repA', 'repA');
      expect((await db.select(db.representants).get()).single.id, 'repA');
    });

    /// ═══ UN BROUILLON DE CORRECTION RESTAIT SUR UN IDENTIFIANT MORT ═══
    ///
    /// Le remappage réécrivait `payload` et `parentId` des brouillons, jamais
    /// `entityId`. Or un brouillon de correction de représentant porte
    /// `entityId = <id local>` et pas de `parentId` : rien ne le suivait.
    ///
    /// Deux dégâts enchaînés. `DraftRepository.forEntity` ne le retrouve plus
    /// sous l'identifiant serveur, donc rouvrir la fiche perd la correction en
    /// cours ; et `RepresentantFormScreen._isCreationDraft` conclut « création »
    /// dès que la fiche visée est absente, donc le brouillon orphelin passe pour
    /// neuf et se réapplique **sans rien demander** dans un formulaire de
    /// création. C'est le doublon-plus-correction-détruite que ce garde devait
    /// fermer.
    test('le brouillon d\'une CORRECTION suit son représentant', () async {
      await insertRepresentant(db, id: 'local-rep', phone: '+221770000001');
      final DraftRepository drafts = DraftRepository(db, clock: FakeClock(t0));
      await drafts.save(
        draftId: 'd-correction',
        formKey: 'representant.create',
        entityId: 'local-rep',
        values: <String, Object?>{'fullName': 'Awa Sy corrigée'},
      );

      await engine.remapEntityId('local-rep', 'server-rep');

      expect(
        (await db.select(db.formDrafts).get()).single.entityId,
        'server-rep',
        reason:
            'sinon il désigne un identifiant que plus aucune ligne ne porte',
      );
      final DraftSnapshot? found = await drafts.forEntity(
        'representant.create',
        'server-rep',
      );
      expect(
        found?.draftId,
        'd-correction',
        reason: 'rouvrir la fiche doit retrouver la correction en cours',
      );
    });
  });

  group('échecs de lot', () {
    late AppDatabase db;
    late FakeApi api;
    late FakeClock clock;

    SyncEngine build({int maxAttempts = 8, Random? random}) => SyncEngine(
      database: db,
      api: api,
      tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
      clock: clock,
      maxAttempts: maxAttempts,
      random: random ?? Random(17),
    );

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      clock = FakeClock(t0);
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
    });
    tearDown(() => db.close());

    test('retryable : tentative comptée, back-off à gigue complète', () async {
      api.failNextPush = const ApiException('timeout', statusCode: 504);
      // Tirage nul ⇒ délai nul. Une gigue ÉGALE aurait imposé un plancher.
      await build(random: _ZeroRandom()).drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.pending);
      expect(row.attempts, 1);
      expect(row.nextAttemptAt, t0);
      expect(row.lastErrorCode, 'timeout');
    });

    test('IDEMPOTENCY_IN_PROGRESS ne compte pas de tentative', () async {
      api.failNextPush = const ApiException(
        ServerErrorCodes.idempotencyInProgress,
        statusCode: 409,
        kind: FailureKind.idempotencyInProgress,
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.attempts, 0);
      expect(row.nextAttemptAt, t0.add(const Duration(seconds: 2)));
    });

    test(
      'session expirée : rien ne se consomme, tout repart tel quel',
      () async {
        api.failNextPush = const ApiException(
          'session_expired',
          statusCode: 401,
          kind: FailureKind.sessionExpired,
        );
        await build().drain();
        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.pending);
        expect(row.attempts, 0);
        expect(row.nextAttemptAt, t0);
      },
    );

    test('429 : on écoute Retry-After plutôt que notre back-off', () async {
      api.failNextPush = const ApiException(
        'rate_limited',
        statusCode: 429,
        kind: FailureKind.throttled,
        retryAfter: Duration(minutes: 4),
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.attempts, 1);
      expect(row.nextAttemptAt, t0.add(const Duration(minutes: 4)));
    });

    test('terminal : l\'opération part en `failed` sans réessai', () async {
      api.failNextPush = const ApiException(
        'FORBIDDEN',
        statusCode: 403,
        kind: FailureKind.terminal,
        message: 'Compte désactivé.',
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.failed);
      expect(row.lastErrorCode, 'FORBIDDEN');
    });

    test('les tentatives épuisées font passer en `failed`', () async {
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals('A1')))
          .write(const OutboxCompanion(attempts: Value<int>(7)));
      // Un lot revenu SANS verdict pour cette ligne : le serveur a répondu,
      // c'est bien cette opération-là qu'il n'a pas jugée.
      api.verdicts['A1'] = SyncOperationResultDto(
        opId: 'une-autre',
        status: SyncOpStatus.applied,
        entityId: 'repA',
        rev: 1,
        serverUpdatedAt: t0,
        errorCode: null,
        error: null,
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.failed);
      expect(row.attempts, 8);
      expect(row.lastErrorCode, ClientErrorCodes.noResult);
    });

    /// ═══ HUIT MINUTES DE DÉPLOIEMENT CONDAMNAIENT LA FILE ═══
    ///
    /// `maxAttempts` était consommé indistinctement par le 429 et le 5xx, avec
    /// un cycle de soixante secondes : dix minutes de serveur indisponible
    /// mettaient toute la journée en `ATTEMPTS_EXHAUSTED`, à reprendre à la
    /// main ligne par ligne. Or aucune de ces deux réponses ne dit quoi que ce
    /// soit de la SAISIE.
    test('un 5xx n\'épuise pas le quota de la saisie', () async {
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals('A1')))
          .write(const OutboxCompanion(attempts: Value<int>(7)));
      api.failNextPush = const ApiException(
        'SERVER_ERROR',
        statusCode: 503,
        kind: FailureKind.retryable,
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.pending);
      expect(
        row.attempts,
        lessThan(8),
        reason:
            'le compteur ne doit pas franchir le seuil sur une panne '
            'serveur',
      );
    });

    test('un 429 n\'épuise pas le quota de la saisie', () async {
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals('A1')))
          .write(const OutboxCompanion(attempts: Value<int>(7)));
      api.failNextPush = const ApiException(
        'RATE_LIMITED',
        statusCode: 429,
        kind: FailureKind.throttled,
        retryAfter: Duration(minutes: 2),
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.pending);
      expect(row.nextAttemptAt, t0.add(const Duration(minutes: 2)));
    });

    /// ═══ LE LOT QUI NE PARTAIT JAMAIS, SANS JAMAIS SE VOIR ═══
    ///
    /// Sur EDGE, les 512 Ko d'un lot dépassaient le `sendTimeout` à chaque
    /// cycle. Le lot était reconstruit à l'identique, ne comptait AUCUNE
    /// tentative, et n'apparaissait donc jamais dans « À corriger ».
    test('un envoi qui expire finit par devenir visible', () async {
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals('A1')))
          .write(const OutboxCompanion(attempts: Value<int>(7)));
      api.failNextPush = const ApiException(
        ClientErrorCodes.sendTimeout,
        kind: FailureKind.unreachable,
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.failed);
      expect(row.attempts, 8);
    });

    test('un réseau absent, lui, n\'use toujours rien', () async {
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals('A1')))
          .write(const OutboxCompanion(attempts: Value<int>(7)));
      api.failNextPush = const ApiException(
        'NETWORK',
        kind: FailureKind.unreachable,
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.pending);
      expect(row.attempts, 7);
    });

    test('verdict `invalid` : échec visible dans « À corriger »', () async {
      api.verdicts['A1'] = invalidOn('A1', message: 'Département inconnu.');
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.status, OutboxStatus.failed);
      expect(row.lastErrorMsg, 'Département inconnu.');
    });

    test(
      'parent en échec : remise en file SANS consommer de tentative',
      () async {
        api.verdicts['A1'] = _blockedOn('A1');
        await build().drain();
        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.pending);
        expect(row.attempts, 0);
        expect(row.lastErrorCode, ServerErrorCodes.parentRepresentantFailed);
      },
    );

    // ── Un seul refus ne condamne pas le lot ──────────────────────────────────
    //
    // Avec `maxBatchOps = 200`, marquer TOUT le lot en échec pour une saisie
    // malformée renvoyait une journée entière de prospection dans
    // « À corriger ». Le refus de validation du serveur nomme pourtant les
    // opérations fautives, une par une.

    test('un refus nominatif ne condamne que les saisies nommées', () async {
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await insertRepresentant(db, id: 'repC', phone: '+221770000003');
      await queueOp(db, id: 'A2', entityType: 'representant', entityId: 'repB');
      await queueOp(db, id: 'A3', entityType: 'representant', entityId: 'repC');

      api.failNextPush = const ApiException(
        'BAD_REQUEST',
        statusCode: 400,
        kind: FailureKind.terminal,
        message: 'operations.1.data.phone must be a string',
        rejectedOperations: <int>[1],
      );
      await build().drain();

      expect((await outboxById(db, 'A1')).status, OutboxStatus.pending);
      expect((await outboxById(db, 'A2')).status, OutboxStatus.failed);
      expect((await outboxById(db, 'A3')).status, OutboxStatus.pending);
      expect(
        (await outboxById(db, 'A3')).attempts,
        0,
        reason: 'la saisie d\'à côté ne paie pas le refus d\'une autre',
      );
    });

    test('un refus qui ne nomme personne condamne bien tout le lot', () async {
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await queueOp(db, id: 'A2', entityType: 'representant', entityId: 'repB');

      api.failNextPush = const ApiException(
        'PAYLOAD_VERSION_UNSUPPORTED',
        statusCode: 400,
        kind: FailureKind.terminal,
      );
      await build().drain();

      expect((await outboxById(db, 'A1')).status, OutboxStatus.failed);
      expect((await outboxById(db, 'A2')).status, OutboxStatus.failed);
    });

    /// Un rang hors du lot ne désigne rien : mieux vaut le refus entier, qui est
    /// visible, qu'un acquittement silencieux de saisies que le serveur refuse.
    test('un rang hors du lot retombe sur le refus entier', () async {
      api.failNextPush = const ApiException(
        'BAD_REQUEST',
        statusCode: 400,
        kind: FailureKind.terminal,
        rejectedOperations: <int>[42],
      );
      await build().drain();
      expect((await outboxById(db, 'A1')).status, OutboxStatus.failed);
    });

    // ── Rejeu bloqué : plancher et plafond ────────────────────────────────────
    //
    // Sans compteur séparé, `attempts` restait à zéro, `nextDelay(0)` rendait
    // ZÉRO, et l'opération repartait cinquante fois par vidange, toutes les
    // soixante secondes, indéfiniment : jamais `failed`, donc jamais visible
    // dans « À corriger », donc rien à faire pour l'utilisateur.

    test('un rejeu bloqué attend au moins 30 s, jamais zéro', () async {
      api.verdicts['A1'] = _blockedOn('A1');
      // Tirage nul : sans plancher, le délai serait exactement zéro.
      await build(random: _ZeroRandom()).drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.blockedAttempts, 1);
      expect(row.attempts, 0, reason: 'la faute n\'est pas la sienne');
      expect(
        row.nextAttemptAt,
        t0.add(const Duration(seconds: 30)),
        reason: 'nextDelay(1) tiré à zéro doit être relevé au plancher',
      );
    });

    test(
      'un blocage permanent finit par devenir visible dans « À corriger »',
      () async {
        api.verdicts['A1'] = _blockedOn('A1');
        final SyncEngine engine = build();
        // Onze rejeux : la ligne tourne, mais elle est de plus en plus espacée.
        for (int i = 0; i < 11; i++) {
          clock.advance(const Duration(minutes: 20));
          await engine.drain();
          expect((await outboxById(db, 'A1')).status, OutboxStatus.pending);
        }
        expect((await outboxById(db, 'A1')).blockedAttempts, 11);

        clock.advance(const Duration(minutes: 20));
        await engine.drain();

        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.failed);
        expect(row.blockedAttempts, 12);
        expect(
          row.attempts,
          0,
          reason: 'aucun refus serveur n\'a été comptabilisé',
        );
      },
    );

    /// ═══ LE BUDGET DE BLOCAGE NE SE RECHARGEAIT JAMAIS ═══
    ///
    /// `blockedAttempts` n'était remis à zéro que par deux gestes de
    /// l'UTILISATEUR (« Réessayer » et la correction sur place). Deux épisodes
    /// de blocage sans rapport, séparés de plusieurs jours, partageaient donc le
    /// même budget de douze : un parent réparé depuis longtemps laissait
    /// derrière lui des enfants à moitié condamnés, que quelques
    /// `GROUP_TRANSACTION_FAILED` intermittents achevaient, avec un message qui
    /// renvoyait l'utilisateur réparer une fiche parente parfaitement saine.
    ///
    /// L'acquittement de la tête est l'événement qui clôt l'épisode : ce sont
    /// ses échecs à elle qui ont fait monter le compteur de ses suiveurs.
    test(
      'un parent enfin passé rend son budget de blocage à sa suite',
      () async {
        await insertProspect(
          db,
          id: 'pA1',
          representantId: 'repA',
          phone: '+221780000001',
        );
        await queueOp(
          db,
          id: 'A2',
          entityType: 'prospect',
          entityId: 'pA1',
          dependencyKey: 'repA',
        );

        // Le prospect a déjà encaissé des rejeux bloqués pour la faute de son
        // parent : c'est l'état que laisse un premier épisode.
        await (db.update(db.outbox)..where((Outbox o) => o.id.equals('A2')))
            .write(const OutboxCompanion(blockedAttempts: Value<int>(9)));

        final SyncEngine engine = build();
        await engine.drain();

        expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
        expect(
          (await outboxById(db, 'A2')).blockedAttempts,
          0,
          reason: 'la cause du blocage vient de disparaître : le budget repart',
        );
        // `attempts` compte, lui, des fautes que l'opération porte vraiment : il
        // n'a rien à voir avec cet effacement.
        expect((await outboxById(db, 'A2')).attempts, 0);
      },
    );

    /// La chaîne voisine ne doit rien recevoir : son propre blocage, s'il
    /// existe, n'a pas été résolu par ce succès-ci.
    test('le budget rendu ne déborde pas sur une autre clé', () async {
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await queueOp(
        db,
        id: 'B1',
        entityType: 'representant',
        entityId: 'repB',
        status: OutboxStatus.conflict,
      );
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals('B1')))
          .write(const OutboxCompanion(blockedAttempts: Value<int>(9)));

      await build().drain();

      expect((await outboxById(db, 'B1')).blockedAttempts, 9);
    });

    /// Le message d'abandon envoyait TOUJOURS corriger « la fiche parente ».
    /// `GROUP_TRANSACTION_FAILED` n'accuse aucun parent : il dit que le serveur
    /// n'a pas pu écrire le lot. L'utilisateur partait chercher un défaut sur
    /// une fiche qui n'en avait pas.
    test(
      'un lot refusé ne renvoie pas corriger une fiche parente saine',
      () async {
        api.verdicts['A1'] = SyncOperationResultDto(
          opId: 'A1',
          status: SyncOpStatus.skippedDependencyFailed,
          entityId: null,
          rev: null,
          serverUpdatedAt: null,
          errorCode: ServerErrorCodes.groupTransactionFailed,
          // Le serveur ne dit rien de plus : c'est le message par défaut du
          // client qui parle, et c'est lui qui mentait.
          error: null,
        );
        final SyncEngine engine = build();
        for (int i = 0; i < 12; i++) {
          clock.advance(const Duration(minutes: 20));
          await engine.drain();
        }

        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.failed);
        expect(row.lastErrorCode, ServerErrorCodes.groupTransactionFailed);
        expect(row.lastErrorMsg, isNot(contains('parente')));
      },
    );

    // ── Lien mort : les tentatives comptent des REFUS, pas du temps ───────────

    test(
      'lien injoignable : rien ne se consomme, comme une session morte',
      () async {
        api.failNextPush = const ApiException(
          'NETWORK',
          kind: FailureKind.unreachable,
          message: 'Réseau indisponible.',
        );
        await build().drain();
        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.pending);
        expect(row.attempts, 0);
        expect(
          row.nextAttemptAt,
          t0,
          reason: 'reprise dès le retour du réseau',
        );
        expect(row.lastErrorCode, 'NETWORK');
      },
    );

    test('huit coupures réseau ne tuent pas une saisie valide', () async {
      final SyncEngine engine = build();
      for (int i = 0; i < 8; i++) {
        api.failNextPush = const ApiException(
          'TIMEOUT',
          kind: FailureKind.unreachable,
        );
        await engine.drain();
      }
      final OutboxData row = await outboxById(db, 'A1');
      expect(
        row.status,
        OutboxStatus.pending,
        reason: 'ATTEMPTS_EXHAUSTED doit rester réservé aux refus du serveur',
      );
      expect(row.attempts, 0);

      // Le réseau revient : la saisie part, intacte.
      await engine.drain();
      expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
    });

    test('runOnce ne compte pas comme envoyé un lot qui a échoué', () async {
      api.failNextPush = const ApiException('timeout', statusCode: 504);
      final SyncOutcome outcome = await build().runOnce(pull: false);
      expect(
        outcome.pushed,
        0,
        reason:
            'annoncer un envoi qui n\'a pas eu lieu fait rendre `ok` au worker, '
            'qui ne se reprogramme alors jamais',
      );
      expect((await outboxById(db, 'A1')).status, OutboxStatus.pending);
    });

    // ── Rejeu d'un verdict mémorisé ───────────────────────────────────────────
    //
    // `duplicate` ne veut pas dire « c'est écrit », il veut dire « j'ai déjà vu
    // cet opId, voici ce que j'avais répondu ». Si ce verdict mémorisé était un
    // REFUS, le marquer `done` efface l'écriture en silence : le commercial tape
    // « Réessayer » dans « À corriger » et sa fiche disparaît.

    test(
      '`duplicate` porteur d\'un conflit ne marque PAS l\'opération faite',
      () async {
        api.verdicts['A1'] = SyncOperationResultDto(
          opId: 'A1',
          status: SyncOpStatus.duplicate,
          entityId: null,
          rev: null,
          serverUpdatedAt: null,
          errorCode: ServerErrorCodes.revConflict,
          error: 'La fiche a changé côté serveur.',
        );
        await build().drain();
        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.conflict);
        expect(row.lastErrorCode, ServerErrorCodes.revConflict);
      },
    );

    test(
      '`duplicate` porteur d\'un refus part en `failed`, pas en `done`',
      () async {
        api.verdicts['A1'] = SyncOperationResultDto(
          opId: 'A1',
          status: SyncOpStatus.duplicate,
          entityId: null,
          rev: null,
          serverUpdatedAt: null,
          errorCode: 'VALIDATION_FAILED',
          error: 'Département inconnu.',
        );
        await build().drain();
        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.failed);
        expect(row.lastErrorMsg, 'Département inconnu.');
      },
    );

    test('une opération sans verdict revient en file, visiblement', () async {
      api.verdicts['A1'] = SyncOperationResultDto(
        opId: 'inconnu',
        status: SyncOpStatus.applied,
        entityId: 'x',
        rev: 1,
        serverUpdatedAt: t0,
        errorCode: null,
        error: null,
      );
      await build().drain();
      final OutboxData row = await outboxById(db, 'A1');
      expect(row.lastErrorCode, ClientErrorCodes.noResult);
      expect(row.attempts, 1);
    });

    // `_toOperation` valide le lot sortant contre un vocabulaire compilé et
    // marque `PAYLOAD_SCHEMA_MISMATCH`, statut TERMINAL, sur toute valeur qu'il
    // ne sait pas envoyer. Une heure de rappel doit traverser ce filtre.
    test('une heure de rappel part avec la tentative d\'appel', () async {
      await queueOp(
        db,
        id: 'CB1',
        entityType: callAttemptEntity,
        entityId: 'att-1',
        payload: <String, Object?>{
          'prospectId': 'pros-1',
          'outcome': CallOutcomes.callback,
          'callbackAt': '2026-08-13T09:00:00.000Z',
          'clientCreatedAt': t0.toIso8601String(),
        },
      );

      await build().drain();

      final SyncOperationDto sent = api.calls.single.operations.firstWhere(
        (SyncOperationDto o) => o.opId == 'CB1',
      );
      expect(sent.data?.callbackAt, DateTime.utc(2026, 8, 13, 9));
      expect(
        (await outboxById(db, 'CB1')).lastErrorCode,
        isNot(ClientErrorCodes.payloadSchemaMismatch),
      );
    });

    // Le contrat garde le champ facultatif pour les téléphones déjà déployés :
    // une opération en file depuis trois semaines n'en porte pas, et doit rester
    // lisible par ce code-ci.
    test('une tentative sans heure de rappel reste lisible', () async {
      await queueOp(
        db,
        id: 'CB2',
        entityType: callAttemptEntity,
        entityId: 'att-2',
        payload: <String, Object?>{
          'prospectId': 'pros-1',
          'outcome': CallOutcomes.callback,
          'clientCreatedAt': t0.toIso8601String(),
        },
      );

      await build().drain();

      final SyncOperationDto sent = api.calls.single.operations.firstWhere(
        (SyncOperationDto o) => o.opId == 'CB2',
      );
      expect(sent.data?.callbackAt, isNull);
      expect(
        (await outboxById(db, 'CB2')).lastErrorCode,
        isNot(ClientErrorCodes.payloadSchemaMismatch),
      );
    });

    test(
      'un payload indécodable échoue proprement, sans exception en fond',
      () async {
        await db
            .into(db.outbox)
            .insert(
              OutboxCompanion.insert(
                id: 'BAD',
                dependencyKey: const Value<String?>('repB'),
                entityType: 'representant',
                entityId: 'repB',
                op: 'create',
                payload: 'ceci n\'est pas du JSON',
                nextAttemptAt: t0,
                createdAt: t0,
              ),
            );
        await build().drain();
        final OutboxData row = await outboxById(db, 'BAD');
        expect(row.status, OutboxStatus.failed);
        expect(row.lastErrorCode, ClientErrorCodes.payloadSchemaMismatch);
      },
    );
  });

  group('champs facultatifs vidés', () {
    late AppDatabase db;
    late FakeApi api;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: FakeClock(t0),
        random: Random(7),
      );
    });
    tearDown(() => db.close());

    Future<SyncOperationDto> sendUpdate(Map<String, Object?> payload) async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        baseRev: 1,
        payload: payload,
      );
      await engine.drain();
      return api.calls.single.operations.single;
    }

    test('vider l\'IEF et les notes se dit au serveur', () async {
      // Sans `clearedFields`, la sérialisation supprime les nuls : le serveur
      // lit « champ absent », donc « inchangé », et la valeur effacée revient
      // au pull suivant.
      final SyncOperationDto sent = await sendUpdate(<String, Object?>{
        'fullName': 'Awa Sy',
        'phone': '+221770000001',
        'departementId': 'dep-1',
        'iefId': null,
        'notes': null,
      });

      expect(sent.clearedFields, <String>['iefId', 'notes']);
      expect(sent.data?.iefId, isNull);
      expect(sent.data?.notes, isNull);
    });

    test('repasser à « même numéro » efface le numéro WhatsApp', () async {
      // Le statut suffit à décrire l'état, mais le serveur garderait l'ancien
      // numéro : la fiche dirait « même numéro » en portant un autre numéro.
      final SyncOperationDto sent = await sendUpdate(<String, Object?>{
        'fullName': 'Awa Sy',
        'phone': '+221770000001',
        'departementId': 'dep-1',
        'whatsappStatus': 'MEME_NUMERO',
        'whatsappE164': null,
        'profession': 'Instituteur',
      });

      expect(sent.clearedFields, <String>['whatsappE164']);
    });

    test('un champ que le formulaire ne porte pas n\'efface rien', () async {
      final SyncOperationDto sent = await sendUpdate(<String, Object?>{
        'fullName': 'Awa Sy',
        'phone': '+221770000001',
        'departementId': 'dep-1',
        'notes': 'à rappeler lundi',
      });

      expect(sent.clearedFields, isNull);
    });

    test('une création ne réclame aucun effacement', () async {
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await queueOp(
        db,
        id: 'B1',
        entityType: 'representant',
        entityId: 'repB',
        payload: <String, Object?>{
          'fullName': 'Awa Sy',
          'phone': '+221770000002',
          'departementId': 'dep-1',
          'iefId': null,
        },
      );
      await engine.drain();

      expect(api.calls.single.operations.single.clearedFields, isNull);
    });

    /// La liste du client doit être la COPIE de `CLEARABLE_FIELDS`
    /// (`apps/api/src/modules/sync/dto.ts`) : un nom absent de la liste serveur
    /// fait refuser le LOT ENTIER, un nom absent de la liste cliente fait
    /// disparaître silencieusement l'effacement.
    test('la liste des champs effaçables est celle du serveur', () async {
      await insertRepresentant(
        db,
        id: 'repC',
        phone: '+221770000003',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'C1',
        entityType: 'representant',
        entityId: 'repC',
        op: 'update',
        baseRev: 1,
        payload: <String, Object?>{
          'fullName': 'Awa Sy',
          'phone': '+221770000003',
          'departementId': 'dep-1',
          'iefId': null,
          'notes': null,
          'whatsappE164': null,
          'profession': null,
          'prenom': null,
          'etablissement': null,
          // Le serveur ne sait PAS vider ceux-ci : les annoncer ferait refuser
          // le lot entier sur `IsIn`.
          'banqueId': null,
          'syndicatId': null,
          'representantId': null,
        },
      );
      await engine.drain();

      expect(api.calls.single.operations.single.clearedFields, <String>[
        'iefId',
        'notes',
        'whatsappE164',
        'profession',
        'prenom',
        'etablissement',
      ]);
    });
  });

  group('pull', () {
    late AppDatabase db;
    late FakeApi api;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: FakeClock(t0),
        random: Random(19),
      );
    });
    tearDown(() => db.close());

    test('le curseur est unique et se relit', () async {
      await engine.writeCursor('cur-1');
      expect(await engine.readCursor(), 'cur-1');
      final SyncStateData row = (await db.select(db.syncState).get()).single;
      expect(row.collection, SyncEngine.cursorKey);
    });

    test('deux pulls concurrents ne font pas reculer le curseur', () async {
      // Quatre déclencheurs peuvent tomber ensemble : minuteur de 60 s, retour
      // au premier plan, bouton « Synchroniser », changement de connectivité.
      // Sans vol unique, ils lisent le MÊME curseur de départ, et le dernier à
      // écrire le fait reculer : les pages déjà tirées repartent, payées deux
      // fois sur un forfait mobile.
      api.pullPages.addAll(<PullPage>[
        emptyPullPage(cursor: 'cur-1'),
        emptyPullPage(cursor: 'cur-2'),
      ]);

      await Future.wait<int>(<Future<int>>[
        engine.pullChanges(),
        engine.pullChanges(),
      ]);

      expect(
        api.pullPages,
        hasLength(1),
        reason: 'le second appel doit sortir sans toucher au réseau',
      );
      expect(await engine.readCursor(), 'cur-1');
    });

    test('une page rejouée n\'écrase pas une révision plus récente', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        fullName: 'Nom récent',
        rev: 9,
        serverUpdatedAt: t0,
      );
      api.pullPages.add(
        PullPage(
          changes: SyncChangesDto(
            departements: const <DepartementDto>[],
            iefs: const <IefDto>[],
            banques: const <BanqueDto>[],
            syndicats: const <SyndicatDto>[],
            canauxProvenance: const <CanalProvenanceDto>[],
            visiteReferentiels: const <SyncVisiteReferentielDto>[],
            representants: <RepresentantDto>[
              representantDto(
                id: 'repA',
                phoneE164: '+221770000001',
                fullName: 'Nom ancien',
              ),
            ],
            prospects: const <ProspectDto>[],
            callCampaigns: const <SyncCallCampaignDto>[],
            callTasks: const <SyncCallTaskDto>[],
            visites: const <SyncVisiteDto>[],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'cur-2',
          hasMore: false,
          serverTime: t0,
        ),
      );

      await engine.pullChanges();

      final Representant rep = (await db.select(db.representants).get()).single;
      // `rev` 3 < 9 : le `WHERE excluded.rev > rev` porte tout. Sans lui, la
      // modification de l'utilisateur disparaîtrait sans trace.
      expect(rep.fullName, 'Nom récent');
      expect(rep.rev, 9);
      expect(await engine.readCursor(), 'cur-2');
    });

    // Une fiche peut suivre les DEUX projets. Aplatir ses parcours sur la
    // colonne `projet` la faisait disparaître de la liste CHUES le jour où elle
    // rejoignait le Grand Public.
    test('le pull garde les deux parcours d’une même fiche', () async {
      api.pullPages.add(
        PullPage(
          changes: SyncChangesDto(
            departements: const <DepartementDto>[],
            iefs: const <IefDto>[],
            banques: const <BanqueDto>[],
            syndicats: const <SyndicatDto>[],
            canauxProvenance: const <CanalProvenanceDto>[],
            visiteReferentiels: const <SyncVisiteReferentielDto>[],
            representants: const <RepresentantDto>[],
            prospects: <ProspectDto>[
              prospectDto(
                id: 'pro-double',
                parcours: const <Projet>[Projet.CHUES, Projet.GRAND_PUBLIC],
              ),
            ],
            callCampaigns: const <SyncCallCampaignDto>[],
            callTasks: const <SyncCallTaskDto>[],
            visites: const <SyncVisiteDto>[],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'cur-parcours',
          hasMore: false,
          serverTime: t0,
        ),
      );

      await engine.pullChanges();

      expect((await db.select(db.prospects).get()).single.projet, 'CHUES');
      expect(
        (await db.select(db.prospectJourneys).get())
            .map((ProspectJourney j) => j.projet)
            .toList()
          ..sort(),
        <String>['CHUES', 'GRAND_PUBLIC'],
      );
    });

    // Le pull est la SEULE source de ces deux libellés : ils sont écrits par le
    // serveur et jamais depuis le terrain. Les jeter à l'upsert rendait la
    // cascade région et la relation invisibles hors ligne.
    test('le pull garde le libellé de région et la relation', () async {
      api.pullPages.add(
        PullPage(
          changes: SyncChangesDto(
            departements: <DepartementDto>[
              DepartementDto(
                id: 'dep-9',
                code: 'TC',
                name: 'Bakel',
                regionId: 'reg-tc',
                regionName: 'Tambacounda',
                isActive: true,
                updatedAt: t0,
              ),
            ],
            iefs: const <IefDto>[],
            banques: const <BanqueDto>[],
            syndicats: const <SyndicatDto>[],
            canauxProvenance: const <CanalProvenanceDto>[],
            visiteReferentiels: const <SyncVisiteReferentielDto>[],
            representants: <RepresentantDto>[
              representantDto(
                id: 'repZ',
                phoneE164: '+221770000009',
                departementId: 'dep-9',
                relationStatus: RepresentantRelation.AMBASSADEUR,
              ),
            ],
            prospects: const <ProspectDto>[],
            callCampaigns: const <SyncCallCampaignDto>[],
            callTasks: const <SyncCallTaskDto>[],
            visites: const <SyncVisiteDto>[],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'cur-9',
          hasMore: false,
          serverTime: t0,
        ),
      );

      await engine.pullChanges();

      final Departement dep = (await (db.select(
        db.departements,
      )..where((Departements t) => t.id.equals('dep-9'))).get()).single;
      expect(dep.regionName, 'Tambacounda');

      final Representant rep = (await db.select(db.representants).get()).single;
      expect(rep.relationStatus, 'AMBASSADEUR');
    });

    test('une suppression serveur est logique, jamais physique', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      api.pullPages.add(
        PullPage(
          changes: SyncChangesDto(
            departements: const <DepartementDto>[],
            iefs: const <IefDto>[],
            banques: const <BanqueDto>[],
            syndicats: const <SyndicatDto>[],
            canauxProvenance: const <CanalProvenanceDto>[],
            visiteReferentiels: const <SyncVisiteReferentielDto>[],
            representants: const <RepresentantDto>[],
            prospects: const <ProspectDto>[],
            callCampaigns: const <SyncCallCampaignDto>[],
            callTasks: const <SyncCallTaskDto>[],
            visites: const <SyncVisiteDto>[],
          ),
          deletions: <SyncDeletionDto>[
            SyncDeletionDto(
              entity: SyncEntity.representant,
              id: 'repA',
              deletedAt: t0,
            ),
          ],
          nextCursor: 'cur-3',
          hasMore: false,
          serverTime: t0,
        ),
      );
      await engine.pullChanges();
      final Representant rep = (await db.select(db.representants).get()).single;
      expect(rep.deletedAt, t0);
    });

    test('un pull raté n\'annule pas un push réussi', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      api.pullPages.add(
        PullPage(
          changes: SyncChangesDto(
            departements: const <DepartementDto>[],
            iefs: const <IefDto>[],
            banques: const <BanqueDto>[],
            syndicats: const <SyndicatDto>[],
            canauxProvenance: const <CanalProvenanceDto>[],
            visiteReferentiels: const <SyncVisiteReferentielDto>[],
            representants: const <RepresentantDto>[],
            prospects: const <ProspectDto>[],
            callCampaigns: const <SyncCallCampaignDto>[],
            callTasks: const <SyncCallTaskDto>[],
            visites: const <SyncVisiteDto>[],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: '',
          hasMore: false,
          serverTime: t0,
        ),
      );
      final SyncOutcome first = await engine.runOnce();
      expect(first.isOk, isTrue);
      expect(first.pushed, 1);
    });

    test(
      'la file d’une campagne atterrit telle que le serveur l’a répartie',
      () async {
        api.pullPages.add(
          PullPage(
            changes: SyncChangesDto(
              departements: const <DepartementDto>[],
              iefs: const <IefDto>[],
              banques: const <BanqueDto>[],
              syndicats: const <SyndicatDto>[],
              canauxProvenance: const <CanalProvenanceDto>[],
              visiteReferentiels: const <SyncVisiteReferentielDto>[],
              representants: const <RepresentantDto>[],
              prospects: const <ProspectDto>[],
              callCampaigns: <SyncCallCampaignDto>[
                SyncCallCampaignDto(
                  id: 'camp-1',
                  name: 'Rentrée 2026',
                  status: CampaignStatus.ACTIVE,
                  spreadDays: 3,
                  updatedAt: t0,
                ),
              ],
              callTasks: <SyncCallTaskDto>[
                SyncCallTaskDto(
                  id: 'task-1',
                  campaignId: 'camp-1',
                  prospectId: 'pro-1',
                  position: 1,
                  dayIndex: 0,
                  status: CallTaskStatus.OPEN,
                  updatedAt: t0,
                ),
              ],
              visites: const <SyncVisiteDto>[],
            ),
            deletions: const <SyncDeletionDto>[],
            nextCursor: 'cur-2',
            hasMore: false,
            serverTime: t0,
          ),
        );

        await engine.pullChanges();

        final List<CallCampaign> campagnes = await db
            .select(db.callCampaigns)
            .get();
        expect(campagnes.single.name, 'Rentrée 2026');
        expect(campagnes.single.spreadDays, 3);

        final List<CallTask> file = await db.select(db.callTasks).get();
        expect(file.single.prospectId, 'pro-1');
        expect(file.single.position, 1);
      },
    );

    test(
      'une visite tirée complète la ligne posée hors ligne, référence comprise',
      () async {
        await db
            .into(db.visites)
            .insert(
              VisitesCompanion.insert(
                id: 'visite-1',
                date: '2026-08-12',
                time: const Value<String?>('09:12'),
                visitorName: 'Awa Ndiaye',
                entrepriseId: 'e1',
                entrepriseLabel: 'CPI',
                objetId: 'o1',
                objetLabel: 'Achat terrain',
                createdById: 'me',
                createdAt: t0,
                updatedAt: t0,
              ),
            );

        api.pullPages.add(
          PullPage(
            changes: SyncChangesDto(
              departements: const <DepartementDto>[],
              iefs: const <IefDto>[],
              banques: const <BanqueDto>[],
              syndicats: const <SyndicatDto>[],
              canauxProvenance: const <CanalProvenanceDto>[],
              visiteReferentiels: const <SyncVisiteReferentielDto>[],
              representants: const <RepresentantDto>[],
              prospects: const <ProspectDto>[],
              callCampaigns: const <SyncCallCampaignDto>[],
              callTasks: const <SyncCallTaskDto>[],
              visites: <SyncVisiteDto>[
                SyncVisiteDto(
                  id: 'visite-1',
                  reference: 'V-2026-000412',
                  date: '2026-08-12',
                  time: '09:12',
                  visitorName: 'Awa Ndiaye',
                  phone: null,
                  phoneE164: null,
                  entreprise: VisiteReferentielRefDto(
                    id: 'e1',
                    code: 'CPI',
                    label: 'CPI',
                  ),
                  objet: VisiteReferentielRefDto(
                    id: 'o1',
                    code: 'ACHAT_TERRAIN',
                    label: 'Achat terrain',
                  ),
                  direction: null,
                  destinataire: null,
                  comment: null,
                  createdById: 'me',
                  createdAt: t0,
                  updatedAt: t0,
                ),
              ],
            ),
            deletions: const <SyncDeletionDto>[],
            nextCursor: 'cur-2',
            hasMore: false,
            serverTime: t0,
          ),
        );

        await engine.pullChanges();

        final List<Visite> lignes = await db.select(db.visites).get();
        expect(lignes.single.reference, 'V-2026-000412');
        expect(lignes.single.visitorName, 'Awa Ndiaye');
      },
    );
  });

  group('SyncOutcome', () {
    test('un échec terminal ne demande pas de réessai au worker', () {
      const SyncOutcome outcome = SyncOutcome.failed(
        'FORBIDDEN',
        kind: FailureKind.terminal,
      );
      expect(outcome.shouldRetry, isFalse);
      expect(outcome.isOk, isFalse);
    });

    test('une session morte ne se réessaie pas non plus', () {
      const SyncOutcome outcome = SyncOutcome.failed(
        'session',
        kind: FailureKind.sessionExpired,
      );
      expect(outcome.shouldRetry, isFalse);
    });

    test('une coupure réseau, si', () {
      const SyncOutcome outcome = SyncOutcome.failed(
        'timeout',
        kind: FailureKind.retryable,
        pushed: 3,
      );
      expect(outcome.shouldRetry, isTrue);
      expect(outcome.pushed, 3);
    });

    /// Un APK sous le palier du serveur ne recevra rien de plus en réessayant :
    /// le worker doit rendre la main, et l'interface doit pouvoir DIRE pourquoi.
    test('une mise à jour requise ne se réessaie pas et se nomme', () {
      const SyncOutcome outcome = SyncOutcome.failed(
        ServerErrorCodes.appUpdateRequired,
        kind: FailureKind.appUpdateRequired,
      );
      expect(outcome.shouldRetry, isFalse);
      expect(outcome.requiresAppUpdate, isTrue);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Purge de l'outbox
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Rien ne supprimait jamais les lignes `done`. Sur un appareil en service
  // depuis un an, la file grossit indéfiniment : chaque sélection de lot balaie
  // des dizaines de milliers de lignes acquittées pour en trouver dix.

  group('purge des lignes acquittées', () {
    late AppDatabase db;
    late FakeClock clock;

    SyncEngine build() => SyncEngine(
      database: db,
      api: FakeApi(),
      tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
      clock: clock,
      random: Random(5),
    );

    setUp(() async {
      db = await openTestDatabase();
      clock = FakeClock(t0);
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
    });
    tearDown(() => db.close());

    Future<void> queueDone(String id, DateTime createdAt) async {
      await queueOp(db, id: id, entityType: 'representant', entityId: 'repA');
      await (db.update(db.outbox)..where((Outbox o) => o.id.equals(id))).write(
        OutboxCompanion(
          status: const Value<String>(OutboxStatus.done),
          createdAt: Value<DateTime>(createdAt),
        ),
      );
    }

    test('une ligne acquittée finit par quitter la file', () async {
      await queueDone('vieille', t0.subtract(const Duration(days: 30)));
      expect(await build().purgeAcknowledged(), 1);
      expect(await db.select(db.outbox).get(), isEmpty);
    });

    /// La rétention laisse le temps de diagnostiquer un envoi contesté quelques
    /// jours plus tard : purger à l'acquittement rendrait la question sans
    /// réponse.
    test('une ligne acquittée hier reste diagnosticable', () async {
      await queueDone('recente', t0.subtract(const Duration(days: 1)));
      expect(await build().purgeAcknowledged(), 0);
    });

    test('rien d\'ouvert n\'est emporté, si vieux soit-il', () async {
      await queueOp(
        db,
        id: 'ouverte',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.failed,
      );
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.id.equals('ouverte'))).write(
        OutboxCompanion(
          createdAt: Value<DateTime>(t0.subtract(const Duration(days: 300))),
        ),
      );
      expect(await build().purgeAcknowledged(), 0);
    });

    test('la vidange purge d\'elle-même', () async {
      await queueDone('vieille', t0.subtract(const Duration(days: 30)));
      await build().drain();
      expect(await db.select(db.outbox).get(), isEmpty);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Référentiel des motifs d'issue
  // ─────────────────────────────────────────────────────────────────────────

  group('motifs d\'issue : le référentiel ne coupe pas la file', () {
    late AppDatabase db;
    late FakeApi api;
    late SyncEngine engine;

    setUp(() async {
      db = await openTestDatabase();
      api = FakeApi();
      engine = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: FakeClock(t0),
        random: Random(23),
      );
      await db
          .into(db.callOutcomeReasons)
          .insert(
            CallOutcomeReasonsCompanion.insert(
              code: 'RETIRE',
              label: 'Motif retiré du web',
              effect: CallEffects.keepOpen,
            ),
          );
    });
    tearDown(() => db.close());

    CallOutcomeReasonDto dto(String code) => CallOutcomeReasonDto(
      id: 'r-$code',
      code: code,
      label: code,
      effect: CallOutcomeEffect.KEEP_OPEN,
      requiresComment: false,
      requiresCallback: false,
      countsAsReached: false,
      isActive: true,
      isSystem: false,
      sortOrder: 10,
      color: null,
      minPayloadVersion: 1,
      updatedAt: t0,
    );

    /// ═══ UN MOTIF SUPPRIMÉ CÔTÉ WEB CONDAMNAIT DES TENTATIVES DÉJÀ SAISIES ═══
    ///
    /// Le tirage vidait la table ENTIÈRE puis réinsérait. Une tentative encore
    /// en file qui cite le motif retiré devient alors illisible pour
    /// `_toOperation` : `PAYLOAD_SCHEMA_MISMATCH`, échec définitif, sur une
    /// saisie parfaitement valide au moment où elle a été faite.
    test('un motif encore cité par la file survit au tirage', () async {
      await queueOp(
        db,
        id: 'T1',
        entityType: callAttemptEntity,
        entityId: 'att-1',
        payload: <String, Object?>{
          'prospectId': 'pro-1',
          'outcome': CallOutcomes.unreachable,
          'reasonCode': 'RETIRE',
          'clientCreatedAt': '2026-08-12T09:00:00.000Z',
        },
      );
      api.callOutcomeReasons.add(dto('NRP'));

      await engine.pullCallOutcomeReasons();

      final Set<String> codes = (await db.select(db.callOutcomeReasons).get())
          .map((CallOutcomeReason r) => r.code)
          .toSet();
      expect(codes, containsAll(<String>['RETIRE', 'NRP']));
    });

    test('un motif que plus rien ne cite s\'en va', () async {
      api.callOutcomeReasons.add(dto('NRP'));

      await engine.pullCallOutcomeReasons();

      final Set<String> codes = (await db.select(db.callOutcomeReasons).get())
          .map((CallOutcomeReason r) => r.code)
          .toSet();
      expect(codes, <String>{'NRP'});
    });
  });

  group('StubApi', () {
    const StubApi api = StubApi();

    test('refuse des identifiants vides', () {
      expect(
        () => api.login(identifier: '  ', password: 'x'),
        throwsA(isA<ApiException>()),
      );
      expect(
        () => api.login(identifier: 'a', password: ''),
        throwsA(isA<ApiException>()),
      );
    });

    test('rend un couple de jetons pour du développement', () async {
      final AuthTokens tokens = await api.login(
        identifier: 'commercial',
        password: 'secret',
      );
      expect(tokens.accessToken, startsWith('stub.'));
      expect(tokens.refreshToken, startsWith('stub.'));
      expect(tokens.expiresAt.isAfter(DateTime.now().toUtc()), isTrue);
    });

    test('push échoue explicitement au lieu de faire semblant', () {
      expect(
        () => api.push(
          batchId: 'b1',
          payloadVersion: SyncEngine.payloadVersion,
          operations: const <SyncOperationDto>[],
        ),
        throwsA(
          isA<ApiException>().having(
            (ApiException e) => e.code,
            'code',
            'api_not_configured',
          ),
        ),
      );
    });

    test('le lookup ne prétend jamais connaître un numéro', () async {
      final RepresentantLookup lookup = await api.lookupRepresentantByPhone(
        '+221770000001',
      );
      expect(lookup.found, isFalse);
      expect(lookup.ownedByCommercialId, isNull);
    });
  });

  group('ApiException', () {
    test('seuls les échecs transitoires sont réessayables', () {
      expect(
        const ApiException('x', kind: FailureKind.retryable).retryable,
        isTrue,
      );
      expect(
        const ApiException('x', kind: FailureKind.throttled).retryable,
        isTrue,
      );
      expect(
        const ApiException(
          'x',
          kind: FailureKind.idempotencyInProgress,
        ).retryable,
        isTrue,
      );
      expect(
        const ApiException('x', kind: FailureKind.unreachable).retryable,
        isTrue,
      );
      expect(
        const ApiException('x', kind: FailureKind.terminal).retryable,
        isFalse,
      );
      expect(
        const ApiException('x', kind: FailureKind.sessionExpired).retryable,
        isFalse,
      );
    });

    test('seul le lien mort se déclare injoignable', () {
      expect(
        const ApiException('x', kind: FailureKind.unreachable).isUnreachable,
        isTrue,
      );
      expect(
        const ApiException('x', kind: FailureKind.retryable).isUnreachable,
        isFalse,
      );
    });
  });

  group('InMemoryTokenStore', () {
    test('le jeton d\'accès ne survit pas à clear()', () async {
      final InMemoryTokenStore store = InMemoryTokenStore(userId: 'me');
      await store.save(accessToken: 'a', refreshToken: 'r');
      expect(store.accessToken, 'a');
      expect(await store.readRefreshToken(), 'r');
      expect(await store.readUserId(), 'me');
      await store.clear();
      expect(store.accessToken, isNull);
      expect(await store.readRefreshToken(), isNull);
      expect(await store.readUserId(), isNull);
    });
  });

  group('FakeClock', () {
    test('n\'avance que sur demande', () {
      final FakeClock clock = FakeClock(DateTime.utc(2026, 1, 1));
      final DateTime first = clock.now();
      expect(clock.now(), first);
      clock.advance(const Duration(hours: 3));
      expect(clock.now(), first.add(const Duration(hours: 3)));
    });
  });
}

class _Interrupted implements Exception {
  const _Interrupted();
}

/// Verdict « ton parent n'est pas passé » : le serveur a répondu, mais il n'a
/// pas jugé l'opération.
SyncOperationResultDto _blockedOn(String opId) => SyncOperationResultDto(
  opId: opId,
  status: SyncOpStatus.skippedDependencyFailed,
  entityId: null,
  rev: null,
  serverUpdatedAt: null,
  errorCode: ServerErrorCodes.parentRepresentantFailed,
  error: 'Le représentant n\'est pas passé.',
);

/// Tirage nul : le délai de back-off vaut alors exactement zéro, ce qu'une gigue
/// égale ne peut pas produire.
class _ZeroRandom implements Random {
  @override
  bool nextBool() => false;

  @override
  double nextDouble() => 0;

  @override
  int nextInt(int max) => 0;
}
