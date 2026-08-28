import 'package:cpi_go/core/onboarding/onboarding_controller.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/auth/presentation/login_screen.dart';
import 'package:cpi_go/features/onboarding/presentation/onboarding_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:forui/forui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/fake_api.dart';

/// Les deux écrans que l'application montre AVANT toute donnée : le sas de
/// premier lancement et la reprise de session. Ni l'un ni l'autre n'a de
/// deuxième chance : s'ils échouent en silence, le téléphone reste sur une
/// image fixe et le téléconseiller n'a rien à lire.

/// Un coffre chiffré illisible : Android rend un `PlatformException` quand le
/// trousseau a été invalidé (restauration d'appareil, changement de verrou).
class _UnreadableTokenStore implements TokenStore {
  @override
  String? get accessToken => null;

  @override
  Future<String?> readRefreshToken() async =>
      throw StateError('trousseau illisible');

  @override
  Future<String?> readUserId() async => null;

  @override
  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async => throw StateError('trousseau en panne');

  @override
  void setAccessToken(String accessToken) {}

  @override
  Future<void> clear() async {}
}

class _ReadOnlyPreferences implements SharedPreferences {
  @override
  bool? getBool(String key) => null;

  @override
  Future<bool> setBool(String key, bool value) async =>
      throw StateError('stockage en lecture seule');

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

void main() {
  test('un coffre illisible rend la main a l\'ecran de connexion', () async {
    // Sans rattrapage, l'exception part dans le vide depuis le microtask de
    // `build` : l'état reste `unknown` pour toujours et `app.dart` peint son
    // écran d'amorçage sans fin. Aucune console, aucun rapport de plantage sur
    // place : le téléphone a simplement l'air éteint.
    final ProviderContainer container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWithValue(_UnreadableTokenStore()),
      ],
    );
    addTearDown(container.dispose);

    expect(container.read(authControllerProvider).status, AuthStatus.unknown);
    await pumpEventQueue();

    final AuthState resolved = container.read(authControllerProvider);
    expect(resolved.status, AuthStatus.unauthenticated);
    expect(resolved.errorMessage, isNotNull);
  });

  test('un coffre en panne ne fige pas le bouton de connexion', () async {
    // `signIn` n'attrapait que `ApiException` : une panne du coffre chiffré
    // laissait `isSubmitting` à vrai définitivement, bouton grisé et roue qui
    // tourne, sans autre issue que de tuer l'application.
    final ProviderContainer container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWithValue(_UnreadableTokenStore()),
        apiPortProvider.overrideWithValue(FakeApi()),
      ],
    );
    addTearDown(container.dispose);

    final bool ok = await container
        .read(authControllerProvider.notifier)
        .signIn(identifier: 'awa', password: 'secret');

    expect(ok, isFalse);
    final AuthState state = container.read(authControllerProvider);
    expect(state.isSubmitting, isFalse);
    expect(state.errorMessage, isNotNull);
  });

  testWidgets('la case « Rester connecté » tient la cible tactile minimale', (
    WidgetTester tester,
  ) async {
    // 24 dp de case et 8 dp de marge : 40 dp de haut, sous le minimum du dépôt.
    // C'est la case que l'on rate en plein soleil, une main sur le guidon.
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const LoginScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('CPI GO'), findsOneWidget);
    expect(find.text('Connectez-vous pour commencer'), findsOneWidget);
    // La case est un `FCheckbox` depuis le passage à ForUI : c'est lui, et non
    // l'`InkWell` Material d'avant, qui porte la cible tactile.
    final Finder toggle = find
        .ancestor(
          of: find.text('Rester connecté sur cet appareil'),
          matching: find.byType(FCheckbox),
        )
        .first;
    expect(
      tester.getSize(toggle).height,
      greaterThanOrEqualTo(kCpiMinTouchTarget),
    );
  });

  testWidgets('un premier lancement qui ne s\'enregistre pas le DIT', (
    WidgetTester tester,
  ) async {
    // Le sas écrivait un drapeau dans les préférences sans attendre le
    // résultat : si l'écriture échoue, l'écran ne bouge pas et rien n'explique
    // pourquoi. Le doigt réappuie, indéfiniment. « Passer » a disparu : le sas
    // se termine par « Commencer », au bout des deux pages.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(_ReadOnlyPreferences()),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const OnboardingScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Commencer'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('n\'a pas pu garder ce réglage'),
      findsOneWidget,
    );
    // Et le sas s'ouvre quand même : un stockage en panne n'enferme personne.
    expect(
      ProviderScope.containerOf(
        tester.element(find.byType(OnboardingScreen)),
        listen: false,
      ).read(onboardingControllerProvider),
      isTrue,
    );
  });
}
