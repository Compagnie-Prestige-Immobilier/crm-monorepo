import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/accueil/presentation/chiffres_screen.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/contacts/presentation/mes_contacts_screen.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:cpi_go/features/shell/grand_public_fiches_screen.dart';
import 'package:cpi_go/features/shell/grand_public_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Chaque projet a sa coque à onglets, et « Réglages » est dans chacune.
///
/// Sans elle, un compte d'accueil était pris au piège : `/accueil` était une
/// page pleine, sans barre du bas, donc sans aucun chemin vers la
/// déconnexion : il fallait passer par le projet CHUES, auquel ce compte n'a
/// même pas accès.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    SinglePush.reset();
  });

  tearDown(() => db.close());

  Future<GoRouter> open(WidgetTester tester, String role, String at) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    late GoRouter router;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_Idle.new),
          authControllerProvider.overrideWith(() => _SignedIn(role)),
        ],
        child: Consumer(
          builder: (BuildContext context, WidgetRef ref, Widget? child) {
            router = ref.watch(routerProvider);
            return MaterialApp.router(
              theme: AppTheme.light,
              locale: const Locale('fr'),
              localizationsDelegates: GlobalMaterialLocalizations.delegates,
              supportedLocales: const <Locale>[Locale('fr')],
              routerConfig: router,
            );
          },
        ),
      ),
    );
    await settle(tester);
    router.go(at);
    await settle(tester);
    return router;
  }

  /// `finally` et non une suite d'instructions : sans lui, une assertion qui
  /// échoue saute le démontage, le minuteur de drift reste en vol, et le test
  /// se bloque dix minutes avant d'être tué. Le message d'échec se perd alors
  /// dans le bruit de la finalisation.
  void coqueTestWidgets(String description, WidgetTesterCallback body) {
    testWidgets(description, (WidgetTester tester) async {
      try {
        await body(tester);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
      }
    });
  }

  /// L'onglet, et pas l'écran : « À corriger » et « Chiffres » sont aussi des
  /// titres d'écran, et un `find.text` nu en trouve deux.
  Future<void> onglet(WidgetTester tester, String label) async {
    await tester.tap(
      find.descendant(
        of: find.byType(CpiBottomNav),
        matching: find.text(label),
      ),
    );
    await settle(tester);
  }

  coqueTestWidgets('l\'accueil a Registre, Chiffres, À corriger et Réglages', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ACCUEIL', Routes.accueil);

    expect(find.byType(RegistreScreen), findsOneWidget);
    for (final String label in <String>[
      'Registre',
      'Chiffres',
      'À corriger',
      'Réglages',
    ]) {
      expect(find.text(label), findsWidgets, reason: '$label manque');
    }

    await onglet(tester, 'Chiffres');
    expect(find.byType(ChiffresScreen), findsOneWidget);

    // Réglages porte la déconnexion : sans cet onglet, le compte d'accueil
    // n'avait aucun chemin pour sortir de l'application.
    await onglet(tester, 'Réglages');
    expect(find.byType(ReglagesScreen), findsOneWidget);

    await onglet(tester, 'À corriger');
    expect(find.byType(CorrectionsScreen), findsOneWidget);
  });

  coqueTestWidgets(
    'le Grand Public a Accueil, Fiches, Contacts et Réglages',
    (WidgetTester tester) async {
      await open(tester, 'COMMERCIAL', Routes.grandPublic);

      expect(find.byType(GrandPublicScreen), findsOneWidget);

      await onglet(tester, 'Fiches');
      expect(find.byType(GrandPublicFichesScreen), findsOneWidget);

      await onglet(tester, 'Contacts');
      expect(find.byType(MesContactsScreen), findsOneWidget);

      await onglet(tester, 'Réglages');
      expect(find.byType(ReglagesScreen), findsOneWidget);

      // « À corriger » a quitté le pied : il se pousse depuis les réglages.
      await tester.tap(
        find.descendant(
          of: find.byType(ReglagesScreen),
          matching: find.text('À corriger'),
        ),
      );
      await settle(tester);
      expect(find.byType(CorrectionsScreen), findsOneWidget);
    },
  );

  coqueTestWidgets(
    'la coque garde le projet : Réglages du Grand Public y reste',
    (WidgetTester tester) async {
      final GoRouter router = await open(
        tester,
        'COMMERCIAL',
        Routes.grandPublic,
      );

      await onglet(tester, 'Réglages');

      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        Routes.grandPublicReglages,
        reason: 'un onglet ne doit pas faire changer de projet',
      );
    },
  );

  coqueTestWidgets('l\'onglet À corriger porte le nombre de saisies bloquées', (
    WidgetTester tester,
  ) async {
    await queueOp(
      db,
      id: 'op-1',
      entityType: 'prospect',
      entityId: 'p-1',
      status: 'failed',
    );
    await open(tester, 'COMMERCIAL', Routes.grandPublic);

    // Dans la barre du bas : la bande d'état du corps dit la même chose, et
    // c'est la pastille de l'onglet qui se vérifie ici.
    expect(
      find.descendant(
        of: find.byType(CpiBottomNav),
        matching: find.bySemanticsLabel(RegExp('1 saisie à corriger')),
      ),
      findsOneWidget,
    );
  });
}

Future<void> settle(WidgetTester tester) async {
  for (int i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

class _Idle extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _SignedIn extends AuthController {
  _SignedIn(this.role);

  final String role;

  @override
  AuthState build() => AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: role,
    email: 'awa.sy@cpi.sn',
  );
}
