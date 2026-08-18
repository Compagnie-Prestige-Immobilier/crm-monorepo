import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/representant/presentation/representant_detail_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_form_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_picker_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// La fiche d'un représentant, et les deux chemins qui y mènent.
///
/// `Routes.representantDetail` et `representantDetailFor` existaient sans
/// appelant ni `GoRoute` : la route était nommée et n'existait pas. Un test qui
/// se contenterait de construire l'écran à la main ne l'aurait jamais vu, d'où
/// le montage du VRAI routeur ici.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    SinglePush.reset();
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  /// Démonte l'arbre avant la fin : les `StreamProvider` de drift programment
  /// un minuteur de durée nulle à leur disposition.
  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  Future<ProviderContainer> makeContainer(WidgetTester tester) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(_SignedInController.new),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('la route existe', () {
    Future<GoRouter> mountApp(WidgetTester tester) async {
      final ProviderContainer container = await makeContainer(tester);
      final GoRouter router = container.read(routerProvider);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
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
      return router;
    }

    testWidgets('/representants/<id> ouvre la fiche', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );

      final GoRouter router = await mountApp(tester);
      router.push(Routes.representantDetailFor('rep-1'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.byType(RepresentantDetailScreen), findsOneWidget);
      expect(find.text('Page introuvable'), findsNothing);
      expect(find.text('Ousmane Fall'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('/representants/nouveau reste le formulaire', (
      WidgetTester tester,
    ) async {
      // `:id` avalerait `nouveau` si la route de détail était déclarée avant :
      // créer un représentant ouvrirait une fiche vide au lieu du formulaire.
      final GoRouter router = await mountApp(tester);
      router.push(Routes.newRepresentant);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.byType(RepresentantFormScreen), findsOneWidget);
      expect(find.byType(RepresentantDetailScreen), findsNothing);

      await teardownTree(tester);
    });
  });

  testWidgets('la fiche liste les prospects de CE représentant', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await insertRepresentant(db, id: 'rep-2', phone: '+221770000002');
    await insertProspect(
      db,
      id: 'pro-1',
      representantId: 'rep-1',
      phone: '+221780000001',
    );
    await insertProspect(
      db,
      id: 'pro-2',
      representantId: 'rep-2',
      phone: '+221780000002',
    );

    final ProviderContainer container = await makeContainer(tester);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const RepresentantDetailScreen(representantId: 'rep-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.textContaining('+221 78 000 00 01'), findsOneWidget);
    expect(find.textContaining('+221 78 000 00 02'), findsNothing);
    expect(
      find.text('Aucun prospect. Utilisez « Nouveau prospect » pour en saisir un.'),
      findsNothing,
    );

    await teardownTree(tester);
  });

  group('sélecteur', () {
    Future<void> mountPicker(WidgetTester tester) async {
      final ProviderContainer container = await makeContainer(tester);
      final GoRouter router = GoRouter(
        initialLocation: Routes.representants,
        routes: <RouteBase>[
          GoRoute(
            path: Routes.representants,
            builder: (BuildContext context, GoRouterState state) =>
                const RepresentantPickerScreen(),
          ),
          GoRoute(
            path: Routes.newProspect,
            builder: (BuildContext context, GoRouterState state) => Scaffold(
              body: Center(
                child: Text(
                  'SAISIE PROSPECT ${state.uri.queryParameters[Routes.repParam]}',
                ),
              ),
            ),
          ),
          GoRoute(
            path: Routes.representantDetail,
            builder: (BuildContext context, GoRouterState state) => Scaffold(
              body: Center(child: Text('FICHE ${state.pathParameters['id']}')),
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
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

    testWidgets('le chemin rapide reste le tap sur la ligne', (
      WidgetTester tester,
    ) async {
      // Les téléconseillers enchaînent les saisies depuis cette liste : un tap
      // qui n'ouvre plus le formulaire de prospect leur coûte un geste par
      // fiche.
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await mountPicker(tester);

      await tester.tap(find.text('Ousmane Fall'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('SAISIE PROSPECT rep-1'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un bouton distinct ouvre la fiche', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await mountPicker(tester);

      await tester.tap(find.byTooltip('Ouvrir la fiche'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('FICHE rep-1'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un appui long ouvre la fiche aussi', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await mountPicker(tester);

      await tester.longPress(find.text('Ousmane Fall'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('FICHE rep-1'), findsOneWidget);

      await teardownTree(tester);
    });
  });
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

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
