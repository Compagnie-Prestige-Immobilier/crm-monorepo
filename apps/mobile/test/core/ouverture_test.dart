import 'dart:convert';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/sync_engine_factory.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/ouverture_repository.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

void main() {
  late AppDatabase db;
  late FakeApi api;
  late OuvertureRepository ouvertures;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    ouvertures = OuvertureRepository(db, api, clock: FakeClock(t0));
    await insertRepresentant(db, id: 'rep-1', phone: '+221771234567');
  });

  tearDown(() => db.close());

  test(
    'l\'ouverture confirmée verrouille la fiche et part au serveur',
    () async {
      final OuvertureResultat resultat = await ouvertures.ouvrir(
        openedById: 'user-1',
        representantId: 'rep-1',
      );

      expect(resultat.tenue, isNull);
      expect(resultat.ouverte?.representantId, 'rep-1');
      expect(resultat.ouverte?.openedAt, t0);
      expect(resultat.ouverte?.closedAt, isNull);
      expect(api.ouvertures.single.representantId, 'rep-1');
      // Le serveur a répondu : rien à rejouer.
      expect(await allOutbox(db), isEmpty);
      expect((await ouvertures.courante('user-1'))?.id, resultat.ouverte?.id);
    },
  );

  // Sans réseau l'écran doit s'ouvrir quand même : une fiche non traitée parce
  // que le serveur ne répond pas est une journée de terrain perdue.
  test(
    'hors ligne, la fiche s\'ouvre et l\'ouverture attend en file',
    () async {
      api.failNextOuvrirFiche = const ApiException(
        'NETWORK',
        kind: FailureKind.unreachable,
      );

      final OuvertureResultat resultat = await ouvertures.ouvrir(
        openedById: 'user-1',
        representantId: 'rep-1',
      );
      expect(resultat.ouverte, isNotNull);

      final OutboxData enFile = (await allOutbox(db)).single;
      expect(enFile.entityType, ouvertureEntity);
      expect(enFile.entityId, resultat.ouverte!.id);
      expect(enFile.dependencyKey, 'rep-1');
      expect(
        (jsonDecode(enFile.payload) as Map<String, Object?>)['openedAt'],
        t0.toUtc().toIso8601String(),
      );

      final SyncEngine engine = buildSyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'user-1'),
        clock: FakeClock(t0),
      );
      await engine.drain();
      expect(api.ouvertures.single.id, resultat.ouverte!.id);
      expect((await allOutbox(db)).single.status, OutboxStatus.done);
    },
  );

  // Le serveur refuse sans dire quelle fiche il tient : l'écran doit pouvoir
  // proposer de la rouvrir, sinon le téléconseiller est bloqué sans issue.
  test('le verrou du serveur nomme la fiche déjà tenue', () async {
    api.courante = ouvertureFicheDto(
      id: 'ouv-ailleurs',
      openedAt: t0,
      representantId: 'rep-9',
      ficheNom: 'Awa Ndiaye',
    );
    api.failNextOuvrirFiche = const ApiException(
      ouvertureFicheDejaOuverteCode,
      statusCode: 409,
      kind: FailureKind.terminal,
    );

    final OuvertureResultat resultat = await ouvertures.ouvrir(
      openedById: 'user-1',
      representantId: 'rep-1',
    );
    expect(resultat.ouverte, isNull);
    expect(resultat.tenue?.id, 'ouv-ailleurs');
    expect(resultat.tenue?.ficheNom, 'Awa Ndiaye');
    // Rien n'est écrit : la fiche refusée n'a jamais été ouverte.
    expect(await db.select(db.ouverturesFiche).get(), isEmpty);
  });

  // Le verrou local vaut hors ligne : une seconde fiche ne s'ouvre pas parce
  // que le serveur est injoignable.
  test('une seconde fiche renvoie celle déjà tenue sur l\'appareil', () async {
    await ouvertures.ouvrir(openedById: 'user-1', representantId: 'rep-1');
    await insertRepresentant(db, id: 'rep-2', phone: '+221771234568');

    final OuvertureResultat seconde = await ouvertures.ouvrir(
      openedById: 'user-1',
      representantId: 'rep-2',
    );
    expect(seconde.ouverte, isNull);
    expect(seconde.tenue?.representantId, 'rep-1');
  });

  test(
    'la qualification ferme l\'ouverture et arrête le chronomètre',
    () async {
      final OuvertureResultat resultat = await ouvertures.ouvrir(
        openedById: 'user-1',
        representantId: 'rep-1',
      );
      final String ouvertureId = resultat.ouverte!.id;

      final WriteRepository writes = WriteRepository(
        db,
        clock: FakeClock(t0.add(const Duration(minutes: 4))),
      );
      await writes.recordRepCallAttempt(
        representantId: 'rep-1',
        outcome: 'REACHED',
        createdById: 'user-1',
        createdByName: 'Awa Sy',
        ouvertureId: ouvertureId,
      );

      final OuverturesFicheData fermee = (await ouvertures.parId(ouvertureId))!;
      expect(fermee.closedAt, t0.add(const Duration(minutes: 4)));
      expect(fermee.closingAttemptId, isNotNull);
      expect(await ouvertures.courante('user-1'), isNull);

      final SyncEngine engine = buildSyncEngine(
        database: db,
        api: api,
        tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'user-1'),
        clock: FakeClock(t0.add(const Duration(minutes: 5))),
      );
      await engine.drain();
      expect(api.fermeturesRecues, <String?>[ouvertureId]);
    },
  );

  test('l\'historique garde ce que la tentative a dit', () async {
    final WriteRepository writes = WriteRepository(db, clock: FakeClock(t0));
    await writes.recordRepCallAttempt(
      representantId: 'rep-1',
      outcome: 'REACHED',
      createdById: 'user-1',
      createdByName: 'Awa Sy',
      comment: 'Il rappelle lundi',
      contacte: true,
      connaitUES: false,
    );

    final HistoriqueRepresentantResult ligne =
        (await db.historiqueRepresentant(representantId: 'rep-1').get()).single;
    expect(ligne.createdByName, 'Awa Sy');
    expect(ligne.comment, 'Il rappelle lundi');
    expect(ligne.contacte, isTrue);
    expect(ligne.connaitUes, isFalse);
    expect(ligne.clientCreatedAt, t0);
  });

  // La libération est décidée depuis le web : l'appareil ne l'apprend qu'en
  // redemandant la fiche courante, sinon son verrou tiendrait pour toujours.
  test('une ouverture libérée ailleurs rend la main', () async {
    await ouvertures.ouvrir(openedById: 'user-1', representantId: 'rep-1');
    api.courante = null;

    expect(await ouvertures.reconcilier('user-1'), isNull);
    expect(await ouvertures.courante('user-1'), isNull);
  });

  test('sans réseau, la réconciliation garde le verrou', () async {
    final OuvertureResultat resultat = await ouvertures.ouvrir(
      openedById: 'user-1',
      representantId: 'rep-1',
    );
    api.failNextOuvertureCourante = const ApiException(
      'NETWORK',
      kind: FailureKind.unreachable,
    );

    expect((await ouvertures.reconcilier('user-1'))?.id, resultat.ouverte!.id);
  });
}
