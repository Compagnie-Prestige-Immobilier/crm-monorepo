import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Session ouverte sans passer par le coffre chiffré. `COMMERCIAL` : la tuile
/// « Registre de l'accueil » reste fermée, donc aucun `go_router` requis ici.
class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'me',
    fullName: 'Awa Diop',
    role: 'COMMERCIAL',
  );
}

/// Observé par les compteurs d'envoi de l'écran : sans arrêt, ses cinq
/// déclencheurs (dont un minuteur) ne se stabilisent jamais en test.
class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

Finder champ(String label) => find.descendant(
  of: find.ancestor(of: find.text(label), matching: find.byType(FTextField)),
  matching: find.byType(TextField),
);

Finder bouton(String label) =>
    find.byWidgetPredicate((Widget w) => w is CpiButton && w.label == label);

/// `testWidgets`, plus le démontage explicite de l'arbre à la fin.
///
/// Sans lui, chaque test échoue sur « A Timer is still pending even after the
/// widget tree was disposed » : le `StreamProvider` de drift derrière l'écran
/// programme un minuteur de durée nulle à sa fermeture, que le binding ne voit
/// qu'APRÈS le dernier `pump`.
void motDePasseTestWidgets(String description, WidgetTesterCallback body) {
  testWidgets(description, (WidgetTester tester) async {
    await body(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  });
}

void main() {
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  Future<void> poser(WidgetTester tester) async {
    final db = await openTestDatabase();
    addTearDown(db.close);
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    api = FakeApi();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          apiPortProvider.overrideWithValue(api),
          authControllerProvider.overrideWith(_SignedInController.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const ReglagesScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Changer le mot de passe'));
    await tester.pumpAndSettle();
  }

  Future<void> remplir(
    WidgetTester tester, {
    String actuel = 'ancienMotDePasse',
    String nouveau = 'nouveauMotDePasse1',
    String confirmation = 'nouveauMotDePasse1',
  }) async {
    await tester.enterText(champ('Mot de passe actuel'), actuel);
    await tester.enterText(champ('Nouveau mot de passe'), nouveau);
    await tester.enterText(
      champ('Confirmer le nouveau mot de passe'),
      confirmation,
    );
  }

  motDePasseTestWidgets('succès : appelle la route avec les bonnes valeurs, ferme et '
      'confirme', (WidgetTester tester) async {
    await poser(tester);
    await remplir(tester, nouveau: 'motDePasseNeuf1', confirmation: 'motDePasseNeuf1');

    await tester.tap(bouton('Changer le mot de passe'));
    await tester.pumpAndSettle();

    expect(api.changePasswordCalls, hasLength(1));
    expect(api.changePasswordCalls.single.currentPassword, 'ancienMotDePasse');
    expect(api.changePasswordCalls.single.newPassword, 'motDePasseNeuf1');
    expect(find.text('Mot de passe changé.'), findsOneWidget);
    // La feuille s'est refermée : ses champs ont disparu.
    expect(find.text('Nouveau mot de passe'), findsNothing);
  });

  motDePasseTestWidgets('mot de passe actuel refusé : message ciblé sous SON champ', (
    WidgetTester tester,
  ) async {
    await poser(tester);
    await remplir(tester);
    api.failNextChangePassword = const ApiException(
      invalidCurrentPasswordCode,
      message: 'Mot de passe actuel incorrect.',
      statusCode: 401,
      kind: FailureKind.terminal,
    );

    await tester.tap(bouton('Changer le mot de passe'));
    await tester.pumpAndSettle();

    expect(
      find.text('Le mot de passe actuel est incorrect.'),
      findsOneWidget,
    );
    // La feuille reste ouverte : l'utilisateur corrige sans tout retaper.
    expect(find.text('Nouveau mot de passe'), findsOneWidget);
  });

  motDePasseTestWidgets('nouveau trop court bloque l\'envoi, sans appel réseau', (
    WidgetTester tester,
  ) async {
    await poser(tester);
    await remplir(tester, nouveau: 'court1', confirmation: 'court1');

    await tester.tap(bouton('Changer le mot de passe'));
    await tester.pumpAndSettle();

    expect(api.changePasswordCalls, isEmpty);
    expect(find.text('Entre 8 et 24 caractères.'), findsOneWidget);
  });

  motDePasseTestWidgets('confirmation différente bloque l\'envoi, sans appel réseau', (
    WidgetTester tester,
  ) async {
    await poser(tester);
    await remplir(
      tester,
      nouveau: 'motDePasseNeuf1',
      confirmation: 'autreChose1',
    );

    await tester.tap(bouton('Changer le mot de passe'));
    await tester.pumpAndSettle();

    expect(api.changePasswordCalls, isEmpty);
    expect(find.text('La confirmation ne correspond pas.'), findsOneWidget);
  });
}
