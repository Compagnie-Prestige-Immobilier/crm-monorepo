import 'dart:math';

import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Les quatre listes de l'accueil, quand le serveur a changé de génération.
///
/// Le défaut vécu au comptoir : la base serveur a été remontée, chaque entrée
/// a repris un identifiant NEUF sous le même intitulé, et le flux keyset —
/// qui ne sait dire que ce qui a changé — n'a jamais annoncé la disparition de
/// l'ancienne. Le téléphone gardait les deux : « CPI · CPI · SANTARGILE ·
/// SANTARGILE », et la visite inscrite avec l'ancienne revenait refusée
/// (`VISITE_REFERENTIEL_UNAVAILABLE`).
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

  Future<List<String>> lignes(String kind) async {
    final List<VisiteReferentiel> rows =
        await (db.select(db.visiteReferentiels)
              ..where((VisiteReferentiels t) => t.kind.equals(kind))
              ..orderBy(<OrderClauseGenerator<VisiteReferentiels>>[
                (VisiteReferentiels t) => OrderingTerm.asc(t.id),
              ]))
            .get();
    return <String>[for (final VisiteReferentiel r in rows) r.id];
  }

  test('la génération d\'hier quitte les listes de l\'accueil', () async {
    // Deux générations du même intitulé, comme sur le téléphone du comptoir.
    await poserReferentiel(db, id: 'vieux', kind: 'entreprises', label: 'CPI');
    api.pullPages.add(pageAvecListes(<SyncVisiteReferentielDto>[]));
    api.visiteReferentiels = bundle(
      entreprises: <VisiteReferentielDto>[entree('neuf', 'CPI')],
    );

    await engine.pullChanges();

    expect(
      await lignes('entreprises'),
      <String>['neuf'],
      reason: 'l\'identifiant que le serveur ne sert plus s\'en va',
    );
  });

  test('un serveur injoignable laisse les listes intactes', () async {
    await poserReferentiel(db, id: 'vieux', kind: 'entreprises', label: 'CPI');
    api.visiteReferentiels = null;

    await engine.pullChanges();

    expect(await lignes('entreprises'), <String>['vieux']);
  });

  test('relu une seule fois quand rien ne bouge', () async {
    api.visiteReferentiels = bundle(
      entreprises: <VisiteReferentielDto>[entree('e1', 'CPI')],
    );

    await engine.pullChanges();
    expect(
      api.visiteReferentielsPulls,
      1,
      reason: 'le premier passage soigne les téléphones déjà en service',
    );

    await engine.pullChanges();
    expect(
      api.visiteReferentielsPulls,
      1,
      reason: 'une lecture complète à chaque synchronisation pour rien',
    );
  });

  test('relu dès qu\'une page bouge une entrée', () async {
    api.visiteReferentiels = bundle(
      entreprises: <VisiteReferentielDto>[entree('e1', 'CPI')],
    );
    await engine.pullChanges();

    api.pullPages.add(
      pageAvecListes(<SyncVisiteReferentielDto>[
        syncEntree('e2', 'SANTARGILE'),
      ], cursor: 'c2'),
    );
    api.visiteReferentiels = bundle(
      entreprises: <VisiteReferentielDto>[
        entree('e1', 'CPI'),
        entree('e2', 'SANTARGILE'),
      ],
    );
    await engine.pullChanges();

    expect(api.visiteReferentielsPulls, 2);
    expect(await lignes('entreprises'), <String>['e1', 'e2']);
  });

  test(
    'une visite refusée sur une entrée morte redemande les listes',
    () async {
      api.visiteReferentiels = bundle(
        entreprises: <VisiteReferentielDto>[entree('e1', 'CPI')],
      );
      await engine.pullChanges();
      expect(api.visiteReferentielsPulls, 1);

      await queueOp(
        db,
        id: 'OP1',
        entityType: 'visite',
        entityId: 'v1',
        payload: <String, Object?>{
          'visitorName': 'Awa',
          'entrepriseId': 'mort',
        },
      );
      api.verdicts['OP1'] = SyncOperationResultDto(
        opId: 'OP1',
        status: SyncOpStatus.invalid,
        entityId: 'v1',
        rev: null,
        serverUpdatedAt: null,
        errorCode: ServerErrorCodes.visiteReferentielUnavailable,
        error: 'L\'entrée choisie pour « entreprise » n\'est plus proposée.',
      );
      await engine.drain();

      await engine.pullChanges();
      expect(
        api.visiteReferentielsPulls,
        2,
        reason: 'réessayer avec le même identifiant mort ne peut rien donner',
      );
    },
  );
}

Future<void> poserReferentiel(
  AppDatabase db, {
  required String id,
  required String kind,
  required String label,
  bool isActive = true,
}) => db
    .into(db.visiteReferentiels)
    .insert(
      VisiteReferentielsCompanion.insert(
        id: id,
        kind: kind,
        code: label.toUpperCase().replaceAll(' ', '_'),
        label: label,
        isActive: Value<bool>(isActive),
        localUpdatedAt: t0,
      ),
    );

VisiteReferentielDto entree(String id, String label) => VisiteReferentielDto(
  id: id,
  code: label.toUpperCase().replaceAll(' ', '_'),
  label: label,
  isActive: true,
  isSystem: false,
  sortOrder: 10,
  updatedAt: t0,
);

SyncVisiteReferentielDto syncEntree(String id, String label) =>
    SyncVisiteReferentielDto(
      id: id,
      kind: VisiteReferentielKind.entreprises,
      code: label.toUpperCase().replaceAll(' ', '_'),
      label: label,
      isActive: true,
      sortOrder: 10,
      updatedAt: t0,
    );

VisiteReferentielsBundleDto bundle({
  List<VisiteReferentielDto> entreprises = const <VisiteReferentielDto>[],
  List<VisiteReferentielDto> directions = const <VisiteReferentielDto>[],
  List<VisiteReferentielDto> destinataires = const <VisiteReferentielDto>[],
  List<VisiteReferentielDto> objets = const <VisiteReferentielDto>[],
}) => VisiteReferentielsBundleDto(
  entreprises: entreprises,
  directions: directions,
  destinataires: destinataires,
  objets: objets,
);

PullPage pageAvecListes(
  List<SyncVisiteReferentielDto> listes, {
  String cursor = 'c1',
}) => PullPage(
  changes: SyncChangesDto(
    departements: const <DepartementDto>[],
    iefs: const <IefDto>[],
    banques: const <BanqueDto>[],
    syndicats: const <SyndicatDto>[],
    canauxProvenance: const <CanalProvenanceDto>[],
    visiteReferentiels: listes,
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
  hasMore: false,
  serverTime: t0,
);
