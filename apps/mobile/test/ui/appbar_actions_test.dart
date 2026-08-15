import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/notifications/presentation/notification_bell.dart';
import 'package:cpi_go/ui/widgets/sync_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Cibles tactiles de l'AppBar, et libellés de l'accueil.
///
/// L'application se tient debout, au soleil, souvent à une main : une cible de
/// 38 dp est en dessous du plancher de 44 dp que fixe docs/design.md §1, et la
/// `NotificationBell` juste à côté en faisait déjà 48.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
  });
  tearDown(() async => db.close());

  Future<Widget> host(Widget child) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(_SignedInController.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: child,
      ),
    );
  }

  Future<void> paint(WidgetTester tester, Widget app) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(app);
    for (int i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('le badge de synchronisation tient les 48 dp de la cloche', (
    WidgetTester tester,
  ) async {
    await paint(
      tester,
      await host(
        Scaffold(
          appBar: AppBar(
            title: const Text('Accueil'),
            actions: const <Widget>[NotificationBell(), SyncBadge()],
          ),
        ),
      ),
    );

    final Size badge = tester.getSize(find.byType(SyncBadge));
    final Size bell = tester.getSize(find.byType(NotificationBell));

    expect(
      badge.height,
      greaterThanOrEqualTo(48),
      reason: 'la cible faisait 38 dp, sous le plancher de docs/design.md §1',
    );
    expect(badge.width, greaterThanOrEqualTo(48));
    // Deux boutons voisins qui ne se touchent pas de la même façon sont un
    // piège : l'un rate, l'autre pas, et l'utilisateur ne comprend pas.
    expect(badge.height, bell.height);

    await unmount(tester);
  });

  testWidgets('l\'accueil NOMME ce que fait son bouton, et garde la création', (
    WidgetTester tester,
  ) async {
    // « Saisir des prospects » ouvrait « Choisir un représentant » : la
    // promesse et l'écran d'arrivée ne se ressemblaient pas, et l'utilisateur
    // croyait s'être trompé de bouton. La création, elle, ne doit pas se
    // retrouver à deux écrans de l'accueil : c'est le geste de la fiche qui
    // naît en tournée.
    await paint(tester, await host(const HomeScreen()));

    expect(find.text('Choisir un représentant'), findsOneWidget);
    expect(find.text('Nouveau représentant'), findsOneWidget);
    expect(find.text('Saisir des prospects'), findsNothing);

    await unmount(tester);
  });

  test('la recherche vaine emporte le terme tapé vers le formulaire', () {
    expect(Routes.newRepresentantPrefilled('Ousmane'), contains('nom=Ousmane'));
    expect(Routes.newRepresentantPrefilled('77 123 45 67'), contains('tel='));
    expect(Routes.newRepresentantPrefilled('  '), Routes.newRepresentant);
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'me',
    fullName: 'Awa Diop',
  );
}
