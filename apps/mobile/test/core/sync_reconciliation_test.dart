import 'dart:convert';
import 'dart:math';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Réconciliation de la file : les cas où le client se contredisait lui-même.
///
/// Chacun de ces tests échoue si on retire la ligne de code qu'il couvre. Ce
/// sont tous des scénarios hors ligne réels, pas des cas limites théoriques :
/// deux corrections d'affilée, une purge de fin de journée, un téléphone dont
/// l'horloge a été remise à l'heure.
void main() {
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

  // ───────────────────────────────────────────────────────────────────────────
  // A1 : le REV_CONFLICT que l'appareil s'infligeait à lui-même
  // ───────────────────────────────────────────────────────────────────────────

  group('baseRev : deux corrections d\'affilée ne se contredisent pas', () {
    Future<void> seedTwiceEdited() async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 3,
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        baseRev: 3,
        payload: <String, Object?>{'fullName': 'Awa'},
      );
      await queueOp(
        db,
        id: 'U2',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        baseRev: 3,
        payload: <String, Object?>{'fullName': 'Awa Ndiaye'},
      );
    }

    test('deux écritures d\'une même fiche ne voyagent pas dans le même lot', () async {
      await seedTwiceEdited();
      await engine.drain();

      // Deux lots, un par écriture. Ensemble, la seconde opposerait encore la
      // révision 3 alors que la première vient de faire passer le serveur à 4 :
      // `REV_CONFLICT` auto-infligé, et la clé entière empoisonnée.
      expect(api.calls, hasLength(2));
      expect(api.calls[0].opIds, <String>['U1']);
      expect(api.calls[1].opIds, <String>['U2']);

      expect(
        api.calls[0].operations.single.baseRev,
        3,
        reason: 'la garde protège des autres appareils',
      );
      expect(
        api.calls[1].operations.single.baseRev,
        1,
        reason:
            'recalée sur la révision que le serveur a RÉELLEMENT attribuée, pas '
            'sur une révision devinée. La retirer en ferait une écriture '
            'inconditionnelle, et le serveur poursuit son groupe après un refus '
            'par révision : elle écraserait le changement d\'un autre appareil',
      );
      for (final OutboxData row in await allOutbox(db)) {
        expect(row.status, OutboxStatus.done);
      }
    });

    test(
      'entre deux lots, la suivante est recalée sur la révision rendue',
      () async {
        await seedTwiceEdited();
        // U2 n'est pas encore due : elle partira au tour suivant, donc dans un
        // AUTRE lot, où la protection intra-lot ne joue pas.
        await (db.update(
          db.outbox,
        )..where((Outbox o) => o.id.equals('U2'))).write(
          OutboxCompanion(
            nextAttemptAt: Value<DateTime>(t0.add(const Duration(minutes: 10))),
          ),
        );
        api.verdicts['U1'] = SyncOperationResultDto(
          opId: 'U1',
          status: SyncOpStatus.applied,
          entityId: 'repA',
          rev: 4,
          serverUpdatedAt: t0,
          errorCode: null,
          error: null,
        );

        await engine.drain();

        final OutboxData u2 = await outboxById(db, 'U2');
        expect(
          u2.baseRev,
          4,
          reason:
              'sans recalage, elle repart avec 3 et revient en REV_CONFLICT',
        );
      },
    );

    test(
      'une écriture aveugle le reste : un baseRev nul n\'est jamais renseigné',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'C1',
          entityType: 'representant',
          entityId: 'repA',
        );
        await queueOp(
          db,
          id: 'U1',
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          nextAttemptAt: t0.add(const Duration(minutes: 10)),
        );
        api.verdicts['C1'] = SyncOperationResultDto(
          opId: 'C1',
          status: SyncOpStatus.applied,
          entityId: 'repA',
          rev: 1,
          serverUpdatedAt: t0,
          errorCode: null,
          error: null,
        );

        await engine.drain();

        expect(
          (await outboxById(db, 'U1')).baseRev,
          isNull,
          reason:
              'renseigner après coup transformerait une écriture assumée aveugle '
              'en écriture conditionnelle qui peut désormais échouer',
        );
      },
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A2 : corriger une tête bloquée, sur place
  // ───────────────────────────────────────────────────────────────────────────

  group('correction d\'une tête bloquée', () {
    late WriteRepository repo;

    setUp(() => repo = WriteRepository(db, clock: clock));

    Future<int> blockedCreate({String status = OutboxStatus.conflict}) async {
      final String id = await repo.createRepresentant(
        fullName: 'Awa',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        createdById: 'me',
        id: 'repA',
      );
      await (db.update(
        db.outbox,
      )..where((Outbox o) => o.entityId.equals(id))).write(
        OutboxCompanion(
          status: Value<String>(status),
          attempts: const Value<int>(5),
          lastErrorCode: const Value<String?>('REPRESENTANT_PHONE_CONFLICT'),
          lastErrorMsg: const Value<String?>('Numéro déjà pris.'),
          batchId: const Value<String?>('lot-precedent'),
        ),
      );
      return (await allOutbox(db)).single.seq;
    }

    test(
      'la modification réécrit la création bloquée au lieu d\'empiler',
      () async {
        await blockedCreate();
        await repo.updateRepresentant(
          id: 'repA',
          fullName: 'Awa Ndiaye',
          phoneE164: '+221770000009',
          departementId: 'dep-1',
        );

        final List<OutboxData> rows = await allOutbox(db);
        expect(
          rows,
          hasLength(1),
          reason:
              'un update empilé derrière une create en conflit reste derrière une '
              'tête empoisonnée : le sélecteur ignore la clé, il ne partira jamais',
        );
        final OutboxData amended = rows.single;
        expect(amended.op, 'create');
        expect(amended.status, OutboxStatus.pending);
        expect(amended.attempts, 0);
        expect(amended.lastErrorCode, isNull);
        expect(
          amended.batchId,
          isNull,
          reason: 'contenu différent, clé d\'idempotence neuve',
        );

        final Map<String, Object?> payload =
            jsonDecode(amended.payload) as Map<String, Object?>;
        expect(payload['fullName'], 'Awa Ndiaye');
        expect(payload['phone'], '+221770000009');
        expect(
          payload['clientCreatedAt'],
          isNotNull,
          reason: 'la fusion garde les champs que seule la création porte',
        );
      },
    );

    test('la correction repart réellement au serveur', () async {
      await blockedCreate();
      await repo.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Ndiaye',
        phoneE164: '+221770000009',
        departementId: 'dep-1',
      );

      await engine.drain();

      expect(api.calls, hasLength(1));
      final SyncOperationDto sent = api.calls.single.operations.single;
      expect(sent.data?.fullName, 'Awa Ndiaye');
    });

    test(
      'une tête saine n\'est PAS réécrite : l\'ordre reste intact',
      () async {
        await repo.createRepresentant(
          fullName: 'Awa',
          phoneE164: '+221770000001',
          departementId: 'dep-1',
          createdById: 'me',
          id: 'repA',
        );
        await repo.updateRepresentant(
          id: 'repA',
          fullName: 'Awa Ndiaye',
          phoneE164: '+221770000001',
          departementId: 'dep-1',
        );
        expect(await allOutbox(db), hasLength(2));
      },
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A3 : le pull n'écrase pas une saisie qui n'est pas encore partie
  // ───────────────────────────────────────────────────────────────────────────

  group('pull : une écriture locale en attente n\'est pas écrasée', () {
    test('la fiche modifiée localement garde sa valeur', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        fullName: 'Awa Ndiaye',
        rev: 1,
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        baseRev: 1,
        payload: <String, Object?>{'fullName': 'Awa Ndiaye'},
      );
      api.pullPages.add(
        pullPageWithRepresentant(
          representantDto(
            id: 'repA',
            phoneE164: '+221770000001',
            fullName: 'Awa',
            rev: 7,
          ),
        ),
      );

      await engine.pullChanges();

      final Representant row = await (db.select(
        db.representants,
      )..where((Representants t) => t.id.equals('repA'))).getSingle();
      expect(
        row.fullName,
        'Awa Ndiaye',
        reason:
            'les saisies locales n\'incrémentent pas rev : le LWW du pull gagne '
            'toujours, et la correction disparaît de l\'écran',
      );
    });

    test('sans écriture en attente, le pull applique normalement', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        fullName: 'Awa Ndiaye',
        rev: 1,
        serverUpdatedAt: t0,
      );
      api.pullPages.add(
        pullPageWithRepresentant(
          representantDto(
            id: 'repA',
            phoneE164: '+221770000001',
            fullName: 'Awa',
            rev: 7,
          ),
        ),
      );

      await engine.pullChanges();

      final Representant row = await (db.select(
        db.representants,
      )..where((Representants t) => t.id.equals('repA'))).getSingle();
      expect(row.fullName, 'Awa');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A4 : « Réessayer » et « Supprimer » ne touchent pas une requête en vol
  // ───────────────────────────────────────────────────────────────────────────

  group('actions manuelles face à une ligne en vol', () {
    late WriteRepository repo;

    setUp(() => repo = WriteRepository(db, clock: clock));

    Future<OutboxData> inFlight() async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.syncing,
        leaseUntil: t0.add(const Duration(minutes: 2)),
      );
      return outboxById(db, 'A1');
    }

    test('retryOperation refuse une ligne `syncing` sous bail vivant', () async {
      final OutboxData row = await inFlight();

      expect(await repo.retryOperation(row.seq), isFalse);

      final OutboxData after = await outboxById(db, 'A1');
      expect(after.status, OutboxStatus.syncing);
      expect(
        after.leaseUntil,
        isNotNull,
        reason:
            'effacer le bail rend la ligne resélectionnable pendant son envoi',
      );
    });

    test('retryOperation agit sur une ligne `failed`', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        status: OutboxStatus.failed,
        attempts: 8,
      );
      final OutboxData row = await outboxById(db, 'A1');

      expect(await repo.retryOperation(row.seq), isTrue);
      final OutboxData after = await outboxById(db, 'A1');
      expect(after.status, OutboxStatus.pending);
      expect(after.attempts, 0);
    });

    test('discardOperation refuse une ligne que le serveur applique', () async {
      final OutboxData row = await inFlight();

      expect(
        (await repo.discardOperation(row.seq)).outcome,
        DiscardOutcome.claimed,
        reason:
            'supprimer la ligne locale laisserait un enregistrement serveur orphelin',
      );
      expect(await allOutbox(db), hasLength(1));
    });

    /// ═══ CE TEST DISAIT L'INVERSE, ET C'ÉTAIT LE BUG ═══
    ///
    /// Il affirmait qu'un bail périmé rend l'abandon possible. Or un bail
    /// périmé ne dit rien de l'envoi : il dit seulement que l'envoi dure plus
    /// longtemps que prévu, ce qui est le cas ordinaire sur un lien 2G. La
    /// ligne reste réservée, sa requête reste en vol, et la supprimer laisse un
    /// enregistrement serveur orphelin.
    ///
    /// Ce qui rend l'abandon possible, c'est la **reprise** : elle efface le
    /// jeton, donc déclare le porteur mort, donc rend la ligne libre. Et elle
    /// tourne en tête de chaque vidange, réseau ou pas : l'attente est bornée.
    test('un bail périmé ne suffit pas ; la reprise, oui', () async {
      final OutboxData row = await inFlight();
      clock.advance(const Duration(minutes: 3));

      expect(
        (await repo.discardOperation(row.seq)).outcome,
        DiscardOutcome.claimed,
        reason: 'un bail périmé n\'est pas la preuve que personne n\'envoie',
      );

      expect(await engine.reclaimExpiredLeases(), 1);
      expect((await repo.discardOperation(row.seq)).removed, 1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Verdicts mémorisés rejoués : un `duplicate` n'est pas un succès
  // ───────────────────────────────────────────────────────────────────────────

  group('verdict rejoué sous statut duplicate', () {
    Future<void> seedCallAttempt() async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(
        db,
        id: 'p1',
        representantId: 'repA',
        phone: '+221770000002',
      );
      await queueOp(
        db,
        id: 'CA1',
        entityType: 'call_attempt',
        entityId: 'att-1',
        dependencyKey: 'phase2:p1',
        payload: <String, Object?>{
          'prospectId': 'p1',
          'outcome': 'REFUSED',
          'clientCreatedAt': '2026-08-12T09:00:00.000Z',
        },
      );
    }

    test('PHASE2_ALREADY_COMPLETED atterrit en conflit, pas en échec', () async {
      await seedCallAttempt();
      api.verdicts['CA1'] = SyncOperationResultDto(
        opId: 'CA1',
        status: SyncOpStatus.duplicate,
        entityId: 'att-1',
        rev: null,
        serverUpdatedAt: null,
        errorCode: ServerErrorCodes.phase2AlreadyCompleted,
        error: 'Dossier déjà clos.',
      );

      await engine.drain();

      expect(
        (await outboxById(db, 'CA1')).status,
        OutboxStatus.conflict,
        reason:
            'c\'est un arbitrage entre deux commerciaux, pas une saisie fautive : '
            'en `failed`, l\'app envoie corriger une tentative valide',
      );
    });

    test(
      'une dépendance non résolue rejouée repart bloquée, pas en échec',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await insertProspect(
          db,
          id: 'p1',
          representantId: 'repA',
          phone: '+221770000002',
        );
        await queueOp(
          db,
          id: 'P1',
          entityType: 'prospect',
          entityId: 'p1',
          dependencyKey: 'repA',
          payload: <String, Object?>{'representantId': 'repA'},
        );
        api.verdicts['P1'] = SyncOperationResultDto(
          opId: 'P1',
          status: SyncOpStatus.duplicate,
          entityId: 'p1',
          rev: null,
          serverUpdatedAt: null,
          errorCode: ServerErrorCodes.parentRepresentantFailed,
          error: 'Le parent n\'est pas passé.',
        );

        await engine.drain();

        final OutboxData row = await outboxById(db, 'P1');
        expect(
          row.status,
          OutboxStatus.pending,
          reason:
              'la faute est celle du parent ; cette ligne n\'a rien à corriger',
        );
        expect(row.blockedAttempts, 1);
        expect(
          row.attempts,
          0,
          reason: 'ses huit essais serveur restent intacts',
        );
      },
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A7 : compter les groupes comme le serveur les compte
  // ───────────────────────────────────────────────────────────────────────────

  group('plafond de groupes : la règle du serveur, pas la nôtre', () {
    test('les suppressions de prospects comptent une par une', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      for (int i = 0; i < 30; i++) {
        await insertProspect(
          db,
          id: 'p$i',
          representantId: 'repA',
          phone: '+22177000${1000 + i}',
        );
        await queueOp(
          db,
          id: 'D$i',
          entityType: 'prospect',
          entityId: 'p$i',
          op: 'delete',
          dependencyKey: 'repA',
        );
      }

      final List<OutboxData> batch = await engine.selectBatch();

      // `dependencyKeyOf` (apps/api, modules/sync/dto.ts) classe un delete de
      // prospect en `prospect:<id>` parce que son corps est vide : trente
      // suppressions font trente groupes, et le serveur refuse au-delà de 25 en
      // 400, donc en TERMINAL, donc tout le lot part en `failed`.
      expect(
        batch,
        hasLength(engine.maxBatchGroups),
        reason: 'le client n\'en comptait qu\'un seul, sur repA',
      );
      expect(
        batch.map(SyncEngine.serverGroupKey).toSet(),
        hasLength(engine.maxBatchGroups),
      );
    });

    test(
      'les créations de prospects restent groupées sur leur représentant',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );
        for (int i = 0; i < 30; i++) {
          await insertProspect(
            db,
            id: 'p$i',
            representantId: 'repA',
            phone: '+22177000${2000 + i}',
          );
          await queueOp(
            db,
            id: 'C$i',
            entityType: 'prospect',
            entityId: 'p$i',
            dependencyKey: 'repA',
            payload: <String, Object?>{'representantId': 'repA'},
          );
        }

        final List<OutboxData> batch = await engine.selectBatch();
        expect(
          batch,
          hasLength(31),
          reason:
              'un create de prospect porte representantId : un seul groupe serveur',
        );
      },
    );

    test('serverGroupKey reproduit dependencyKeyOf du serveur', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'R', entityType: 'representant', entityId: 'repA');
      await insertProspect(
        db,
        id: 'p1',
        representantId: 'repA',
        phone: '+221770000002',
      );
      await queueOp(
        db,
        id: 'PC',
        entityType: 'prospect',
        entityId: 'p1',
        payload: <String, Object?>{'representantId': 'repA'},
      );
      await queueOp(
        db,
        id: 'PD',
        entityType: 'prospect',
        entityId: 'p1',
        op: 'delete',
      );
      await queueOp(
        db,
        id: 'CA',
        entityType: 'call_attempt',
        entityId: 'att-1',
        payload: <String, Object?>{'prospectId': 'p1'},
      );

      expect(
        SyncEngine.serverGroupKey(await outboxById(db, 'R')),
        'representant:repA',
      );
      expect(
        SyncEngine.serverGroupKey(await outboxById(db, 'PC')),
        'representant:repA',
      );
      expect(
        SyncEngine.serverGroupKey(await outboxById(db, 'PD')),
        'prospect:p1',
      );
      expect(
        SyncEngine.serverGroupKey(await outboxById(db, 'CA')),
        'prospect:p1',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A8 : une horloge qui recule ne doit pas figer la file
  // ───────────────────────────────────────────────────────────────────────────

  group('horloge remise à l\'heure', () {
    test('une échéance absurde est ramenée à maintenant', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      // Écrite quand le téléphone croyait être trois jours plus tard.
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        nextAttemptAt: t0.add(const Duration(days: 3)),
      );

      expect(await engine.selectBatch(), isEmpty);

      expect(await engine.repairClockDrift(), 1);
      expect((await engine.selectBatch()).map((OutboxData o) => o.id), <String>[
        'A1',
      ]);
    });

    test('un back-off normal n\'est PAS raboté', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        nextAttemptAt: t0.add(const Duration(minutes: 5)),
      );

      expect(await engine.repairClockDrift(), 0);
      expect(await engine.selectBatch(), isEmpty);
    });

    /// ═══ LA RÉPARATION D'HORLOGE EFFAÇAIT L'ATTENTE EXIGÉE PAR LE SERVEUR ═══
    ///
    /// Le plafond de plausibilité était celui du back-off, 15 minutes. Or la
    /// branche `FailureKind.throttled` écrit `now + retryAfter`, c'est-à-dire ce
    /// que le serveur impose, et `retryAfterOf` admet jusqu'à une heure. Un
    /// `Retry-After: 1800` était donc pris pour une horloge déréglée et ramené à
    /// maintenant au tour de vidange suivant, moins de 60 secondes plus tard :
    /// le client repartait pousser dans le limiteur de débit, qui le limitait de
    /// nouveau, indéfiniment.
    ///
    /// Les deux mécanismes sont exercés ENSEMBLE ici : les tests d'origine
    /// restaient tous sous les 15 minutes, donc aucun ne pouvait les voir se
    /// contredire.
    test(
      'une limitation de 30 minutes survit à la réparation d\'horloge',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );

        api.failNextPush = const ApiException(
          'RATE_LIMITED',
          statusCode: 429,
          kind: FailureKind.throttled,
          retryAfter: Duration(minutes: 30),
        );
        await engine.drain();

        final DateTime due = (await outboxById(db, 'A1')).nextAttemptAt;
        expect(due, t0.add(const Duration(minutes: 30)));

        // Le tour suivant, une minute plus tard : c'est là que la réparation
        // d'horloge passait l'éponge sur l'attente.
        clock.advance(const Duration(minutes: 1));
        expect(await engine.repairClockDrift(), 0);
        expect(
          (await outboxById(db, 'A1')).nextAttemptAt,
          due,
          reason: 'le serveur a dit d\'attendre : c\'est lui qui décide',
        );
        expect(await engine.selectBatch(), isEmpty);
        expect(
          api.calls,
          hasLength(1),
          reason: 'repousser tout de suite, c\'est se faire limiter à nouveau',
        );

        // Et l'attente reste bornée : passé le délai, la file repart seule.
        clock.advance(const Duration(minutes: 30));
        expect(
          (await engine.selectBatch()).map((OutboxData o) => o.id),
          <String>['A1'],
        );
      },
    );

    /// Une échéance VRAIMENT absurde reste rabotée : le correctif déplace la
    /// borne, il ne la supprime pas.
    test(
      'au-delà de la borne commune, l\'échéance est toujours ramenée',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
          nextAttemptAt: t0.add(const Duration(hours: 2)),
        );

        expect(await engine.repairClockDrift(), 1);
        expect(
          (await engine.selectBatch()).map((OutboxData o) => o.id),
          <String>['A1'],
        );
      },
    );

    test(
      'un bail plus long que la durée de bail est ramené, la file repart',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
          status: OutboxStatus.syncing,
          leaseUntil: t0.add(const Duration(days: 3)),
        );

        expect(await engine.repairClockDrift(), 1);
        expect(await engine.reclaimExpiredLeases(), 1);
        expect((await outboxById(db, 'A1')).status, OutboxStatus.pending);
      },
    );

    test('la vidange répare toute seule', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        nextAttemptAt: t0.add(const Duration(days: 3)),
      );

      expect(await engine.drain(), 1);
      expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // A9 : deux isolats, une base
  // ───────────────────────────────────────────────────────────────────────────

  group('vol unique inter-isolat', () {
    test('deux moteurs sur la même base ne se partagent jamais une ligne', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      await queueOp(db, id: 'B1', entityType: 'representant', entityId: 'repB');

      // Le worker WorkManager construit SON moteur sur la même base : `_draining`
      // est un champ d'instance, il ne le voit pas.
      final SyncEngine worker = SyncEngine(
        database: db,
        api: FakeApi(),
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: clock,
        random: Random(2),
      );

      // VRAIMENT concurrents : `Future.wait` fait s'entrelacer les deux
      // sélections aux points d'attente, exactement comme le worker et l'app
      // ouverte. Sans transaction englobante, les deux voient les deux lignes
      // `pending` et les envoient chacun de leur côté.
      final List<List<OutboxData>> claims = await Future.wait(
        <Future<List<OutboxData>>>[engine.claimBatch(), worker.claimBatch()],
      );
      final List<String> taken = <String>[
        for (final List<OutboxData> claim in claims)
          for (final OutboxData row in claim) row.id,
      ];

      expect(
        taken..sort(),
        <String>['A1', 'B1'],
        reason:
            'sans réservation atomique, les deux isolats émettent le même lot '
            'sous deux clés d\'idempotence que le serveur ne peut pas rapprocher',
      );
    });

    test(
      'deux vidanges concurrentes n\'émettent jamais deux fois la même op',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await insertRepresentant(db, id: 'repB', phone: '+221770000002');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );
        await queueOp(
          db,
          id: 'B1',
          entityType: 'representant',
          entityId: 'repB',
        );

        // MÊME faux serveur pour les deux moteurs : du point de vue du serveur, le
        // worker et l'app frappent la même route. Deux envois du même `opId` sous
        // deux `batchId` différents sont indistinguables d'une double écriture.
        final SyncEngine worker = SyncEngine(
          database: db,
          api: api,
          tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
          clock: clock,
          random: Random(2),
        );

        await Future.wait<int>(<Future<int>>[engine.drain(), worker.drain()]);

        expect(
          api.receivedOpIds..sort(),
          <String>['A1', 'B1'],
          reason:
              'chaque opération part exactement une fois, tous isolats confondus',
        );
      },
    );

    test(
      'la réservation pose le bail dans la transaction de sélection',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );

        final List<OutboxData> claimed = await engine.claimBatch();

        expect(claimed.single.status, OutboxStatus.syncing);
        expect(claimed.single.leaseUntil, t0.add(engine.leaseDuration));
        expect((await outboxById(db, 'A1')).status, OutboxStatus.syncing);
      },
    );

    test(
      'une ligne déjà réservée par l\'autre isolat n\'est pas reprise',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
          status: OutboxStatus.syncing,
          leaseUntil: t0.add(const Duration(minutes: 2)),
        );
        expect(await engine.claimBatch(), isEmpty);
      },
    );
  });
}

/// Une page de pull ne portant qu'un représentant. Le reste des collections est
/// vide : ce qui nous intéresse est l'arbitrage, pas le volume.
PullPage pullPageWithRepresentant(RepresentantDto dto) {
  return PullPage(
    changes: SyncChangesDto(
      departements: const <DepartementDto>[],
      iefs: const <IefDto>[],
      banques: const <BanqueDto>[],
      syndicats: const <SyndicatDto>[],
      representants: <RepresentantDto>[dto],
      prospects: const <ProspectDto>[],
      callCampaigns: const <SyncCallCampaignDto>[],
      callTasks: const <SyncCallTaskDto>[],
      visites: const <SyncVisiteDto>[],
    ),
    deletions: const <SyncDeletionDto>[],
    nextCursor: 'c1',
    hasMore: false,
    serverTime: t0,
  );
}
