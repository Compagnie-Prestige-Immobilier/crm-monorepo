import 'dart:async';
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
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Les entrelacements qui perdaient une ligne.
///
/// Ces tests ne décrivent pas des cas limites théoriques. Chacun est une
/// séquence que deux isolats produisent tout seuls sur un téléphone de terrain :
/// l'isolat WorkManager tourne pendant que l'application est ouverte, sur le
/// MÊME fichier de base, et le réseau est assez lent pour que les fenêtres
/// s'ouvrent vraiment.
///
/// Ils partagent une exigence : **deux moteurs, une base**. Un seul moteur ne
/// peut rien démontrer ici, puisque le garde `_draining` est un champ
/// d'instance.
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

  /// Le second isolat : celui du worker WorkManager.
  SyncEngine workerOn(ApiPort port, {Clock? withClock}) => SyncEngine(
    database: db,
    api: port,
    tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
    clock: withClock ?? clock,
    random: Random(2),
  );

  // ───────────────────────────────────────────────────────────────────────────
  // B1 : le jeton de possession
  // ───────────────────────────────────────────────────────────────────────────

  group('jeton de possession : un `seq` ne désigne pas un propriétaire', () {
    test('la réservation pose un jeton, et le relâchement l\'efface', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');

      final List<OutboxData> claimed = await engine.claimBatch();
      expect(claimed.single.claimToken, isNotNull);
      expect(
        (await outboxById(db, 'A1')).claimToken,
        claimed.single.claimToken,
      );

      clock.advance(engine.leaseDuration + const Duration(seconds: 1));
      expect(await engine.reclaimExpiredLeases(), 1);

      final OutboxData reclaimed = await outboxById(db, 'A1');
      expect(reclaimed.status, OutboxStatus.pending);
      expect(
        reclaimed.claimToken,
        isNull,
        reason:
            'le jeton effacé est ce qui neutralise l\'ancien porteur : ses '
            'écritures ne trouveront plus de ligne à lui',
      );
    });

    test(
      'deux réservations successives ne portent jamais le même jeton',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );

        final List<OutboxData> first = await engine.claimBatch();
        clock.advance(engine.leaseDuration + const Duration(seconds: 1));
        await engine.reclaimExpiredLeases();
        final List<OutboxData> second = await engine.claimBatch();

        expect(second.single.claimToken, isNot(first.single.claimToken));
      },
    );

    /// ═══ L'ENTRELACEMENT QUI PERDAIT LA LIGNE ═══
    ///
    /// L'isolat A part avec la ligne, son envoi traîne sur un lien 2G au-delà
    /// des deux minutes de bail. L'isolat B récupère le bail expiré, reprend la
    /// ligne et la renvoie. A revient enfin, avec le verdict de SON envoi, et
    /// l'écrivait sur une ligne qui ne lui appartenait plus : la ligne passait
    /// `done` alors que l'envoi de B était encore en vol, et son verdict à lui
    /// n'avait plus de ligne où atterrir.
    test('un isolat dont le bail a expiré n\'écrit plus le verdict', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 3,
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'A1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        payload: <String, Object?>{'fullName': 'Awa'},
      );

      // A part et reste bloqué dans l'envoi : le réseau ne répond pas encore.
      final _GatedApi slow = _GatedApi();
      final SyncEngine isolateA = workerOn(slow);
      final Future<int> pushA = isolateA.drain();
      await slow.entered.future;

      // Le bail expire pendant que A attend. B le récupère et reprend la ligne.
      clock.advance(engine.leaseDuration + const Duration(seconds: 1));
      expect(await engine.reclaimExpiredLeases(), 1);
      final List<OutboxData> takenByB = await engine.claimBatch();
      expect(takenByB, hasLength(1), reason: 'B est désormais le propriétaire');

      // A revient avec le verdict de son propre envoi.
      slow.release();
      await pushA;

      final OutboxData row = await outboxById(db, 'A1');
      expect(
        row.status,
        OutboxStatus.syncing,
        reason:
            'le verdict de A ne doit pas clore une ligne que B est en train '
            'd\'envoyer : sans le jeton, elle passait `done` et l\'envoi de B '
            'n\'avait plus de ligne où atterrir',
      );
      expect(row.claimToken, takenByB.single.claimToken);
    });

    /// Le même entrelacement, côté échec : un `_requeue` de A remettait la ligne
    /// en `pending` alors que B l'avait en vol. Elle repartait alors une
    /// troisième fois, sous une clé d'idempotence neuve.
    test(
      'un échec de lot périmé ne remet pas en file une ligne en vol',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );

        final _GatedApi slow = _GatedApi(
          failWith: const ApiException(
            'SERVER_ERROR',
            statusCode: 503,
            kind: FailureKind.retryable,
          ),
        );
        final SyncEngine isolateA = workerOn(slow);
        final Future<int> pushA = isolateA.drain();
        await slow.entered.future;

        clock.advance(engine.leaseDuration + const Duration(seconds: 1));
        await engine.reclaimExpiredLeases();
        final List<OutboxData> takenByB = await engine.claimBatch();

        slow.release();
        await pushA;

        final OutboxData row = await outboxById(db, 'A1');
        expect(row.status, OutboxStatus.syncing);
        expect(row.claimToken, takenByB.single.claimToken);
        expect(
          row.attempts,
          0,
          reason: 'le compteur de B n\'est pas celui de A',
        );
      },
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B2 : une correction est une opération NEUVE
  // ───────────────────────────────────────────────────────────────────────────

  group('correction d\'une opération bloquée', () {
    /// ═══ LE VERDICT MÉMORISÉ QUI EFFAÇAIT LA CORRECTION ═══
    ///
    /// L'idempotence du serveur a deux niveaux, et le second porte sur l'`opId`
    /// (`claimOperation`, `sync.service.ts`) : il mémorise un verdict par
    /// opération et le réémet tel quel. Corriger le payload sous le MÊME `opId`
    /// faisait donc rendre au serveur le verdict de l'ANCIEN contenu, et le
    /// client, lisant un `duplicate` sans erreur, marquait la ligne `done`. La
    /// correction quittait la file sans être jamais partie.
    test('la correction part sous un opId neuf, jamais celui du refus', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await insertProspect(
        db,
        id: 'pro1',
        representantId: 'repA',
        phone: '+221770000009',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'prospect',
        entityId: 'pro1',
        dependencyKey: 'repA',
        op: 'update',
        status: OutboxStatus.failed,
        payload: <String, Object?>{'nom': 'Diopp', 'prenom': 'Moussa'},
      );

      // Le serveur a bel et bien vu `U1` et en a mémorisé le verdict : c'est
      // exactement le cas où la réponse s'est perdue au retour.
      api.ledger['U1'] = SyncOperationResultDto(
        opId: 'U1',
        status: SyncOpStatus.applied,
        entityId: 'pro1',
        rev: 4,
        serverUpdatedAt: t0,
        errorCode: null,
        error: null,
      );

      // L'utilisateur corrige la faute de frappe.
      final WriteRepository writes = WriteRepository(db, clock: clock);
      await writes.updateProspect(
        id: 'pro1',
        nom: 'Diop',
        prenom: 'Moussa',
        phoneE164: '+221770000009',
        banqueId: 'bq-1',
        syndicatId: 'sy-1',
        representantId: 'repA',
      );

      final List<OutboxData> queue = await allOutbox(db);
      expect(
        queue,
        hasLength(1),
        reason: 'la correction reste une amende sur place',
      );
      expect(
        queue.single.id,
        isNot('U1'),
        reason:
            'contenu neuf, opération neuve : sinon le serveur rejoue le '
            'verdict de l\'ancien contenu',
      );

      await engine.drain();

      expect(
        api.rows['pro1']!.data!.nom,
        'Diop',
        reason:
            'le serveur doit avoir reçu ET appliqué la correction ; sous '
            'l\'ancien opId il rendait son verdict mémorisé et P2 disparaissait',
      );
      expect((await allOutbox(db)).single.status, OutboxStatus.done);
    });

    test('un verdict rejoué de l\'ancien opId ne clôt plus la ligne', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 2,
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        status: OutboxStatus.conflict,
        payload: <String, Object?>{'fullName': 'Awa'},
      );
      // Le serveur ne connaît QUE `U1` : tout autre opId est une opération neuve
      // qu'il applique pour de bon.
      api.ledger['U1'] = SyncOperationResultDto(
        opId: 'U1',
        status: SyncOpStatus.applied,
        entityId: 'repA',
        rev: 3,
        serverUpdatedAt: t0,
        errorCode: null,
        error: null,
      );

      final WriteRepository writes = WriteRepository(db, clock: clock);
      await writes.updateRepresentant(
        id: 'repA',
        fullName: 'Awa Ndiaye',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
      );
      await engine.drain();

      expect(api.rows['repA']!.data!.fullName, 'Awa Ndiaye');
      expect(
        api.receivedOpIds,
        isNot(contains('U1')),
        reason: 'l\'ancien opId n\'a plus rien à envoyer : il a déjà été jugé',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B3 : la garde de révision n'est jamais retirée, elle est décalée
  // ───────────────────────────────────────────────────────────────────────────

  group('chaîne d\'écritures sur une même entité', () {
    /// ═══ LE SERVEUR POURSUIT SON GROUPE APRÈS UN REFUS PAR RÉVISION ═══
    ///
    /// `runGroup` (`sync.service.ts`) empile le `conflict` dans ses résultats et
    /// passe à l'opération suivante ; seul un représentant réellement absent
    /// stoppe ses prospects. Une chaîne dont la suite partait SANS `baseRev`
    /// écrasait donc, en écriture inconditionnelle, la modification d'un autre
    /// appareil : celle-là même que le refus de la tête venait de signaler.
    test('la seconde écriture d\'une fiche attend le tour suivant', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 10,
        serverUpdatedAt: t0,
      );
      // Un prospect du même représentant : entité DISTINCTE, il doit continuer
      // de voyager avec le premier lot. La coupure ne vaut que pour une même
      // fiche modifiée deux fois.
      await insertProspect(
        db,
        id: 'pro1',
        representantId: 'repA',
        phone: '+221770000009',
      );
      for (final String id in <String>['U1', 'U2']) {
        await queueOp(
          db,
          id: id,
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          baseRev: 10,
          payload: <String, Object?>{'fullName': 'Version $id'},
        );
      }
      await queueOp(
        db,
        id: 'P1',
        entityType: 'prospect',
        entityId: 'pro1',
        dependencyKey: 'repA',
        payload: <String, Object?>{'nom': 'Diop', 'representantId': 'repA'},
      );

      await engine.drain();

      expect(api.calls, hasLength(2));
      expect(
        api.calls[0].opIds,
        <String>['U1'],
        reason:
            'la chaîne est coupée à la seconde écriture de repA : tout ce qui '
            'suit dans la même clé attend, l\'ordre est la garantie',
      );
      expect(api.calls[1].opIds, <String>['U2', 'P1']);
    });

    test('un refus sur la tête n\'ouvre pas la porte à la suite', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 10,
        serverUpdatedAt: t0,
      );
      for (final String id in <String>['U1', 'U2']) {
        await queueOp(
          db,
          id: id,
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          baseRev: 10,
          payload: <String, Object?>{'fullName': 'Version $id'},
        );
      }

      // Un AUTRE appareil a fait passer la fiche en révision 11 entre-temps.
      final _RevAwareApi server = _RevAwareApi(
        rev: <String, int>{'repA': 11},
        content: <String, String>{'repA': 'Version de l\'autre appareil'},
      );
      final SyncEngine other = workerOn(server);
      await other.drain();

      expect(
        server.content['repA'],
        'Version de l\'autre appareil',
        reason:
            'U1 est refusé par révision ; U2, privé de garde, écrasait la '
            'version 11 en écriture inconditionnelle',
      );
      expect(
        server.rev['repA'],
        11,
        reason: 'aucune des deux n\'a été appliquée',
      );
      expect(
        (await outboxById(db, 'U1')).status,
        OutboxStatus.conflict,
        reason: 'l\'utilisateur doit arbitrer',
      );
      expect(
        (await outboxById(db, 'U2')).status,
        OutboxStatus.pending,
        reason:
            'la tête est empoisonnée, donc U2 n\'est même pas sélectionnée : '
            'la chaîne s\'interrompt d\'elle-même',
      );
      expect(server.calls, hasLength(1));
    });

    test('sans intervention extérieure, la chaîne entière passe', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        rev: 10,
        serverUpdatedAt: t0,
      );
      for (final String id in <String>['U1', 'U2']) {
        await queueOp(
          db,
          id: id,
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          baseRev: 10,
          payload: <String, Object?>{'fullName': 'Version $id'},
        );
      }

      final _RevAwareApi server = _RevAwareApi(rev: <String, int>{'repA': 10});
      final SyncEngine other = workerOn(server);
      await other.drain();

      expect(
        server.content['repA'],
        'Version U2',
        reason:
            'la seconde part au tour suivant, recalée sur la révision 11 que le '
            'serveur vient réellement d\'attribuer',
      );
      expect(server.rev['repA'], 12);
      for (final OutboxData row in await allOutbox(db)) {
        expect(row.status, OutboxStatus.done);
      }
    });

    test('une chaîne en écriture aveugle le reste sur toute sa longueur', () async {
      // Une fiche jamais vue du serveur : `baseRev` nul veut dire « écriture
      // aveugle assumée ». Prédire une révision qui n'existe pas encore ferait
      // échouer une création parfaitement valide.
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'C1', entityType: 'representant', entityId: 'repA');
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        payload: <String, Object?>{'fullName': 'Awa'},
      );

      await engine.drain();

      expect(api.calls, hasLength(2));
      expect(api.calls[0].operations.single.baseRev, isNull);
      expect(
        api.calls[1].operations.single.baseRev,
        isNull,
        reason:
            '[_rebaseFollowers] ne renseigne QUE ce qui l\'était déjà : donner '
            'une garde après coup à une écriture aveugle assumée en ferait une '
            'écriture conditionnelle qui peut échouer',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B4 : la version serveur ne doit pas disparaître du flux
  // ───────────────────────────────────────────────────────────────────────────

  group('pull face à une ligne en conflit', () {
    /// ═══ LA DIVERGENCE DEVENAIT DÉFINITIVE ═══
    ///
    /// La garde couvrait aussi `conflict` et `failed`, deux états où plus aucun
    /// push ne tranchera. Le curseur, lui, avançait. La version serveur passait
    /// donc dans le flux, était ignorée, et disparaissait pour toujours : il ne
    /// restait plus rien contre quoi arbitrer le conflit qu'on demandait
    /// pourtant à l'utilisateur de trancher.
    test('la version serveur d\'une ligne en conflit est appliquée', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        fullName: 'Ma version',
        rev: 1,
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        status: OutboxStatus.conflict,
        payload: <String, Object?>{'fullName': 'Ma version'},
      );
      api.pullPages.add(
        pullPageWithRepresentant(
          representantDto(
            id: 'repA',
            phoneE164: '+221770000001',
            fullName: 'Version serveur',
            rev: 7,
          ),
        ),
      );

      await engine.pullChanges();

      final Representant row = (await db.select(db.representants).get()).single;
      expect(
        row.fullName,
        'Version serveur',
        reason:
            'le curseur est passé outre : si on ignore cette version, elle est '
            'perdue et le conflit n\'a plus de second terme',
      );
      // Et la version de l'utilisateur n'est pas perdue pour autant : elle vit
      // dans le payload, que l'écran « À corriger » décode et affiche.
      final Map<String, Object?> payload =
          jsonDecode((await outboxById(db, 'U1')).payload)
              as Map<String, Object?>;
      expect(payload['fullName'], 'Ma version');
    });

    /// ═══ LA GARDE ÉTAIT LUE HORS DE LA TRANSACTION QU'ELLE PROTÈGE ═══
    ///
    /// Le test précédent décrit un régime STABLE : l'opération était déjà en
    /// file quand la page est arrivée. Celui-ci décrit la fenêtre, et c'est la
    /// seule chose que les deux autres ne pouvaient pas voir.
    ///
    /// `_applyPage` calculait ses deux ensembles gardés, PUIS ouvrait sa
    /// transaction d'écriture. Rien ne suspend l'interface entre les deux : la
    /// page vient d'arriver par un lien 2G, le commercial a le formulaire sous
    /// les yeux, et « Enregistrer » écrit la fiche et met l'opération en file
    /// pendant ce temps-là. Cette opération-là n'était dans aucun des deux
    /// ensembles, donc la version serveur l'écrasait dans `representants` :
    /// c'est-à-dire le symptôme exact que la garde existe pour empêcher, une
    /// correction qui disparaît de l'écran et que son auteur ressaisit.
    ///
    /// L'entrelacement est réel : le crochet écrit VRAIMENT dans la base, par
    /// `WriteRepository`, et il est commité avant que la transaction de la page
    /// ne s'ouvre.
    test(
      'une correction enregistrée pendant le tirage n\'est pas écrasée',
      () async {
        final _HookedDatabase hooked = _HookedDatabase(NativeDatabase.memory());
        addTearDown(hooked.close);
        await seedReferentials(hooked);
        await insertRepresentant(
          hooked,
          id: 'repA',
          phone: '+221770000001',
          fullName: 'Avant',
          rev: 1,
          serverUpdatedAt: t0,
        );

        final FakeApi slowApi = FakeApi();
        final SyncEngine pulling = SyncEngine(
          database: hooked,
          api: slowApi,
          tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
          clock: clock,
          random: Random(3),
        );
        final WriteRepository writes = WriteRepository(hooked, clock: clock);

        slowApi.pullPages.add(
          pullPageWithRepresentant(
            representantDto(
              id: 'repA',
              phoneE164: '+221770000001',
              fullName: 'Version serveur',
              rev: 7,
            ),
          ),
        );

        // Le geste de l'utilisateur, placé exactement dans la fenêtre : juste
        // avant que la page n'ouvre sa transaction.
        hooked.onNextTransaction = () async {
          await writes.updateRepresentant(
            id: 'repA',
            fullName: 'Ma correction',
            phoneE164: '+221770000001',
            departementId: 'dep-1',
          );
        };

        await pulling.pullChanges();

        final Representant row =
            (await hooked.select(hooked.representants).get()).single;
        expect(
          row.fullName,
          'Ma correction',
          reason:
              'l\'opération était en file au moment d\'écrire : tant qu\'un envoi '
              'peut trancher, le pull ne tranche pas à sa place',
        );
        expect(
          (await allOutbox(hooked)).single.status,
          OutboxStatus.pending,
          reason:
              'la correction est bien partie en file, elle n\'a pas été avalée',
        );
      },
    );

    test('une ligne encore en file, elle, reste protégée', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        fullName: 'Ma version',
        rev: 1,
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'representant',
        entityId: 'repA',
        op: 'update',
        payload: <String, Object?>{'fullName': 'Ma version'},
      );
      api.pullPages.add(
        pullPageWithRepresentant(
          representantDto(
            id: 'repA',
            phoneE164: '+221770000001',
            fullName: 'Version serveur',
            rev: 7,
          ),
        ),
      );

      await engine.pullChanges();

      final Representant row = (await db.select(db.representants).get()).single;
      expect(
        row.fullName,
        'Ma version',
        reason: 'tant qu\'un envoi peut trancher, on le laisse trancher',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B4bis : l'invariant dont deux gardes dépendent sans jamais le vérifier
  // ───────────────────────────────────────────────────────────────────────────

  /// ═══ « À CORRIGER » N'APPARTIENT À PERSONNE ═══
  ///
  /// Deux mécanismes fenêtrent sur le STATUT seul, sans jamais regarder le
  /// jeton de possession, et ils ne sont sûrs que si cet invariant tient :
  ///
  /// * `WriteRepository.retryOperation` ne filtre que sur
  ///   [OutboxStatus.needsAttention], puis efface bail et jeton. Si une ligne
  ///   `conflict` ou `failed` pouvait porter un jeton, « Réessayer » volerait
  ///   une ligne en vol et le lot repartirait sous une clé d'idempotence neuve
  ///   pendant que le premier envoi est encore en cours ;
  /// * `Phase2DirectorySync.purge`, à la déconnexion, SUPPRIME des lignes
  ///   d'outbox en ne filtrant que sur « hors [OutboxStatus.open] ». C'est la
  ///   seule suppression de la file qui ne repose pas la possession dans son
  ///   `WHERE` : elle n'est fenêtrée que parce qu'une ligne `done` a, elle
  ///   aussi, rendu son jeton.
  ///
  /// L'invariant se vérifie donc ici, sur TOUS les chemins qui produisent l'un
  /// de ces états, plutôt que de se relire dans les commentaires de ceux qui en
  /// dépendent.
  group('invariant : une ligne qui attend une décision humaine n\'a plus de jeton', () {
    test('aucun chemin de verdict ne laisse un jeton derrière lui', () async {
      // Un plafond de blocage à 1 : le premier rejeu bloqué suffit alors à
      // pousser la ligne en `failed`, sans douze tours de vidange.
      final SyncEngine strict = SyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        clock: clock,
        maxBlockedAttempts: 1,
        random: Random(4),
      );

      for (final String key in <String>['k1', 'k2', 'k4']) {
        await insertRepresentant(
          db,
          id: 'rep-$key',
          phone: '+22177000000${key[1]}',
        );
      }
      await queueOp(
        db,
        id: 'C1',
        entityType: 'representant',
        entityId: 'rep-k1',
        dependencyKey: 'k1',
      );
      await queueOp(
        db,
        id: 'C2',
        entityType: 'representant',
        entityId: 'rep-k2',
        dependencyKey: 'k2',
      );
      // Type d'entité que ce build ne sait pas traduire : la ligne meurt dans
      // `_prepare`, avant tout réseau. C'est le seul chemin vers `failed` qui ne
      // passe pas par un verdict.
      await queueOp(
        db,
        id: 'C3',
        entityType: 'chose_inconnue',
        entityId: 'x-k3',
        dependencyKey: 'k3',
      );
      await queueOp(
        db,
        id: 'C4',
        entityType: 'representant',
        entityId: 'rep-k4',
        dependencyKey: 'k4',
      );

      api.verdicts['C1'] = conflictOn(
        'C1',
        errorCode: ServerErrorCodes.revConflict,
      );
      api.verdicts['C2'] = invalidOn('C2');
      api.verdicts['C4'] = SyncOperationResultDto(
        opId: 'C4',
        status: SyncOpStatus.skippedDependencyFailed,
        entityId: null,
        rev: null,
        serverUpdatedAt: null,
        errorCode: ServerErrorCodes.parentRepresentantFailed,
        error: 'Le parent n\'est pas passé.',
      );

      await strict.drain();

      final List<OutboxData> stuck = (await allOutbox(db))
          .where(
            (OutboxData o) => OutboxStatus.needsAttention.contains(o.status),
          )
          .toList(growable: false);
      expect(
        stuck.map((OutboxData o) => o.id).toSet(),
        <String>{'C1', 'C2', 'C3', 'C4'},
        reason:
            'les quatre chemins doivent avoir abouti, sinon le test ne prouve rien',
      );
      for (final OutboxData row in stuck) {
        expect(
          row.claimToken,
          isNull,
          reason:
              '${row.id} (${row.status}) porte encore un jeton : « Réessayer » '
              'volerait une ligne que quelqu\'un croit posséder',
        );
        expect(row.leaseUntil, isNull, reason: '${row.id} garde un bail');
      }
    });

    test(
      'un acquittement rend le jeton, et c\'est ce qui borne la purge',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );

        await engine.drain();

        final OutboxData done = await outboxById(db, 'A1');
        expect(done.status, OutboxStatus.done);
        expect(
          done.claimToken,
          isNull,
          reason:
              'la purge de déconnexion supprime les lignes hors `open` sans reposer '
              'la possession : elle n\'est fenêtrée que par cette remise à null',
        );
        expect(done.leaseUntil, isNull);
      },
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B5 : une suppression serveur ne survit pas à une écriture acquittée
  // ───────────────────────────────────────────────────────────────────────────

  group('suppression serveur et écriture locale', () {
    Future<void> seedProspectWithPendingWrite() async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await insertProspect(
        db,
        id: 'pro1',
        representantId: 'repA',
        phone: '+221770000009',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'prospect',
        entityId: 'pro1',
        dependencyKey: 'repA',
        op: 'update',
        payload: <String, Object?>{'nom': 'Diop'},
      );
    }

    PullPage deletionOf(String id) => PullPage(
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
        repCallCampaigns: const <SyncRepCallCampaignDto>[],
        repCallTasks: const <SyncRepCallTaskDto>[],
        visites: const <SyncVisiteDto>[],
      ),
      deletions: <SyncDeletionDto>[
        SyncDeletionDto(entity: SyncEntity.prospect, id: id, deletedAt: t0),
      ],
      nextCursor: 'c1',
      hasMore: false,
      serverTime: t0,
    );

    test('la garde vaut aussi pour les suppressions', () async {
      await seedProspectWithPendingWrite();
      api.pullPages.add(deletionOf('pro1'));

      await engine.pullChanges();

      final Prospect row = (await db.select(db.prospects).get()).single;
      expect(
        row.deletedAt,
        isNull,
        reason:
            'la suppression est l\'écrasement le plus radical qui soit ; elle '
            'ignorait pourtant la garde que les upserts respectaient',
      );
    });

    /// La suppression a pu être posée avant que l'écriture ne soit acquittée :
    /// par un pull antérieur, ou par la version de l'application qui ne gardait
    /// pas encore les suppressions. Le serveur vient de dire que la fiche existe
    /// et porte telle révision : la marque doit tomber.
    test('un acquittement efface la marque de suppression', () async {
      await seedProspectWithPendingWrite();
      await (db.update(db.prospects)
            ..where((Prospects t) => t.id.equals('pro1')))
          .write(ProspectsCompanion(deletedAt: Value<DateTime?>(t0)));

      await engine.drain();

      final Prospect row = (await db.select(db.prospects).get()).single;
      expect(
        row.deletedAt,
        isNull,
        reason:
            'l\'écriture est passée côté serveur : la fiche disparaissait du '
            'téléphone alors qu\'elle existait des deux côtés',
      );
      expect(row.rev, 1);
    });

    test('un `delete` acquitté garde évidemment sa marque', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await insertProspect(
        db,
        id: 'pro1',
        representantId: 'repA',
        phone: '+221770000009',
        serverUpdatedAt: t0,
      );
      final WriteRepository writes = WriteRepository(db, clock: clock);
      await writes.deleteProspect('pro1');

      await engine.drain();

      final Prospect row = (await db.select(db.prospects).get()).single;
      expect(
        row.deletedAt,
        t0,
        reason: 'c\'est le résultat attendu de l\'opération',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B6 : ne jamais mettre sur le fil une valeur qu'on n'a pas comprise
  // ───────────────────────────────────────────────────────────────────────────

  group('énumération inconnue de ce build', () {
    /// ═══ L'ALLER-RETOUR QUI CORROMPAIT UNE SAISIE VALIDE ═══
    ///
    /// Le serveur ajoute un `ProspectStatut`, un pull le ramène, `.value` écrit
    /// `unknown_default_open_api` en base, l'utilisateur modifie la fiche, et le
    /// payload repart avec cette chaîne. Le serveur la refuse en 400 : classé
    /// terminal, donc TOUT le lot en `failed`, jusqu'à deux cents saisies.
    test('un statut inconnu ne part pas : la ligne échoue seule', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await insertProspect(
        db,
        id: 'pro1',
        representantId: 'repA',
        phone: '+221770000009',
        serverUpdatedAt: t0,
      );
      await insertProspect(
        db,
        id: 'pro2',
        representantId: 'repA',
        phone: '+221770000010',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'prospect',
        entityId: 'pro1',
        dependencyKey: 'repA',
        op: 'update',
        payload: <String, Object?>{
          'nom': 'Diop',
          'statut': 'unknown_default_open_api',
        },
      );
      await queueOp(
        db,
        id: 'U2',
        entityType: 'prospect',
        entityId: 'pro2',
        dependencyKey: 'repA',
        op: 'update',
        payload: <String, Object?>{'nom': 'Sy'},
      );

      await engine.drain();

      final OutboxData bad = await outboxById(db, 'U1');
      expect(bad.status, OutboxStatus.failed);
      expect(bad.lastErrorCode, ClientErrorCodes.payloadSchemaMismatch);
      expect(
        api.receivedOpIds,
        isNot(contains('U1')),
        reason:
            'sur le fil, la valeur devenait `unknown_default_open_api`, que le '
            'serveur refuse en 400 : classé terminal, tout le lot y passait',
      );
      expect(
        (await outboxById(db, 'U2')).status,
        OutboxStatus.done,
        reason: 'une ligne empoisonnée ne doit condamner qu\'elle-même',
      );
    });

    test('un statut que ce build connaît passe sans encombre', () async {
      await insertRepresentant(
        db,
        id: 'repA',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      await insertProspect(
        db,
        id: 'pro1',
        representantId: 'repA',
        phone: '+221770000009',
        serverUpdatedAt: t0,
      );
      await queueOp(
        db,
        id: 'U1',
        entityType: 'prospect',
        entityId: 'pro1',
        dependencyKey: 'repA',
        op: 'update',
        payload: <String, Object?>{'nom': 'Diop', 'statut': 'CONVERTI'},
      );

      await engine.drain();

      expect((await outboxById(db, 'U1')).status, OutboxStatus.done);
      expect(
        api.calls.single.operations.single.data!.statut,
        ProspectStatut.CONVERTI,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B7 : le curseur ne recule pas, même entre deux isolats
  // ───────────────────────────────────────────────────────────────────────────

  group('curseur monotone', () {
    test(
      'une position périmée n\'écrase pas une position plus avancée',
      () async {
        expect(await engine.advanceCursor(from: null, to: 'c1'), isTrue);
        expect(await engine.advanceCursor(from: 'c1', to: 'c2'), isTrue);

        // Le retardataire tient encore la position de départ.
        expect(
          await engine.advanceCursor(from: null, to: 'c1'),
          isFalse,
          reason: 'il n\'a pas la position qu\'il prétend remplacer',
        );
        expect(await engine.readCursor(), 'c2');
      },
    );

    test(
      'le curseur reste opaque : on ne compare jamais son contenu',
      () async {
        // Deux positions dont l'ordre lexicographique est INVERSE de l'ordre
        // réel. Un client qui « comparerait » les curseurs se tromperait ici ;
        // la règle est la position qu'on remplace, pas la valeur qu'on écrit.
        expect(await engine.advanceCursor(from: null, to: 'zzz'), isTrue);
        expect(await engine.advanceCursor(from: 'zzz', to: 'aaa'), isTrue);
        expect(await engine.readCursor(), 'aaa');
      },
    );

    /// ═══ DEUX ISOLATS, UNE BASE, UN FORFAIT PRÉPAYÉ ═══
    ///
    /// `isPulling` est un champ d'instance : il ne voit pas le worker. Les deux
    /// lisent la même position de départ, le premier plan enchaîne deux pages,
    /// le worker finit la sienne en dernier et écrit une position PLUS ANCIENNE.
    /// Aucune ligne n'est perdue, le LWW par `rev` y veille, mais toutes les
    /// pages intermédiaires sont retéléchargées.
    test('le worker en retard ne fait pas reculer le curseur', () async {
      final _GatedPullApi slowPull = _GatedPullApi();
      final SyncEngine worker = workerOn(slowPull);

      // Le worker part, lit le curseur nul, et sa requête reste en vol.
      final Future<int> workerPull = worker.pullChanges();
      await slowPull.entered.future;

      // Le premier plan enchaîne deux pages pendant ce temps.
      api.pullPages.addAll(<PullPage>[
        _page(cursor: 'c1', hasMore: true),
        _page(cursor: 'c2'),
      ]);
      await engine.pullChanges();
      expect(await engine.readCursor(), 'c2');

      // Le worker revient enfin, avec la première page.
      slowPull.release(_page(cursor: 'c1'));
      await workerPull;

      expect(
        await engine.readCursor(),
        'c2',
        reason:
            'écrite, la position `c1` ferait retélécharger toutes les pages '
            'comprises entre les deux, sur un forfait payé à la donnée',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // B4 : les actions manuelles face à une réservation vivante
  // ───────────────────────────────────────────────────────────────────────────

  /// Le jeton de possession fenêtrait toutes les écritures DU MOTEUR. Restaient
  /// dehors les deux écritures que l'UTILISATEUR déclenche : l'abandon et
  /// l'amendement. Ce sont pourtant les deux seules qui peuvent détruire ou
  /// réécrire une ligne qu'un envoi porte déjà.
  group('actions manuelles : le bail n\'est pas une preuve d\'absence', () {
    late WriteRepository repo;

    setUp(() => repo = WriteRepository(db, clock: clock));

    /// ═══ L'ABANDON QUI EFFAÇAIT UNE LIGNE EN VOL ═══
    ///
    /// L'ancienne garde disait « `syncing` ET bail encore valide ». Elle
    /// laissait donc passer exactement la ligne la plus dangereuse : celle dont
    /// l'envoi dure plus longtemps que ses deux minutes de bail, ce qui est
    /// l'ordinaire d'un lien 2G, pas un cas limite. L'utilisateur ouvre
    /// « À corriger », appuie sur Supprimer, et la ligne d'outbox comme la
    /// fiche métier disparaissent pendant que le serveur applique la requête.
    /// Il reste alors côté serveur un enregistrement que rien, sur ce
    /// téléphone, ne sait plus rattacher.
    test(
      'un abandon ne supprime pas une ligne dont l\'envoi est en vol',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
        );

        final _GatedApi slow = _GatedApi();
        final SyncEngine isolateA = workerOn(slow);
        final Future<int> pushA = isolateA.drain();
        await slow.entered.future;

        // L'envoi dépasse son bail, et il est TOUJOURS en vol.
        clock.advance(engine.leaseDuration + const Duration(seconds: 1));

        final OutboxData row = await outboxById(db, 'A1');
        final DiscardResult result = await repo.discardOperation(row.seq);

        expect(result.outcome, DiscardOutcome.claimed);
        expect(result.removed, 0);
        expect(
          await allOutbox(db),
          hasLength(1),
          reason:
              'la ligne d\'outbox est le seul lien qui reste vers l\'envoi en vol',
        );
        expect(await db.select(db.representants).get(), hasLength(1));

        // L'envoi aboutit : le serveur a la fiche, et le téléphone aussi.
        slow.release();
        await pushA;

        expect(slow.rows.keys, contains('repA'));
        expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
      },
    );

    /// La cascade emporte les prospects du représentant. Ne contrôler que la
    /// ligne visée revenait donc à ne contrôler qu'une des lignes qu'on
    /// supprime : les deux partent dans le MÊME lot, donc les deux sont en vol
    /// en même temps.
    test('l\'abandon en cascade ne vide pas un lot en cours d\'envoi', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(
        db,
        id: 'pA1',
        representantId: 'repA',
        phone: '+221770000002',
      );
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      await queueOp(
        db,
        id: 'A2',
        entityType: 'prospect',
        entityId: 'pA1',
        dependencyKey: 'repA',
      );

      final _GatedApi slow = _GatedApi();
      final SyncEngine isolateA = workerOn(slow);
      final Future<int> pushA = isolateA.drain();
      await slow.entered.future;
      // Les deux lignes sont réservées par le même lot : c'est ce qui rend la
      // cascade dangereuse.
      expect(
        (await allOutbox(db)).map((OutboxData o) => o.status).toSet(),
        <String>{OutboxStatus.syncing},
      );

      clock.advance(engine.leaseDuration + const Duration(seconds: 1));

      final OutboxData head = await outboxById(db, 'A1');
      expect(
        (await repo.discardOperation(head.seq)).outcome,
        DiscardOutcome.claimed,
      );

      expect(await allOutbox(db), hasLength(2));
      expect(await db.select(db.representants).get(), hasLength(1));
      expect(
        await db.select(db.prospects).get(),
        hasLength(1),
        reason:
            'le prospect part dans le même lot que son parent, donc il est en vol aussi',
      );

      slow.release();
      await pushA;
      expect(slow.rows.keys, containsAll(<String>['repA', 'pA1']));
    });

    /// ═══ « RATTACHER MES PROSPECTS » N'EFFACE PAS UNE CRÉATION EN VOL ═══
    ///
    /// La feuille d'arbitrage supprime la création du représentant par son
    /// `id` d'opération, sans cascade : ses prospects viennent d'être repointés
    /// et doivent partir. La suppression ne posait AUCUNE condition : ni le
    /// type d'opération, ni la possession, ni le nombre de lignes touchées.
    /// Tenir cet `id` suffisait donc à effacer une création que le serveur est
    /// en train d'appliquer, et il restait côté serveur un représentant que ce
    /// téléphone ne savait plus rattacher, sans plus aucune trace locale de
    /// l'envoi.
    test('« rattacher » refuse d\'effacer une création en cours d\'envoi', () async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(
        db,
        id: 'pA1',
        representantId: 'repA',
        phone: '+221780000002',
      );
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');
      await queueOp(
        db,
        id: 'A2',
        entityType: 'prospect',
        entityId: 'pA1',
        dependencyKey: 'repA',
      );

      final _GatedApi slow = _GatedApi();
      final SyncEngine isolateA = workerOn(slow);
      final Future<int> pushA = isolateA.drain();
      await slow.entered.future;

      // L'envoi dépasse son bail, et il est TOUJOURS en vol : c'est l'ordinaire
      // d'un lien 2G, pas un cas limite.
      clock.advance(engine.leaseDuration + const Duration(seconds: 1));

      final DiscardResult result = await repo.discardOwnCreateOnly('A1');

      expect(result.outcome, DiscardOutcome.claimed);
      expect(result.removed, 0);
      expect(
        await allOutbox(db),
        hasLength(2),
        reason:
            'la ligne d\'outbox est le seul lien qui reste vers l\'envoi en vol',
      );

      // L'envoi aboutit : le serveur a la fiche, et le téléphone la reconnaît.
      slow.release();
      await pushA;

      expect(slow.rows.keys, contains('repA'));
      expect((await outboxById(db, 'A1')).status, OutboxStatus.done);
    });

    /// Le pendant positif : hors réservation, l'abandon sans cascade fait
    /// toujours son travail, et il le dit.
    test(
      '« rattacher » abandonne la création libre et laisse les prospects',
      () async {
        await insertRepresentant(db, id: 'repA', phone: '+221770000001');
        await insertProspect(
          db,
          id: 'pA1',
          representantId: 'repA',
          phone: '+221780000002',
        );
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

        final DiscardResult result = await repo.discardOwnCreateOnly('A1');

        expect(result.outcome, DiscardOutcome.discarded);
        expect(result.removed, 1);
        expect((await allOutbox(db)).map((OutboxData o) => o.id), <String>[
          'A2',
        ]);
        expect(await db.select(db.prospects).get(), hasLength(1));
      },
    );

    /// ═══ L'AMENDEMENT NE VOLE PAS LA RÉSERVATION D'UN AUTRE ═══
    ///
    /// **Ce test n'est pas un entrelacement, et c'est délibéré.** L'état qu'il
    /// construit, une ligne `failed` portant encore un jeton, aucun chemin du
    /// moteur ne le produit aujourd'hui : toutes les transitions vers `failed`
    /// et `conflict` effacent le jeton, si bien que l'amendement ne pouvait pas
    /// entrer en collision. La sûreté de l'amendement reposait donc entièrement
    /// sur un invariant tenu AILLEURS, que rien n'obligeait à durer.
    ///
    /// Ce qui est testé ici est donc le contrat local, celui qui rend
    /// l'invariant distant inutile : présentée une ligne réservée, la
    /// correction ne l'écrase pas et ne remet pas son jeton à NULL. Elle
    /// s'empile, et surtout elle n'est pas perdue : c'est le défaut qui a
    /// ouvert ce fil.
    test(
      'une correction n\'écrase pas une ligne réservée, elle s\'empile',
      () async {
        await insertRepresentant(
          db,
          id: 'repA',
          phone: '+221770000001',
          rev: 3,
          serverUpdatedAt: t0,
        );
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          status: OutboxStatus.failed,
          payload: <String, Object?>{'fullName': 'Awa'},
          claimToken: 'jeton-d-un-envoi-en-vol',
        );

        await repo.updateRepresentant(
          id: 'repA',
          fullName: 'Awa Ndiaye',
          phoneE164: '+221770000001',
          departementId: 'dep-1',
        );

        final OutboxData untouched = await outboxById(db, 'A1');
        expect(
          untouched.claimToken,
          'jeton-d-un-envoi-en-vol',
          reason:
              'effacer le jeton d\'un autre, c\'est lui retirer sa ligne sous les pieds',
        );
        expect(untouched.status, OutboxStatus.failed);
        expect(jsonDecode(untouched.payload), <String, Object?>{
          'fullName': 'Awa',
        });

        // La correction existe, en clair, dans une opération à elle.
        final List<OutboxData> all = await allOutbox(db);
        expect(all, hasLength(2));
        final OutboxData appended = all.last;
        expect(appended.status, OutboxStatus.pending);
        expect(appended.id, isNot('A1'));
        expect(
          (jsonDecode(appended.payload) as Map<String, Object?>)['fullName'],
          'Awa Ndiaye',
        );
      },
    );

    /// Le pendant réel du test précédent : la tête est en vol pour de bon, donc
    /// `syncing`, et l'utilisateur enregistre une correction pendant ce
    /// temps-là. Elle doit exister ensuite comme opération à part entière, sans
    /// avoir touché à la ligne en vol ni à son jeton.
    test(
      'corriger pendant un envoi laisse partir les deux, chacun une fois',
      () async {
        await insertRepresentant(
          db,
          id: 'repA',
          phone: '+221770000001',
          rev: 3,
          serverUpdatedAt: t0,
        );
        await queueOp(
          db,
          id: 'A1',
          entityType: 'representant',
          entityId: 'repA',
          op: 'update',
          payload: <String, Object?>{'fullName': 'Awa'},
        );

        final _GatedApi slow = _GatedApi();
        final SyncEngine isolateA = workerOn(slow);
        final Future<int> pushA = isolateA.drain();
        await slow.entered.future;

        final String? tokenInFlight = (await outboxById(db, 'A1')).claimToken;
        expect(tokenInFlight, isNotNull);

        await repo.updateRepresentant(
          id: 'repA',
          fullName: 'Awa Ndiaye',
          phoneE164: '+221770000001',
          departementId: 'dep-1',
        );

        expect((await outboxById(db, 'A1')).claimToken, tokenInFlight);
        expect(await allOutbox(db), hasLength(2));

        slow.release();
        await pushA;

        // La correction part au tour suivant, sous son propre identifiant.
        await engine.drain();
        final List<String> sent = api.receivedOpIds + slow.receivedOpIds;
        expect(sent.toSet(), hasLength(2));
        expect(
          sent,
          hasLength(2),
          reason: 'aucune opération ne part deux fois',
        );
      },
    );
  });
}

/// Une page vide, avec son curseur de suite et son drapeau de pagination.
/// `emptyPullPage` ne sait pas dire `hasMore`, et c'est précisément ce qui
/// permet ici au premier plan de prendre deux pages d'avance sur le worker.
PullPage _page({required String cursor, bool hasMore = false}) => PullPage(
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
    repCallCampaigns: const <SyncRepCallCampaignDto>[],
    repCallTasks: const <SyncRepCallTaskDto>[],
    visites: const <SyncVisiteDto>[],
  ),
  deletions: const <SyncDeletionDto>[],
  nextCursor: cursor,
  hasMore: hasMore,
  serverTime: t0,
);

/// Une page de pull ne portant qu'un représentant. Le reste des collections est
/// vide : ce qui nous intéresse est l'arbitrage, pas le volume.
PullPage pullPageWithRepresentant(RepresentantDto dto) => PullPage(
  changes: SyncChangesDto(
    departements: const <DepartementDto>[],
    iefs: const <IefDto>[],
    banques: const <BanqueDto>[],
    syndicats: const <SyndicatDto>[],
    canauxProvenance: const <CanalProvenanceDto>[],
    visiteReferentiels: const <SyncVisiteReferentielDto>[],
    representants: <RepresentantDto>[dto],
    prospects: const <ProspectDto>[],
    callCampaigns: const <SyncCallCampaignDto>[],
    callTasks: const <SyncCallTaskDto>[],
    repCallCampaigns: const <SyncRepCallCampaignDto>[],
    repCallTasks: const <SyncRepCallTaskDto>[],
    visites: const <SyncVisiteDto>[],
  ),
  deletions: const <SyncDeletionDto>[],
  nextCursor: 'c1',
  hasMore: false,
  serverTime: t0,
);

/// Une base qui laisse s'intercaler une écriture juste avant une transaction.
///
/// C'est le pendant de [_GatedApi] côté stockage : le faux serveur tient un
/// isolat DANS son envoi, celui-ci tient un appelant JUSTE AVANT sa
/// transaction. Sans ce point d'arrêt, la fenêtre entre une lecture et la
/// transaction qui s'en sert ne dure pas assez pour être observée, et un test
/// qui compterait sur l'ordonnancement des micro-tâches passerait ou échouerait
/// au gré des versions.
///
/// Le crochet est à un seul coup et s'efface avant de s'exécuter : sans quoi
/// l'écriture qu'il déclenche, qui ouvre elle-même une transaction, se
/// rappellerait indéfiniment.
class _HookedDatabase extends AppDatabase {
  _HookedDatabase(super.executor);

  /// Ce que l'utilisateur fait pendant que le moteur travaille.
  Future<void> Function()? onNextTransaction;

  @override
  Future<T> transaction<T>(
    Future<T> Function() action, {
    bool requireNew = false,
  }) async {
    final Future<void> Function()? hook = onNextTransaction;
    if (hook != null) {
      onNextTransaction = null;
      await hook();
    }
    return super.transaction(action, requireNew: requireNew);
  }
}

/// Un serveur qui ne répond qu'au coup de sifflet.
///
/// C'est le seul moyen de tenir un isolat DANS son envoi pendant qu'on
/// manipule la base sous lui : sans ce point d'arrêt, la fenêtre entre la
/// réservation et le verdict ne dure pas assez pour être observée.
class _GatedApi extends FakeApi {
  _GatedApi({this.failWith});

  /// Erreur à lever au relâchement, ou `null` pour un verdict `applied`.
  final ApiException? failWith;

  final Completer<void> entered = Completer<void>();
  final Completer<void> _gate = Completer<void>();

  void release() => _gate.complete();

  @override
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  }) async {
    if (!entered.isCompleted) entered.complete();
    await _gate.future;
    final ApiException? boom = failWith;
    if (boom != null) throw boom;
    return super.push(
      batchId: batchId,
      payloadVersion: payloadVersion,
      operations: operations,
    );
  }
}

/// Même dispositif, côté tirage.
class _GatedPullApi extends FakeApi {
  final Completer<void> entered = Completer<void>();
  final Completer<PullPage> _gate = Completer<PullPage>();

  void release(PullPage page) => _gate.complete(page);

  @override
  Future<PullPage> pull({
    String? cursor,
    int limit = 200,
    required int payloadVersion,
  }) async {
    if (!entered.isCompleted) entered.complete();
    return _gate.future;
  }
}

/// Un serveur qui applique VRAIMENT la garde de révision, et qui poursuit son
/// groupe après un refus : c'est ce que fait `runGroup` dans `apps/api`.
///
/// [FakeApi] acquitte tout : il ne peut donc rien démontrer sur `baseRev`. Ce
/// faux-ci reproduit les deux règles qui comptent : `assertRev` compare
/// strictement, et une écriture appliquée fait `rev = rev + 1`.
class _RevAwareApi extends FakeApi {
  _RevAwareApi({Map<String, int>? rev, Map<String, String>? content})
    : rev = rev ?? <String, int>{},
      content = content ?? <String, String>{};

  final Map<String, int> rev;
  final Map<String, String> content;

  @override
  Future<PushResult> push({
    required String batchId,
    required int payloadVersion,
    required List<SyncOperationDto> operations,
  }) async {
    calls.add(
      PushCall(
        batchId: batchId,
        payloadVersion: payloadVersion,
        operations: List<SyncOperationDto>.unmodifiable(operations),
      ),
    );

    final List<SyncOperationResultDto> results = <SyncOperationResultDto>[];
    for (final SyncOperationDto op in operations) {
      final int current = rev[op.entityId] ?? 0;
      final num? base = op.baseRev;
      if (base != null && base.toInt() != current) {
        // Refus, ET on poursuit le groupe : c'est exactement le comportement du
        // serveur, et c'est ce qui rendait la suite de la chaîne dangereuse.
        results.add(
          SyncOperationResultDto(
            opId: op.opId,
            status: SyncOpStatus.conflict,
            entityId: op.entityId,
            rev: null,
            serverUpdatedAt: null,
            errorCode: ServerErrorCodes.revConflict,
            error: 'La fiche a été modifiée entre-temps.',
          ),
        );
        continue;
      }
      rev[op.entityId] = current + 1;
      final String? name = op.data?.fullName;
      if (name != null) content[op.entityId] = name;
      results.add(
        SyncOperationResultDto(
          opId: op.opId,
          status: SyncOpStatus.applied,
          entityId: op.entityId,
          rev: rev[op.entityId],
          serverUpdatedAt: serverTime,
          errorCode: null,
          error: null,
        ),
      );
    }
    return PushResult(
      batchId: batchId,
      results: results,
      serverTime: serverTime,
    );
  }
}
