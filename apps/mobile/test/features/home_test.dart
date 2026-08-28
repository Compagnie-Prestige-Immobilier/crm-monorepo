import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/campagnes/campagnes.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// L'accueil CHUES est la liste des trois phases, dans l'ordre.
///
/// Il montrait « À appeler », « Fiches » et « Pas encore envoyé » : trois
/// chiffres qui ne disaient pas quoi faire, et un bouton « Nouvelle fiche » qui
/// proposait de créer un représentant alors que la base des représentants est
/// importée depuis le web. Ce fichier fixe ce que l'écran doit dire : qualifier,
/// ajouter, convertir ; chacun avec ce qu'il en reste et où il mène.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    SinglePush.reset();
  });

  tearDown(() async => db.close());

  Future<void> seedFileRepresentants({
    required String campaignId,
    required List<String> representantIds,
  }) async {
    await db
        .into(db.repCallCampaigns)
        .insert(
          RepCallCampaignsCompanion.insert(
            id: campaignId,
            name: 'Relance $campaignId',
            updatedAt: t0,
          ),
        );
    for (int i = 0; i < representantIds.length; i++) {
      await db
          .into(db.repCallTasks)
          .insert(
            RepCallTasksCompanion.insert(
              id: '$campaignId-t$i',
              campaignId: campaignId,
              representantId: representantIds[i],
              position: i + 1,
              updatedAt: t0,
            ),
          );
    }
  }

  Future<void> mount(
    WidgetTester tester, {
    List<Override> extra = const <Override>[],
  }) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final GoRouter router = GoRouter(
      initialLocation: Routes.chues,
      routes: <RouteBase>[
        GoRoute(
          path: Routes.chues,
          builder: (BuildContext context, GoRouterState state) =>
              const HomeScreen(),
        ),
        GoRoute(
          path: CampagnesRoutes.repFile,
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Text(
              'FILE REP ${state.pathParameters[CampagnesRoutes.idParam]}',
            ),
          ),
        ),
        GoRoute(
          path: CampagnesRoutes.file,
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Text('FILE ${state.pathParameters[CampagnesRoutes.idParam]}'),
          ),
        ),
        GoRoute(
          path: CampagnesRoutes.liste,
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Text(
              'LISTE ${state.uri.queryParameters[CampagnesRoutes.ongletParam] ?? 'prospects'}',
            ),
          ),
        ),
        GoRoute(
          path: Routes.representants,
          builder: (BuildContext context, GoRouterState state) =>
              const Scaffold(body: Text('PICKER')),
        ),
        GoRoute(
          path: Routes.phase2,
          builder: (BuildContext context, GoRouterState state) =>
              const Scaffold(body: Text('CONSIGNER')),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(_SignedInController.new),
          ...extra,
        ],
        child: MaterialApp.router(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('les trois phases sont là, numérotées, avec leur reste', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      relationStatus: 'AMBASSADEUR',
    );
    await insertRepresentant(
      db,
      id: 'rep-2',
      phone: '+221770000002',
      relationStatus: 'AMBASSADEUR',
    );
    await insertRepresentant(db, id: 'rep-3', phone: '+221770000003');
    await insertProspect(
      db,
      id: 'pro-1',
      representantId: 'rep-2',
      phone: '+221780000001',
    );
    await seedFileRepresentants(
      campaignId: 'rc-1',
      representantIds: <String>['rep-1', 'rep-3'],
    );
    await insertCampagne(db, id: 'c-1');
    await insertTache(
      db,
      id: 't-1',
      campaignId: 'c-1',
      prospectId: 'pro-1',
      position: 1,
    );

    await mount(tester);

    expect(find.text('Qualifier les représentants'), findsOneWidget);
    expect(find.text('Ajouter des prospects'), findsOneWidget);
    expect(find.text('Convertir les prospects'), findsOneWidget);

    // Le rang, le titre et le chiffre en une seule annonce : c'est ce que le
    // lecteur d'écran lit, et c'est ce que l'œil lit aussi.
    expect(
      find.bySemanticsLabel(
        'Étape 1. Qualifier les représentants. 2 représentants à appeler.',
      ),
      findsOneWidget,
    );
    // rep-1 a dit oui et n'a personne ; rep-2 a déjà un prospect ; rep-3 n'a
    // pas encore accepté.
    expect(
      find.bySemanticsLabel(
        'Étape 2. Ajouter des prospects. 1 représentant sans prospect.',
      ),
      findsOneWidget,
    );
    expect(
      find.bySemanticsLabel(
        'Étape 3. Convertir les prospects. 1 prospect à appeler.',
      ),
      findsOneWidget,
    );

    await unmount(tester);
  });

  testWidgets('une seule file de représentants ouvre la file, pas la liste', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await seedFileRepresentants(
      campaignId: 'rc-1',
      representantIds: <String>['rep-1'],
    );

    await mount(tester);
    await tester.tap(find.text('Qualifier les représentants'));
    await tester.pumpAndSettle();

    expect(find.text('FILE REP rc-1'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('plusieurs files ouvrent la liste sur l\'onglet Représentants', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await insertRepresentant(db, id: 'rep-2', phone: '+221770000002');
    await seedFileRepresentants(
      campaignId: 'rc-1',
      representantIds: <String>['rep-1'],
    );
    await seedFileRepresentants(
      campaignId: 'rc-2',
      representantIds: <String>['rep-2'],
    );

    await mount(tester);
    await tester.tap(find.text('Qualifier les représentants'));
    await tester.pumpAndSettle();

    expect(find.text('LISTE representants'), findsOneWidget);

    await unmount(tester);
  });

  // Le Grand Public a sa propre coque et son propre travail du jour : ses files
  // n'ont rien à faire dans le compte de CHUES, ni dans sa destination.
  testWidgets('l\'étape 3 ignore les files Grand Public', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await insertProspect(
      db,
      id: 'pro-chues',
      representantId: 'rep-1',
      phone: '+221780000001',
    );
    await insertProspect(
      db,
      id: 'pro-gp',
      representantId: 'rep-1',
      phone: '+221780000002',
      projet: 'GRAND_PUBLIC',
    );
    await insertCampagne(db, id: 'c-chues', name: 'Lot CHUES');
    await insertCampagne(db, id: 'c-gp', name: 'Lot Grand Public');
    await insertTache(
      db,
      id: 't-chues',
      campaignId: 'c-chues',
      prospectId: 'pro-chues',
      position: 1,
    );
    await insertTache(
      db,
      id: 't-gp',
      campaignId: 'c-gp',
      prospectId: 'pro-gp',
      position: 1,
    );

    await mount(tester);

    expect(
      find.bySemanticsLabel(
        'Étape 3. Convertir les prospects. 1 prospect à appeler.',
      ),
      findsOneWidget,
    );

    // Une seule file CHUES : on va droit à elle, pas à une liste où la file du
    // Grand Public ferait nombre.
    await tester.tap(find.text('Convertir les prospects'));
    await tester.pumpAndSettle();

    expect(find.text('FILE c-chues'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('l\'étape 2 mène au choix du représentant', (
    WidgetTester tester,
  ) async {
    await mount(tester);
    await tester.tap(find.text('Ajouter des prospects'));
    await tester.pumpAndSettle();

    expect(find.text('PICKER'), findsOneWidget);

    await unmount(tester);
  });

  // Sans file d'appel, la conversion reste possible : on consigne un appel
  // depuis un numéro.
  testWidgets('l\'étape 3 sans file mène à « Consigner un appel »', (
    WidgetTester tester,
  ) async {
    await mount(tester);
    await tester.tap(find.text('Convertir les prospects'));
    await tester.pumpAndSettle();

    expect(find.text('CONSIGNER'), findsOneWidget);

    await unmount(tester);
  });

  // Un zéro inventé fait croire que le travail est fini.
  testWidgets('un chiffre illisible affiche « – » et propose de réessayer', (
    WidgetTester tester,
  ) async {
    await mount(
      tester,
      extra: <Override>[
        representantsSansProspectProvider.overrideWith(
          (Ref ref) => Stream<int>.error(Exception('base illisible')),
        ),
      ],
    );

    expect(find.text('–'), findsOneWidget);
    expect(find.text('Les chiffres n\'ont pas pu être lus.'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);

    await unmount(tester);
  });

  // Le bouton du pied ne propose plus de créer un représentant : il ouvre les
  // deux gestes de départ, nommés.
  testWidgets('le pied propose qualifier ou ajouter un prospect', (
    WidgetTester tester,
  ) async {
    await mount(tester);

    expect(find.text('Commencer'), findsOneWidget);
    expect(find.text('Nouvelle fiche'), findsNothing);

    await tester.tap(find.text('Commencer'));
    await tester.pumpAndSettle();

    expect(find.text('Qualifier un représentant'), findsOneWidget);
    expect(find.text('Ajouter un prospect'), findsOneWidget);

    await tester.tap(find.text('Ajouter un prospect'));
    await tester.pumpAndSettle();

    expect(find.text('PICKER'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('le pied mène aussi à la qualification', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await seedFileRepresentants(
      campaignId: 'camp-rep',
      representantIds: <String>['rep-1'],
    );
    await mount(tester);

    await tester.tap(find.text('Commencer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Qualifier un représentant'));
    await tester.pumpAndSettle();

    expect(find.text('FILE REP camp-rep'), findsOneWidget);

    await unmount(tester);
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();

  @override
  void nudge() {}
}

class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'me',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
  );
}
