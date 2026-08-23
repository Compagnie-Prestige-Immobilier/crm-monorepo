import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/shell/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// `SyncUiState.lastError` portait le code d'échec classifié : lien mort,
/// serveur en 500, throttling, refus terminal. **Aucun écran ne le lisait.**
///
/// Concrètement, les quatre cas produisaient à l'écran exactement la même
/// phrase : « N en attente d'envoi ». Le commercial ne pouvait pas distinguer
/// « ça repartira tout seul » de « ouvrez le portail Wi-Fi » de « allez dans
/// À corriger ».
void main() {
  group('phrase d\'échec : la décision pure', () {
    test('la famille prime sur le code : elle porte le geste à faire', () {
      expect(const SyncUiState().failureLabel, isNull);
      expect(
        const SyncUiState(
          lastError: 'NETWORK',
          lastErrorKind: FailureKind.unreachable,
        ).failureLabel,
        contains('portail Wi-Fi'),
      );
      expect(
        const SyncUiState(
          lastError: 'RATE_LIMITED',
          lastErrorKind: FailureKind.throttled,
        ).failureLabel,
        contains('limite les envois'),
      );
      expect(
        const SyncUiState(
          lastError: 'VALIDATION_FAILED',
          lastErrorKind: FailureKind.terminal,
        ).failureLabel,
        contains('À corriger'),
      );
      expect(
        const SyncUiState(
          lastError: 'REFRESH_FAILED',
          lastErrorKind: FailureKind.sessionExpired,
        ).failureLabel,
        contains('Reconnectez-vous'),
      );
    });

    test('un code sans famille se rend tel quel plutôt que masqué', () {
      expect(
        const SyncUiState(lastError: 'MYSTERE').failureLabel,
        contains('MYSTERE'),
      );
    });

    test('un cycle réussi efface la phrase', () {
      const SyncUiState failed = SyncUiState(
        lastError: 'NETWORK',
        lastErrorKind: FailureKind.unreachable,
      );
      expect(failed.copyWith(clearError: true).failureLabel, isNull);
    });
  });

  group('la phrase arrive réellement à l\'écran', () {
    late AppDatabase db;

    setUp(() async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      db = await openTestDatabase();
    });
    tearDown(() async => db.close());

    /// Les cinq surcharges sont TOUTES nécessaires. `sharedPreferencesProvider`
    /// et `clockProvider` lèvent tant qu'ils ne sont pas fournis, et un provider
    /// qui lève pendant la construction de l'arbre fige le harnais de test au
    /// lieu de faire échouer le test : le `--timeout` de `flutter test` ne se
    /// déclenche même pas. C'est un piège coûteux, et c'est pour cela qu'il est
    /// écrit ici.
    Future<Widget> host(Widget child, SyncUiState sync) async {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      return ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(FakeApi()),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(() => _FrozenCoordinator(sync)),
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

    /// Quelques images fixes puis démontage : `pumpAndSettle` ne rend jamais la
    /// main, les écrans observant des flux drift qui se replanifient.
    Future<void> paint(WidgetTester tester, Widget app) async {
      await tester.pumpWidget(app);
      for (int i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    Future<void> unmount(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
    }

    testWidgets('le bandeau d\'attente dit POURQUOI la file ne descend pas', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');

      await paint(
        tester,
        await host(
          const Scaffold(bottomNavigationBar: PendingBanner()),
          const SyncUiState(
            lastError: 'SERVER_ERROR',
            lastErrorKind: FailureKind.retryable,
          ),
        ),
      );

      expect(
        find.textContaining('Le serveur a répondu en erreur'),
        findsOneWidget,
        reason:
            'sans consommateur, l\'écran se contentait de « 1 élément en '
            'attente d\'envoi », identique à un réseau sain',
      );
      await unmount(tester);
    });

    testWidgets('sans échec, le bandeau garde son message neutre', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');

      await paint(
        tester,
        await host(
          const Scaffold(bottomNavigationBar: PendingBanner()),
          const SyncUiState(),
        ),
      );

      expect(find.textContaining('en attente d\'envoi'), findsOneWidget);
      expect(find.textContaining('Le serveur a répondu'), findsNothing);
      await unmount(tester);
    });

    testWidgets('« À corriger » explique l\'échec du dernier cycle', (
      WidgetTester tester,
    ) async {
      await paint(
        tester,
        await host(
          const CorrectionsScreen(),
          const SyncUiState(
            lastError: 'NETWORK',
            lastErrorKind: FailureKind.unreachable,
          ),
        ),
      );

      expect(find.textContaining('portail Wi-Fi'), findsWidgets);
      await unmount(tester);
    });

    testWidgets('rien ne s\'affiche quand le dernier cycle est passé', (
      WidgetTester tester,
    ) async {
      await paint(
        tester,
        await host(const CorrectionsScreen(), const SyncUiState()),
      );

      expect(find.textContaining('portail Wi-Fi'), findsNothing);
      await unmount(tester);
    });
  });
}

/// Un coordinateur figé : le test décrit un ÉTAT, il n'exécute pas de cycle.
class _FrozenCoordinator extends SyncCoordinator {
  _FrozenCoordinator(this._state);

  final SyncUiState _state;

  @override
  SyncUiState build() => _state;
}
