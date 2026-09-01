import 'dart:math';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/dio_api.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/reference_repository.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Campagne QA « synchronisation ». Chaque test NOMME le défaut qu'il montre.
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

  // ── SYN-01 : la clé d'idempotence est rejouée sur un CONTENU différent ──────

  group('SYN-01 clé d\'idempotence rejouée sur un autre contenu', () {
    test('un renvoi partiel garde le batchId du lot complet', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      await insertRepresentant(db, id: 'repC', phone: '+221770000003');
      for (final String id in <String>['A', 'B', 'C']) {
        await queueOp(
          db,
          id: 'OP$id',
          entityType: 'representant',
          entityId: 'rep$id',
          op: 'update',
          baseRev: 1,
          payload: <String, Object?>{'fullName': 'Awa $id'},
        );
      }
      // Le serveur juge le lot ENTIER : deux appliquées, une non jugée parce
      // que son groupe a été annulé. Elle repart donc seule au tour suivant.
      api.verdicts['OPC'] = SyncOperationResultDto(
        opId: 'OPC',
        status: SyncOpStatus.skippedDependencyFailed,
        entityId: null,
        rev: null,
        serverUpdatedAt: null,
        errorCode: ServerErrorCodes.parentRepresentantFailed,
        error: 'Groupe non jugé.',
      );
      api.verdictsAreOneShot = true;

      await engine.drain();
      expect(api.calls, hasLength(1));
      expect(api.calls.first.operations, hasLength(3));

      clock.advance(const Duration(minutes: 5));
      await engine.drain();

      expect(api.calls, hasLength(2));
      expect(api.calls[1].operations, hasLength(1));
      expect(
        api.calls[1].batchId,
        isNot(api.calls.first.batchId),
        reason:
            'Un corps différent exige une clé neuve : sinon le serveur répond '
            '422 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD et la file '
            'entière bascule en échec.',
      );
    });

    test('« Réessayer » depuis « À corriger » garde aussi le batchId', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      for (final String id in <String>['A', 'B']) {
        await queueOp(
          db,
          id: 'OP$id',
          entityType: 'representant',
          entityId: 'rep$id',
          op: 'update',
          baseRev: 1,
          payload: <String, Object?>{'fullName': 'Awa $id'},
        );
      }
      api.verdicts['OPB'] = invalidOn('OPB');
      await engine.drain();

      final OutboxData refusee = await outboxById(db, 'OPB');
      expect(refusee.status, OutboxStatus.failed);
      expect(refusee.batchId, api.calls.first.batchId);

      await WriteRepository(db, clock: clock).retryOperation(refusee.seq);
      final OutboxData reprise = await outboxById(db, 'OPB');
      expect(
        reprise.batchId,
        isNull,
        reason:
            'le renvoi manuel réutilise sinon la clé d\'un lot de DEUX '
            'opérations pour n\'en envoyer qu\'une : refus définitif, et le '
            'bouton « Réessayer » ne peut plus rien débloquer',
      );
    });

    test('un 422 de clé réutilisée est classé « terminal »', () {
      final ApiException e = DioApi.classify(
        DioException(
          requestOptions: RequestOptions(path: '/api/v1/sync/push'),
          type: DioExceptionType.badResponse,
          response: Response<Object?>(
            requestOptions: RequestOptions(path: '/api/v1/sync/push'),
            statusCode: 422,
            data: <String, Object?>{
              'code': 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
              'message': 'Cette clé d\'idempotence a déjà servi.',
            },
          ),
        ),
        'push',
      );
      expect(e.kind, FailureKind.terminal);
      expect(e.rejectedOperations, isEmpty);
    });

    test('un refus terminal anonyme condamne TOUT le lot', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertRepresentant(db, id: 'repB', phone: '+221770000002');
      for (final String id in <String>['A', 'B']) {
        await queueOp(
          db,
          id: 'OP$id',
          entityType: 'representant',
          entityId: 'rep$id',
          op: 'update',
          baseRev: 1,
          payload: <String, Object?>{'fullName': 'Awa $id'},
        );
      }
      api.failNextPush = const ApiException(
        'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
        message: 'Cette clé d\'idempotence a déjà servi.',
        statusCode: 422,
        kind: FailureKind.terminal,
      );

      await engine.drain();

      for (final String id in <String>['A', 'B']) {
        expect((await outboxById(db, 'OP$id')).status, OutboxStatus.failed);
      }
    });
  });

  // ── SYN-02 : la déconnexion ne rend pas l'appareil vierge ──────────────────

  group('SYN-02 changement de compte', () {
    test('ce que `signOut` efface laisse la base du commercial précédent', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await insertProspect(
        db,
        id: 'p-1',
        representantId: 'rep-1',
        phone: '+221770000001',
        createdById: 'awa',
      );
      await queueOp(
        db,
        id: 'OP1',
        entityType: 'prospect',
        entityId: 'p-1',
        payload: <String, Object?>{'nom': 'Diop'},
      );
      await engine.writeCursor('curseur-de-awa');

      // Exactement ce que fait `AuthController.signOut`
      // (lib/features/auth/auth_controller.dart:118) côté base locale.
      await Phase2DirectorySync(database: db, api: api, clock: clock).purge();

      expect(
        await engine.readCursor(),
        isNull,
        reason:
            'le curseur keyset du compte précédent survit : le commercial '
            'suivant reprend la pagination là où le premier l\'a laissée et '
            'ne reçoit jamais ses propres fiches antérieures',
      );
      expect(
        await db.select(db.prospects).get(),
        isEmpty,
        reason: 'les fiches du compte précédent restent lisibles',
      );
      expect(
        await allOutbox(db),
        isEmpty,
        reason:
            'les saisies non parties du compte précédent repartiront sous le '
            'jeton du compte suivant',
      );
    });
  });

  // ── SYN-03 : la pierre tombale d'un représentant ne se lève jamais ──────────

  group('SYN-03 représentant restauré côté serveur', () {
    test('le pull ne rouvre pas un représentant marqué supprimé', () async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        rev: 4,
        deletedAt: t0,
      );

      api.pullPages.add(
        PullPage(
          changes: _changesVides().copyWith(
            representants: <RepresentantDto>[
              representantDto(id: 'rep-1', phoneE164: '+221770000001', rev: 9),
            ],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'c1',
          hasMore: false,
          serverTime: t0,
        ),
      );
      await engine.pullChanges();

      final Representant ligne = await (db.select(
        db.representants,
      )..where((Representants t) => t.id.equals('rep-1'))).getSingle();
      expect(ligne.rev, 9, reason: 'la révision serveur a bien été appliquée');
      expect(
        ligne.deletedAt,
        isNull,
        reason:
            'le serveur ne sert QUE les représentants vivants dans '
            '`changes.representants` : la fiche est vivante, elle doit '
            'redevenir visible',
      );
      final List<RepresentantSyncViewData> trouve = await ReferenceRepository(
        db,
      ).watchRepresentants(search: '+221770000001').first;
      expect(trouve.map((RepresentantSyncViewData r) => r.id), <String>['rep-1']);
    });

    test('le prospect, lui, est bien rouvert par le même chemin', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await insertProspect(
        db,
        id: 'p-1',
        representantId: 'rep-1',
        phone: '+221770000001',
        deletedAt: t0,
      );
      api.pullPages.add(
        PullPage(
          changes: _changesVides().copyWith(
            prospects: <ProspectDto>[
              prospectDto(id: 'p-1', phoneE164: '+221770000001', rev: 9),
            ],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'c1',
          hasMore: false,
          serverTime: t0,
        ),
      );
      await engine.pullChanges();

      final Prospect ligne = await (db.select(
        db.prospects,
      )..where((Prospects t) => t.id.equals('p-1'))).getSingle();
      expect(ligne.deletedAt, isNull);
    });
  });

  // ── SYN-04 : une suppression serveur arrivée au mauvais moment est perdue ───

  group('SYN-04 pierre tombale écartée pendant qu\'une saisie attend', () {
    test('la suppression est écartée ET le curseur avance', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await insertProspect(
        db,
        id: 'p-1',
        representantId: 'rep-1',
        phone: '+221770000001',
      );
      // Une correction locale attend son tour : réseau coupé, back-off en cours.
      await queueOp(
        db,
        id: 'OP1',
        entityType: 'prospect',
        entityId: 'p-1',
        op: 'update',
        baseRev: 1,
        payload: <String, Object?>{'nom': 'Diop'},
        nextAttemptAt: t0.add(const Duration(hours: 1)),
      );

      api.pullPages.add(
        PullPage(
          changes: _changesVides(),
          deletions: <SyncDeletionDto>[
            SyncDeletionDto(
              entity: SyncEntity.prospect,
              id: 'p-1',
              deletedAt: t0,
            ),
          ],
          nextCursor: 'curseur-apres-suppression',
          hasMore: false,
          serverTime: t0,
        ),
      );
      await engine.pullChanges();

      expect(
        await engine.readCursor(),
        'curseur-apres-suppression',
        reason: 'le curseur a dépassé la pierre tombale',
      );
      final Prospect fiche = await (db.select(
        db.prospects,
      )..where((Prospects t) => t.id.equals('p-1'))).getSingle();
      expect(
        fiche.deletedAt,
        isNotNull,
        reason:
            'le curseur ayant avancé, cette pierre tombale ne redescendra '
            'jamais : ne pas l\'appliquer la perd pour de bon',
      );
    });
  });

  // ── SYN-05 : un représentant supprimé brûle toute la file d'appels ──────────

  group('SYN-05 tentative d\'appel sur un représentant supprimé', () {
    test('un 404 sur la première condamne les suivantes', () async {
      for (final String id in <String>['A', 'B', 'C']) {
        await queueOp(
          db,
          id: 'RC$id',
          entityType: repCallAttemptEntity,
          entityId: 'att$id',
          payload: <String, Object?>{
            'id': 'att$id',
            'representantId': 'rep$id',
            'outcome': 'REACHED',
            'clientCreatedAt': t0.toIso8601String(),
          },
        );
      }
      api.failNextRepCallAttempt = const ApiException(
        ServerErrorCodes.representantNotFound,
        message: 'Représentant introuvable.',
        statusCode: 404,
        kind: FailureKind.terminal,
      );

      await engine.drain();

      expect((await outboxById(db, 'RCA')).status, OutboxStatus.failed);
      for (final String id in <String>['B', 'C']) {
        expect(
          (await outboxById(db, 'RC$id')).status,
          OutboxStatus.pending,
          reason:
              'ces deux tentatives visent d\'AUTRES représentants : le refus '
              'de la première ne les concerne pas',
        );
      }
    });
  });

  // ── SYN-06 : la fusion de doublon efface le fil de commentaires ─────────────

  group('SYN-06 remappage d\'identifiant après fusion', () {
    test('les commentaires de la fiche locale survivent à la fusion', () async {
      await insertRepresentant(db, id: 'rep-local', phone: '+221770000001');
      await insertRepresentant(db, id: 'rep-serveur', phone: '+221770000003');
      await insertProspect(
        db,
        id: 'p-1',
        representantId: 'rep-local',
        phone: '+221770000002',
      );
      await insertComment(
        db,
        id: 'c-1',
        representantId: 'rep-local',
        body: 'Rendez-vous pris devant l\'école, jeudi 9 h.',
      );

      await engine.remapEntityId('rep-local', 'rep-serveur');

      expect(
        await db.select(db.representantComments).get(),
        hasLength(1),
        reason:
            'le fil n\'existe QUE sur cet appareil : aucun pull ne le '
            'redescend, la cascade ON DELETE l\'efface pour de bon',
      );
      expect(
        (await db.select(db.representantComments).getSingle()).representantId,
        'rep-serveur',
      );
    });
  });

  // ── SYN-07 : un envoi qui échoue bloque tout le tirage ─────────────────────

  group('SYN-07 le tirage dépend de la réussite de l\'envoi', () {
    test('un 500 sur /sync/push empêche le pull du même passage', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'OPA',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        baseRev: 1,
        payload: <String, Object?>{'fullName': 'Awa'},
      );
      api.failNextPush = const ApiException(
        'SERVER_ERROR',
        message: 'Panne côté serveur.',
        statusCode: 500,
        kind: FailureKind.retryable,
      );
      api.pullPages.add(
        PullPage(
          changes: _changesVides().copyWith(
            banques: <BanqueDto>[
              BanqueDto(
                id: 'bq-neuve',
                name: 'Banque neuve',
                shortName: 'BN',
                isActive: true,
                sortOrder: 1,
                updatedAt: t0,
              ),
            ],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'c1',
          hasMore: false,
          serverTime: t0,
        ),
      );

      await engine.runOnce();

      expect(
        api.pullPages,
        isEmpty,
        reason:
            'un envoi en panne ne doit pas priver l\'appareil de TOUT ce que '
            'le serveur a à lui dire : `runOnce` est le seul chemin de tirage '
            'de l\'application, et l\'opération refusée ne s\'épuise jamais '
            '(exhaustible: false), donc le blocage est définitif',
      );
      expect(
        (await outboxById(db, 'OPA')).status,
        OutboxStatus.pending,
        reason: 'le 5xx n\'use pas le quota : la ligne repartira sans fin',
      );
    });
  });
}

SyncChangesDto _changesVides() => SyncChangesDto(
  departements: const <DepartementDto>[],
  iefs: const <IefDto>[],
  banques: const <BanqueDto>[],
  syndicats: const <SyndicatDto>[],
  canauxProvenance: const <CanalProvenanceDto>[],
  incomeBands: const <IncomeBandDto>[],
  visiteReferentiels: const <SyncVisiteReferentielDto>[],
  representants: const <RepresentantDto>[],
  prospects: const <ProspectDto>[],
  visites: const <SyncVisiteDto>[],
);
