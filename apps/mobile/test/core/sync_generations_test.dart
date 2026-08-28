import 'dart:math';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/reference_repository.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Deux générations de la même donnée.
///
/// La base serveur a été remontée : chaque ligne a repris un identifiant NEUF
/// sous le même nom et le même numéro. Le flux de synchronisation ne sait dire
/// que ce qui a CHANGÉ, jamais ce qui a DISPARU. Sans les correctifs que ces
/// tests couvrent, l'appareil gardait les deux générations côte à côte : le
/// sélecteur proposait chaque banque deux fois, le serveur refusait la saisie
/// qui citait l'ancienne, et — pire — l'index unique local sur le téléphone
/// faisait AVORTER la page entière, ce qui arrêtait toute synchronisation
/// définitivement.
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
  // Référentiels de saisie : le miroir de la liste entière
  // ───────────────────────────────────────────────────────────────────────────

  group('référentiels : ce que la liste entière ne contient plus s\'en va', () {
    test('la génération d\'hier quitte le sélecteur', () async {
      api.pullPages.add(pageAvecBanques(<BanqueDto>[banqueDto('A', 'CBAO')]));
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('A', 'CBAO')]);
      await engine.pullChanges();
      expect(await ids(db, 'banques'), containsAll(<String>['bq-1', 'A']));

      // La base serveur est remontée : même banque, identifiant neuf.
      api.pullPages.add(
        pageAvecBanques(<BanqueDto>[banqueDto('B', 'CBAO')], cursor: 'c2'),
      );
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('B', 'CBAO')]);
      await engine.pullChanges();

      final List<Banque> offertes = await ReferenceRepository(
        db,
      ).watchBanques().first;
      expect(offertes.map((Banque b) => b.id), <String>['B']);
      expect(
        offertes.where((Banque b) => b.name == 'CBAO').length,
        1,
        reason: 'le sélecteur ne doit proposer la banque qu\'une fois',
      );
    });

    test('la ligne retirée est masquée, pas effacée', () async {
      api.pullPages.add(pageAvecBanques(<BanqueDto>[banqueDto('A', 'CBAO')]));
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('B', 'UBA')]);
      await engine.pullChanges();

      final Banque? ancienne = await (db.select(
        db.banques,
      )..where((Banques t) => t.id.equals('A'))).getSingleOrNull();
      expect(
        ancienne,
        isNotNull,
        reason:
            'une fiche ancienne cite encore cette banque : son libellé doit '
            'rester lisible',
      );
      expect(ancienne!.deletedAt, isNotNull);
    });

    test('une restauration rouvre la ligne rendue à son identifiant', () async {
      api.pullPages.add(pageAvecBanques(<BanqueDto>[banqueDto('A', 'CBAO')]));
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('B', 'UBA')]);
      await engine.pullChanges();
      expect(await activeIds(db, 'banques'), <String>['B']);

      api.pullPages.add(
        pageAvecBanques(<BanqueDto>[banqueDto('A', 'CBAO')], cursor: 'c2'),
      );
      api.referentiels = snapshot(
        banques: <BanqueDto>[banqueDto('A', 'CBAO'), banqueDto('B', 'UBA')],
      );
      await engine.pullChanges();
      expect(await activeIds(db, 'banques'), <String>['A', 'B']);
    });

    test('une liste vide ne vide pas le miroir', () async {
      api.pullPages.add(pageAvecBanques(<BanqueDto>[banqueDto('A', 'CBAO')]));
      api.referentiels = snapshot();
      await engine.pullChanges();
      expect(
        await activeIds(db, 'banques'),
        containsAll(<String>['bq-1', 'A']),
      );
    });

    test('un serveur injoignable laisse le miroir intact', () async {
      api.pullPages.add(pageAvecBanques(<BanqueDto>[banqueDto('A', 'CBAO')]));
      api.referentiels = null;
      await engine.pullChanges();
      expect(
        await activeIds(db, 'banques'),
        containsAll(<String>['bq-1', 'A']),
      );
    });

    test('relu une seule fois quand rien ne bouge', () async {
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('A', 'CBAO')]);
      await engine.pullChanges();
      expect(api.referentielsPulls, 1);

      await engine.pullChanges();
      expect(
        api.referentielsPulls,
        1,
        reason:
            'trois lectures complètes à chaque synchronisation useraient '
            'le forfait pour rien',
      );
    });

    test('relu dès qu\'une page bouge un référentiel', () async {
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('A', 'CBAO')]);
      await engine.pullChanges();

      api.pullPages.add(
        pageAvecBanques(<BanqueDto>[banqueDto('B', 'UBA')], cursor: 'c2'),
      );
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('B', 'UBA')]);
      await engine.pullChanges();
      expect(api.referentielsPulls, 2);
      expect(await activeIds(db, 'banques'), <String>['B']);
    });

    test('un groupe refusé redemande le miroir', () async {
      api.referentiels = snapshot(banques: <BanqueDto>[banqueDto('A', 'CBAO')]);
      await engine.pullChanges();
      expect(api.referentielsPulls, 1);

      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(
        db,
        id: 'OP1',
        entityType: 'representant',
        entityId: 'repA',
        payload: <String, Object?>{'fullName': 'Awa'},
      );
      api.verdicts['OP1'] = SyncOperationResultDto(
        opId: 'OP1',
        status: SyncOpStatus.skippedDependencyFailed,
        entityId: 'repA',
        rev: null,
        serverUpdatedAt: null,
        errorCode: ServerErrorCodes.groupTransactionFailed,
        error: 'Groupe annulé.',
      );
      await engine.drain();

      await engine.pullChanges();
      expect(api.referentielsPulls, 2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Fiches : le même numéro sous un identifiant neuf
  // ───────────────────────────────────────────────────────────────────────────

  group('fiches : le numéro identifie la personne, pas la ligne', () {
    test('la fiche serveur prend la place de la génération d\'hier', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await insertProspect(
        db,
        id: 'p-old',
        representantId: 'rep-1',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      api.pullPages.add(
        pageAvecProspects(<ProspectDto>[
          prospectDto(id: 'p-new', phoneE164: '+221770000001', rev: 5),
        ]),
      );

      await engine.pullChanges();

      final Prospect ancienne = await (db.select(
        db.prospects,
      )..where((Prospects t) => t.id.equals('p-old'))).getSingle();
      expect(ancienne.deletedAt, isNotNull);
      final Prospect neuve = await (db.select(
        db.prospects,
      )..where((Prospects t) => t.id.equals('p-new'))).getSingle();
      expect(neuve.deletedAt, isNull);
      expect(
        await ReferenceRepository(db).watchAllProspects().first,
        hasLength(1),
      );
    });

    test('une saisie non partie n\'est jamais effacée', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await insertProspect(
        db,
        id: 'p-local',
        representantId: 'rep-1',
        phone: '+221770000001',
      );
      await queueOp(
        db,
        id: 'OP1',
        entityType: 'prospect',
        entityId: 'p-local',
        payload: <String, Object?>{'nom': 'Diop'},
      );
      api.pullPages.add(
        pageAvecProspects(<ProspectDto>[
          prospectDto(id: 'p-new', phoneE164: '+221770000001', rev: 5),
        ]),
      );

      await engine.pullChanges();

      final Prospect locale = await (db.select(
        db.prospects,
      )..where((Prospects t) => t.id.equals('p-local'))).getSingle();
      expect(locale.deletedAt, isNull);
      expect(
        await (db.select(
          db.prospects,
        )..where((Prospects t) => t.id.equals('p-new'))).getSingleOrNull(),
        isNull,
        reason:
            'c\'est la ligne SERVEUR qui attend : l\'envoi rendra son '
            'propre conflit de téléphone, que « À corriger » sait montrer',
      );
      expect(
        (await outboxById(db, 'OP1')).status,
        OutboxStatus.pending,
        reason: 'la saisie reste envoyable',
      );
    });

    test('un représentant renuméroté ne bloque plus la page', () async {
      await insertRepresentant(
        db,
        id: 'rep-old',
        phone: '+221770000001',
        serverUpdatedAt: t0,
      );
      api.pullPages.add(
        PullPage(
          changes: changesVides().copyWith(
            representants: <RepresentantDto>[
              representantDto(id: 'rep-new', phoneE164: '+221770000001'),
            ],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'c1',
          hasMore: false,
          serverTime: t0,
        ),
      );

      await engine.pullChanges();

      final Representant ancienne = await (db.select(
        db.representants,
      )..where((Representants t) => t.id.equals('rep-old'))).getSingle();
      expect(ancienne.deletedAt, isNotNull);
      expect(
        await ReferenceRepository(db).watchRepresentants().first,
        hasLength(1),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Files d'appels : une file retirée quitte le programme
  // ───────────────────────────────────────────────────────────────────────────

  group('files d\'appels : ce qui n\'est plus confié quitte le programme', () {
    test('une file de prospects retirée disparaît', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await insertProspect(
        db,
        id: 'p-1',
        representantId: 'rep-1',
        phone: '+221770000001',
      );
      await insertCampagne(db, id: 'camp-1');
      await insertTache(
        db,
        id: 'task-1',
        campaignId: 'camp-1',
        prospectId: 'p-1',
        position: 1,
      );
      expect(await db.campaignQueue(campaignId: 'camp-1').get(), hasLength(1));

      api.pullPages.add(
        PullPage(
          changes: changesVides().copyWith(
            callTasks: <SyncCallTaskDto>[
              tacheDto('task-1', 'camp-1', 'p-1', isActive: false),
            ],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'c1',
          hasMore: false,
          serverTime: t0,
        ),
      );
      await engine.pullChanges();

      expect(await db.campaignQueue(campaignId: 'camp-1').get(), isEmpty);
      expect(await db.select(db.callTasks).get(), isEmpty);
    });

    test('une file de représentants retirée disparaît', () async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
      await db
          .into(db.repCallCampaigns)
          .insert(
            RepCallCampaignsCompanion.insert(
              id: 'rc-1',
              name: 'R',
              updatedAt: t0,
            ),
          );
      await db
          .into(db.repCallTasks)
          .insert(
            RepCallTasksCompanion.insert(
              id: 'rt-1',
              campaignId: 'rc-1',
              representantId: 'rep-1',
              position: 1,
              updatedAt: t0,
            ),
          );
      expect(await db.repCampaignQueue(campaignId: 'rc-1').get(), hasLength(1));

      api.pullPages.add(
        PullPage(
          changes: changesVides().copyWith(
            repCallTasks: <SyncRepCallTaskDto>[
              tacheRepDto('rt-1', 'rc-1', 'rep-1', isActive: false),
            ],
          ),
          deletions: const <SyncDeletionDto>[],
          nextCursor: 'c1',
          hasMore: false,
          serverTime: t0,
        ),
      );
      await engine.pullChanges();

      expect(await db.repCampaignQueue(campaignId: 'rc-1').get(), isEmpty);
      expect(await db.select(db.repCallTasks).get(), isEmpty);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Annuaire de phase 2
  // ───────────────────────────────────────────────────────────────────────────

  group('annuaire : un numéro, une ligne', () {
    late Phase2DirectorySync annuaire;

    setUp(() {
      annuaire = Phase2DirectorySync(database: db, api: api, clock: clock);
    });

    test('la ligne périmée cède la place sans casser la page', () async {
      api.directoryPages.add(
        directoryPage(
          entries: <Phase2DirectoryEntry>[
            directoryEntry(prospectId: 'p-old', phoneE164: '+221770000001'),
          ],
        ),
      );
      await annuaire.pull();

      api.directoryPages.add(
        directoryPage(
          entries: <Phase2DirectoryEntry>[
            directoryEntry(prospectId: 'p-new', phoneE164: '+221770000001'),
          ],
          nextCursor: 'c2',
        ),
      );
      await annuaire.pull();

      final List<Phase2DirectoryData> rows = await db
          .select(db.phase2Directory)
          .get();
      expect(rows.map((Phase2DirectoryData r) => r.prospectId), <String>[
        'p-new',
      ]);
      expect(
        (await annuaire.lookupByPhone('+221770000001'))?.prospectId,
        'p-new',
      );
    });
  });
}

// ── Fabriques ────────────────────────────────────────────────────────────────

Future<List<String>> ids(AppDatabase db, String table) async {
  final List<QueryRow> rows = await db
      .customSelect('SELECT id FROM $table ORDER BY id')
      .get();
  return <String>[for (final QueryRow r in rows) r.read<String>('id')];
}

Future<List<String>> activeIds(AppDatabase db, String table) async {
  final List<QueryRow> rows = await db
      .customSelect(
        'SELECT id FROM $table WHERE deleted_at IS NULL ORDER BY id',
      )
      .get();
  return <String>[for (final QueryRow r in rows) r.read<String>('id')];
}

BanqueDto banqueDto(String id, String name) => BanqueDto(
  id: id,
  name: name,
  shortName: name,
  isActive: true,
  sortOrder: 10,
  updatedAt: DateTime.utc(2026, 8, 12),
);

SyncCallTaskDto tacheDto(
  String id,
  String campaignId,
  String prospectId, {
  required bool isActive,
}) => SyncCallTaskDto(
  id: id,
  campaignId: campaignId,
  prospectId: prospectId,
  position: 1,
  dayIndex: 0,
  status: CallTaskStatus.OPEN,
  isActive: isActive,
  updatedAt: t0,
);

SyncRepCallTaskDto tacheRepDto(
  String id,
  String campaignId,
  String representantId, {
  required bool isActive,
}) => SyncRepCallTaskDto(
  id: id,
  campaignId: campaignId,
  representantId: representantId,
  position: 1,
  dayIndex: 0,
  status: CallTaskStatus.OPEN,
  isActive: isActive,
  updatedAt: t0,
);

ReferentielsSnapshot snapshot({
  List<BanqueDto> banques = const <BanqueDto>[],
  List<SyndicatDto> syndicats = const <SyndicatDto>[],
  List<DepartementDto> departements = const <DepartementDto>[],
  List<IefDto> iefs = const <IefDto>[],
  List<CanalProvenanceDto> canauxProvenance = const <CanalProvenanceDto>[],
}) => ReferentielsSnapshot(
  departements: departements,
  iefs: iefs,
  banques: banques,
  syndicats: syndicats,
  canauxProvenance: canauxProvenance,
);

SyncChangesDto changesVides() => SyncChangesDto(
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
);

PullPage pageAvecBanques(List<BanqueDto> banques, {String cursor = 'c1'}) =>
    PullPage(
      changes: changesVides().copyWith(banques: banques),
      deletions: const <SyncDeletionDto>[],
      nextCursor: cursor,
      hasMore: false,
      serverTime: t0,
    );

PullPage pageAvecProspects(
  List<ProspectDto> prospects, {
  String cursor = 'c1',
}) => PullPage(
  changes: changesVides().copyWith(prospects: prospects),
  deletions: const <SyncDeletionDto>[],
  nextCursor: cursor,
  hasMore: false,
  serverTime: t0,
);
