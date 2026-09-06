import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/sync_engine_factory.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_qualification_screen.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// EB-16 vu du téléphone : l'encadrement réaffecte une fiche depuis le web, et
/// l'appareil ne reçoit rien qui la nomme. Le périmètre d'appel se relit EN
/// ENTIER à chaque synchronisation, et c'est lui seul qui borne les écrans.
void main() {
  late AppDatabase db;
  late FakeApi api;
  late SyncEngine engine;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    SinglePush.reset();
    db = await openTestDatabase();
    api = FakeApi(userId: 'u-1');
    engine = buildSyncEngine(
      database: db,
      api: api,
      tokens: InMemoryTokenStore(refreshToken: 'r', userId: 'u-1'),
      clock: FakeClock(t0),
    );
  });

  tearDown(() => db.close());

  /// Les fiches d'une campagne ne sont pas saisies par le téléconseiller : le
  /// périmètre laisse toujours passer ce qu'il a créé lui-même, et une fiche
  /// posée à son nom ne prouverait rien.
  Future<void> seedCampagne() async {
    await insertRepresentant(
      db,
      id: 'rep-x',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      createdById: 'import',
    );
    await insertRepresentant(
      db,
      id: 'rep-y',
      phone: '+221770000002',
      fullName: 'Aminata Ba',
      createdById: 'import',
    );
  }

  Future<void> seedProspects() async {
    for (final (String id, String prenom, String phone)
        in <(String, String, String)>[
          ('pro-x', 'Fatou', '+221780000001'),
          ('pro-y', 'Bineta', '+221780000002'),
        ]) {
      await insertProspect(
        db,
        id: id,
        representantId: 'rep-x',
        phone: phone,
        nom: 'Ndiaye',
        prenom: prenom,
        createdById: 'import',
      );
      await db
          .into(db.prospectJourneys)
          .insert(
            ProspectJourneysCompanion.insert(prospectId: id, projet: 'CHUES'),
          );
    }
  }

  /// Une synchronisation dont la seule nouveauté est le périmètre servi : c'est
  /// exactement ce que produit une réaffectation faite côté web.
  Future<void> synchroniser({
    List<String> representants = const <String>[],
    List<String> prospects = const <String>[],
  }) async {
    api.attributions = MesAttributionsDto(
      representantIds: representants,
      prospectIds: prospects,
      tout: false,
    );
    await engine.pullChanges();
  }

  Future<void> pumpScope(WidgetTester tester, Widget app) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_Inerte.new),
          authControllerProvider.overrideWith(_Connecte.new),
        ],
        child: app,
      ),
    );
    await settle(tester);
  }

  /// La liste sous un routeur minimal : ouvrir une fiche est le geste de
  /// l'écran, et la route d'arrivée dit laquelle a été ouverte.
  Future<void> monterListe(WidgetTester tester) async {
    final GoRouter router = GoRouter(
      initialLocation: Routes.historique,
      routes: <RouteBase>[
        GoRoute(
          path: Routes.historique,
          builder: (BuildContext context, GoRouterState state) =>
              const HistoriqueScreen(),
        ),
        GoRoute(
          path: Routes.representantDetail,
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Center(child: Text('FICHE ${state.pathParameters['id']}')),
          ),
        ),
      ],
    );
    addTearDown(router.dispose);
    await pumpScope(
      tester,
      MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        routerConfig: router,
      ),
    );
  }

  Future<void> monter(WidgetTester tester, Widget home) => pumpScope(
    tester,
    MaterialApp(
      theme: AppTheme.light,
      locale: const Locale('fr'),
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      supportedLocales: const <Locale>[Locale('fr')],
      home: home,
    ),
  );

  Future<void> demonter(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('la fiche retirée du périmètre quitte la liste, celle qui '
      'm\'est confiée y entre', (WidgetTester tester) async {
    await seedCampagne();
    await synchroniser(representants: <String>['rep-x']);

    await monterListe(tester);

    expect(find.text('Ousmane Fall'), findsOneWidget);
    expect(find.text('Aminata Ba'), findsNothing);

    await synchroniser(representants: <String>['rep-y']);
    await settle(tester);

    expect(find.text('Ousmane Fall'), findsNothing);
    expect(find.text('Aminata Ba'), findsOneWidget);

    await tester.tap(find.text('Aminata Ba'));
    await settle(tester);
    expect(find.text('FICHE rep-y'), findsOneWidget);

    await demonter(tester);
  });

  testWidgets('le prospect réaffecté quitte la liste des prospects', (
    WidgetTester tester,
  ) async {
    await seedCampagne();
    await seedProspects();
    await synchroniser(
      representants: <String>['rep-x'],
      prospects: <String>['pro-x'],
    );

    await monterListe(tester);
    await tester.tap(find.text('Prospects'));
    await settle(tester);

    expect(find.text('Fatou Ndiaye'), findsOneWidget);
    expect(find.text('Bineta Ndiaye'), findsNothing);

    await synchroniser(
      representants: <String>['rep-x'],
      prospects: <String>['pro-y'],
    );
    await settle(tester);

    expect(find.text('Fatou Ndiaye'), findsNothing);
    expect(find.text('Bineta Ndiaye'), findsOneWidget);

    await demonter(tester);
  });

  // Une carte « sur 2 représentants » au-dessus d'une liste qui n'en rend qu'un
  // ferait chercher la fiche manquante.
  testWidgets('l\'accueil compte le périmètre d\'après la synchronisation', (
    WidgetTester tester,
  ) async {
    await seedCampagne();
    await synchroniser(representants: <String>['rep-x', 'rep-y']);

    await monter(tester, const HomeScreen());

    expect(find.text('appelés sur 2 représentants'), findsOneWidget);

    await synchroniser(representants: <String>['rep-y']);
    await settle(tester);

    expect(find.text('appelés sur 1 représentants'), findsOneWidget);

    await demonter(tester);
  });

  // Le cas du terrain : la fiche part pendant l'appel. Le périmètre borne les
  // listes, il ne referme pas ce qui est déjà ouvert.
  testWidgets('une fiche réaffectée pendant son ouverture ne fait pas perdre '
      'le travail en cours', (WidgetTester tester) async {
    await seedCampagne();
    await db
        .into(db.statutsQualification)
        .insert(
          StatutsQualificationCompanion.insert(
            code: 'HORS_CIBLE',
            id: 'sq-hors-cible',
            label: 'Hors cible',
            effect: 'REFUSED',
          ),
        );
    await synchroniser(representants: <String>['rep-x']);

    await monter(
      tester,
      const RepresentantQualificationScreen(representantId: 'rep-x'),
    );
    await tester.tap(find.text('Ouvrir'));
    await settle(tester);
    await tester.tap(find.text('Consigner l\'appel'));
    await settle(tester);
    await tester.tap(find.text('Joignable'));
    await settle(tester);

    final OuverturesFicheData ouverte =
        (await db.select(db.ouverturesFiche).get()).single;
    expect(ouverte.firstInputAt, t0);

    await synchroniser(representants: <String>['rep-y']);
    await settle(tester);

    expect(find.text('Ouvrir la fiche de Ousmane Fall ?'), findsNothing);
    expect(find.text('00:00'), findsOneWidget);

    final List<OuverturesFicheData> apres = await db
        .select(db.ouverturesFiche)
        .get();
    expect(apres, hasLength(1));
    expect(apres.single.id, ouverte.id);
    expect(apres.single.closedAt, isNull);
    expect(apres.single.firstInputAt, t0);

    await demonter(tester);
  });
}

Future<void> settle(WidgetTester tester) async {
  for (int i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

class _Inerte extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();

  @override
  void nudge() {}
}

class _Connecte extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
    email: 'awa.sy@cpi.sn',
  );
}
