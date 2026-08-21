import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/campagnes/campagnes.dart';
import 'package:cpi_go/features/campagnes/presentation/campagne_file_screen.dart';
import 'package:cpi_go/features/campagnes/presentation/campagnes_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Ce que le serveur a réparti, le téléphone doit le rendre à l'identique.
///
/// Le programme papier PDF et cet écran rendent la MÊME file : `day_index` puis
/// `position`. Un écran qui s'en écarte fait perdre sa place au téléconseiller,
/// et rien ne le signale : les deux listes se ressemblent assez pour qu'on ne
/// voie pas la différence en passant.
///
/// L'autre règle tient au pull, qui pagine `callCampaigns`, `callTasks` et
/// `prospects` SÉPARÉMENT et sans clé étrangère locale. Une ligne de file peut
/// donc arriver avant sa campagne ou avant sa fiche. Elle doit rester
/// invisible, jamais faire planter l'écran ni gonfler un compte.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    SinglePush.reset();
    await insertRepresentant(db, id: 'rep-1', phone: '+221770009999');
  });

  tearDown(() => db.close());

  /// Les routes que ces deux écrans demandent, et la destination d'un appel.
  ///
  /// `app_router.dart` appartient à un autre chantier : les poser ici décrit le
  /// contrat attendu et le vérifie, sans toucher au routeur de l'application.
  GoRouter buildRouter(String initial) {
    return GoRouter(
      initialLocation: initial,
      routes: <RouteBase>[
        GoRoute(
          path: CampagnesRoutes.liste,
          builder: (BuildContext context, GoRouterState state) =>
              const CampagnesScreen(),
        ),
        GoRoute(
          path: CampagnesRoutes.file,
          builder: (BuildContext context, GoRouterState state) =>
              CampagneFileScreen(
                campaignId: state.pathParameters[CampagnesRoutes.idParam] ?? '',
              ),
        ),
        GoRoute(
          path: Routes.phase2,
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Text(
              'appel ${state.uri.queryParameters[Routes.prefillPhoneParam]}',
            ),
          ),
        ),
      ],
    );
  }

  Future<Widget> app(String initial, List<Override> extra) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: <Override>[
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        ...extra,
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        routerConfig: buildRouter(initial),
      ),
    );
  }

  Future<void> settle(WidgetTester tester) async {
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
  }

  Future<void> open(
    WidgetTester tester,
    String initial, {
    List<Override> extra = const <Override>[],
  }) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(await app(initial, extra));
    await settle(tester);
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// Une fiche et la ligne de file qui la confie, en une fois.
  Future<void> confier(
    String campaignId, {
    required String suffixe,
    required int position,
    int dayIndex = 0,
    String status = 'OPEN',
    String nom = 'Diop',
    String prenom = 'Awa',
    bool avecFiche = true,
    bool ficheSupprimee = false,
  }) async {
    if (avecFiche) {
      await insertProspect(
        db,
        id: 'pro-$suffixe',
        representantId: 'rep-1',
        phone: '+22177${suffixe.padLeft(7, '0')}',
        nom: nom,
        prenom: prenom,
        deletedAt: ficheSupprimee ? t0 : null,
      );
    }
    await insertTache(
      db,
      id: 'tache-$suffixe',
      campaignId: campaignId,
      prospectId: 'pro-$suffixe',
      position: position,
      dayIndex: dayIndex,
      status: status,
    );
  }

  /// L'ordre des lignes tel qu'il est PEINT, de haut en bas.
  List<String> lignesAffichees(WidgetTester tester) {
    return tester
        .widgetList<ListTile>(find.byType(ListTile))
        .map((ListTile t) => (t.title! as Text).data!)
        .toList(growable: false);
  }

  testWidgets('la liste ne porte que les campagnes qui ont du travail', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J', spreadDays: 3);
    await insertCampagne(db, id: 'camp-b', name: 'Lot K');
    await confier('camp-a', suffixe: '01', position: 1);
    await confier('camp-a', suffixe: '02', position: 2, dayIndex: 1);
    await confier('camp-b', suffixe: '03', position: 1, status: 'DONE');

    await open(tester, CampagnesRoutes.liste);

    expect(find.text('Lot J'), findsOneWidget);
    expect(find.text('2 fiches à appeler, réparties sur 3 jours'), findsOneWidget);
    expect(
      find.text('Lot K'),
      findsNothing,
      reason: 'une campagne sans fiche ouverte n\'a rien à faire dans la liste',
    );

    await unmount(tester);
  });

  testWidgets('une file dont la campagne n\'est pas descendue reste invisible', (
    WidgetTester tester,
  ) async {
    await confier('camp-pas-encore-la', suffixe: '01', position: 1);

    await open(tester, CampagnesRoutes.liste);

    expect(find.text('Aucune file confiée'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await unmount(tester);
  });

  testWidgets('une file dont la fiche n\'est pas descendue ne se compte pas', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J');
    await confier('camp-a', suffixe: '01', position: 1);
    await confier('camp-a', suffixe: '02', position: 2, avecFiche: false);
    await confier('camp-a', suffixe: '03', position: 3, ficheSupprimee: true);

    await open(tester, CampagnesRoutes.liste);

    expect(find.text('1 fiche à appeler'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('la file suit l\'ordre du programme, pas celui des insertions', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J', spreadDays: 2);
    await confier(
      'camp-a',
      suffixe: '04',
      position: 4,
      dayIndex: 1,
      prenom: 'Dieynaba',
    );
    await confier('camp-a', suffixe: '02', position: 2, prenom: 'Bineta');
    await confier(
      'camp-a',
      suffixe: '03',
      position: 3,
      dayIndex: 1,
      prenom: 'Coumba',
    );
    await confier('camp-a', suffixe: '01', position: 1, prenom: 'Awa');

    await open(tester, CampagnesRoutes.fileFor('camp-a'));

    expect(lignesAffichees(tester), <String>[
      '1 · Awa Diop',
      '2 · Bineta Diop',
      '3 · Coumba Diop',
      '4 · Dieynaba Diop',
    ]);

    await unmount(tester);
  });

  testWidgets('la journée du programme reste visible et n\'est pas aplatie', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J', spreadDays: 3);
    await confier('camp-a', suffixe: '01', position: 1);
    await confier('camp-a', suffixe: '02', position: 2, dayIndex: 1);
    await confier('camp-a', suffixe: '03', position: 3, dayIndex: 1);

    await open(tester, CampagnesRoutes.fileFor('camp-a'));

    expect(find.text('Jour 1 sur 3 · 1 fiche'), findsOneWidget);
    expect(find.text('Jour 2 sur 3 · 2 fiches'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une campagne d\'un seul jour n\'affiche pas d\'en-tête de jour', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J');
    await confier('camp-a', suffixe: '01', position: 1);

    await open(tester, CampagnesRoutes.fileFor('camp-a'));

    expect(find.textContaining('Jour '), findsNothing);

    await unmount(tester);
  });

  testWidgets('la file d\'une campagne inconnue s\'ouvre sans planter', (
    WidgetTester tester,
  ) async {
    await open(tester, CampagnesRoutes.fileFor('camp-absente'));

    expect(tester.takeException(), isNull);
    expect(find.text('Campagne'), findsOneWidget);
    expect(find.text('Rien à appeler ici'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('la file connaît le nom de sa campagne arrivée après elle', (
    WidgetTester tester,
  ) async {
    await confier('camp-a', suffixe: '01', position: 1);

    await open(tester, CampagnesRoutes.fileFor('camp-a'));
    expect(find.text('Campagne'), findsOneWidget);

    await insertCampagne(db, id: 'camp-a', name: 'Lot J');
    await settle(tester);

    expect(find.text('Lot J'), findsOneWidget);
    expect(find.text('1 · Awa Diop'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('ouvrir une ligne mène au parcours d\'appel sur son numéro', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J');
    await confier('camp-a', suffixe: '01', position: 1);

    await open(tester, CampagnesRoutes.fileFor('camp-a'));
    await tester.tap(find.text('1 · Awa Diop'));
    await settle(tester);

    expect(find.text('appel +221770000001'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une campagne de la liste ouvre sa file', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J');
    await confier('camp-a', suffixe: '01', position: 1);

    await open(tester, CampagnesRoutes.liste);
    await tester.tap(find.text('Lot J'));
    await settle(tester);

    expect(find.byType(CampagneFileScreen), findsOneWidget);
    expect(find.text('1 · Awa Diop'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une file de plusieurs centaines de lignes reste paresseuse', (
    WidgetTester tester,
  ) async {
    await insertCampagne(db, id: 'camp-a', name: 'Lot J', spreadDays: 7);
    for (int i = 1; i <= 300; i++) {
      await confier(
        'camp-a',
        suffixe: i.toString().padLeft(3, '0'),
        position: i,
        dayIndex: (i - 1) ~/ 43,
      );
    }

    await open(tester, CampagnesRoutes.fileFor('camp-a'));

    // Les 300 lignes existent en base, seule une poignée est construite.
    expect(find.byType(ListTile), findsWidgets);
    expect(tester.widgetList<ListTile>(find.byType(ListTile)).length, lessThan(40));
    expect(find.text('1 · Awa Diop'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une lecture en échec se voit à l\'écran, jamais avalée', (
    WidgetTester tester,
  ) async {
    await open(
      tester,
      CampagnesRoutes.liste,
      extra: <Override>[
        campagnesProvider.overrideWith(
          (Ref ref) => Stream<List<CampaignsWithOpenWorkResult>>.error(
            Exception('base illisible'),
          ),
        ),
      ],
    );

    expect(
      find.textContaining('Lecture des campagnes impossible.'),
      findsOneWidget,
    );
    expect(find.textContaining('base illisible'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une file en échec se voit à l\'écran, jamais avalée', (
    WidgetTester tester,
  ) async {
    await open(
      tester,
      CampagnesRoutes.fileFor('camp-a'),
      extra: <Override>[
        fileDeCampagneProvider.overrideWith(
          (Ref ref, String campaignId) =>
              Stream<List<CampaignQueueResult>>.error(
                Exception('base illisible'),
              ),
        ),
      ],
    );

    expect(find.textContaining('Lecture de la file impossible.'), findsOneWidget);
    expect(find.textContaining('base illisible'), findsOneWidget);

    await unmount(tester);
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
