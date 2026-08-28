import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/shell/hub_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Où atterrit un compte qui vient de se connecter.
///
/// Le hub est un choix : il ne se pose que s'il y a quelque chose à choisir. Un
/// compte d'accueil n'ouvre que le registre ; lui demander de toucher une tuile
/// unique avant de commencer sa journée, c'est un geste pour rien.
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

  Future<void> open(WidgetTester tester, String role) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(() => _SignedIn(role)),
        ],
        child: Consumer(
          builder: (BuildContext context, WidgetRef ref, Widget? child) =>
              MaterialApp.router(
                theme: AppTheme.light,
                locale: const Locale('fr'),
                localizationsDelegates: GlobalMaterialLocalizations.delegates,
                supportedLocales: const <Locale>[Locale('fr')],
                routerConfig: ref.watch(routerProvider),
              ),
        ),
      ),
    );
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('un compte d\'accueil arrive sur son registre', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ACCUEIL');

    expect(find.byType(RegistreScreen), findsOneWidget);
    expect(find.byType(HubScreen), findsNothing);

    await unmount(tester);
  });

  testWidgets('le téléconseiller choisit entre ses deux projets', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('l\'administration choisit entre les trois', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ADMIN');

    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
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
