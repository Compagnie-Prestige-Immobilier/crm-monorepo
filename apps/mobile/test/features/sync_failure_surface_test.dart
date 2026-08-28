import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/shell/app_shell.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
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
          // La bande d'état vit désormais en HAUT du corps : le pied est à la
          // navigation et à une seule barre d'action.
          const Scaffold(body: PendingBanner()),
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
            'sans consommateur, l\'écran se contentait de « 1 fiche pas '
            'encore envoyée », identique à un réseau sain',
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
          // La bande d'état vit désormais en HAUT du corps : le pied est à la
          // navigation et à une seule barre d'action.
          const Scaffold(body: PendingBanner()),
          const SyncUiState(),
        ),
      );

      expect(find.textContaining('pas encore envoyée'), findsOneWidget);
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

    // Le serveur refuse l'opération avec un code et une phrase rédigée pour un
    // journal. Sur le terrain, seule compte la retouche à faire.
    testWidgets('« À corriger » traduit les refus de la phase 3', (
      WidgetTester tester,
    ) async {
      await queueOp(
        db,
        id: 'A1',
        entityType: callAttemptEntity,
        entityId: 'attempt-1',
        status: OutboxStatus.failed,
      );
      await db.customStatement(
        'UPDATE outbox SET last_error_code = ?, last_error_msg = ? '
        'WHERE id = ?',
        <Object?>[
          'PHASE2_RENDEZ_VOUS_REQUIRED',
          'rendezVousAt is required when method is APPOINTMENT',
          'A1',
        ],
      );

      await paint(
        tester,
        await host(const CorrectionsScreen(), const SyncUiState()),
      );

      expect(find.textContaining('aucune date n\'a été enregistrée'), findsOne);
      expect(find.textContaining('rendezVousAt is required'), findsNothing);
      await unmount(tester);
    });

    // Une entrée de liste que le serveur ne connaît plus : réessayer avec le
    // même identifiant ne peut rien donner, la carte propose de rechoisir.
    testWidgets('« À corriger » renvoie une entrée morte vers la correction', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        reference: null,
        date: '2026-08-12',
        time: '09:12',
        visitorName: 'Awa Ndiaye',
      );
      await queueOp(
        db,
        id: 'A1',
        entityType: 'visite',
        entityId: 'v1',
        status: OutboxStatus.failed,
        payload: <String, Object?>{'visitorName': 'Awa Ndiaye'},
      );
      await db.customStatement(
        'UPDATE outbox SET last_error_code = ?, last_error_msg = ? '
        'WHERE id = ?',
        <Object?>[
          ServerErrorCodes.visiteReferentielUnavailable,
          'L\'entrée choisie pour « entreprise » n\'est plus proposée.',
          'A1',
        ],
      );

      await paint(
        tester,
        await host(const CorrectionsScreen(), const SyncUiState()),
      );

      expect(
        find.textContaining(
          'Cette entrée n\'existe plus dans les listes de l\'accueil.',
        ),
        findsOne,
      );
      expect(
        find.widgetWithText(CpiButton, 'Réessayer'),
        findsNothing,
        reason: 'renvoyer le même identifiant mort ne peut rien donner',
      );
      expect(find.widgetWithText(CpiButton, 'Modifier'), findsOne);

      await tester.tap(find.widgetWithText(CpiButton, 'Modifier'));
      for (int i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      expect(find.text('Corriger la visite'), findsOne);
      expect(
        find.byKey(const ValueKey<String>('champ-entreprise')),
        findsOne,
        reason: 'la société se rechoisit dans la liste du jour',
      );

      await unmount(tester);
    });
  });

  /// Android ne valide jamais le lien data de l'émulateur, et il valide le
  /// Wi-Fi 4 à 16 s APRÈS l'événement d'interface : son « non » ne peut donc
  /// plus allumer de bandeau. Ce qu'il déclenche, c'est un cycle de
  /// vérification — seule notre propre requête sait si l'API répond.
  group('le soupçon du système se vérifie par notre trafic', () {
    Future<int> cyclesAvecVerdict(WidgetTester tester, bool? verdict) async {
      final _CountingCoordinator coordinateur = _CountingCoordinator();
      final ProviderContainer container = ProviderContainer(
        overrides: [
          connectivitySourceProvider.overrideWithValue(
            _FakeConnectivity(const Stream<List<ConnectivityResult>>.empty()),
          ),
          networkValidationProvider.overrideWithValue(_FakeValidation(verdict)),
          syncCoordinatorProvider.overrideWith(() => coordinateur),
        ],
      );
      container.listen(syncCoordinatorProvider, (Object? _, Object? _) {});
      await tester.pump(const Duration(milliseconds: 50));
      container.dispose();
      return coordinateur.cycles;
    }

    testWidgets('un verdict « non » déclenche un cycle', (
      WidgetTester tester,
    ) async {
      expect(
        await cyclesAvecVerdict(tester, false),
        greaterThan(1),
        reason: 'un seul cycle : celui du démarrage, le verdict n\'a rien dit',
      );
    });

    testWidgets('un verdict positif n\'en déclenche aucun de plus', (
      WidgetTester tester,
    ) async {
      expect(await cyclesAvecVerdict(tester, true), 1);
    });
  });

  /// `connectivityProvider` se calcule à partir de trois autres providers. Tant
  /// que la bande vivait dans `AppShell`, il gardait un auditeur en permanence.
  /// Depuis qu'elle est passée dans `CpiScaffold.banner`, il n'en a plus dès
  /// qu'on quitte l'accueil : il se périme, et le premier `ref.watch` de la
  /// bande suivante rejoue toute la cascade PENDANT son `build`. Riverpod 3.3
  /// répond alors par un `markNeedsBuild` sur `UncontrolledProviderScope` en
  /// pleine phase de construction.
  group('la bande ne recalcule pas des providers pendant son build', () {
    late AppDatabase db;

    setUp(() async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      db = await openTestDatabase();
    });
    tearDown(() async => db.close());

    testWidgets('réseau changé hors écran, puis retour sur la bande', (
      WidgetTester tester,
    ) async {
      final StreamController<List<ConnectivityResult>> reseau =
          StreamController<List<ConnectivityResult>>.broadcast();
      addTearDown(reseau.close);
      final _FakeConnectivity network = _FakeConnectivity(reseau.stream);
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final _FakeValidation validation = _FakeValidation(true);
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await queueOp(db, id: 'A1', entityType: 'representant', entityId: 'repA');

      final ValueNotifier<bool> surAccueil = ValueNotifier<bool>(true);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            apiPortProvider.overrideWithValue(FakeApi()),
            clockProvider.overrideWithValue(FakeClock(t0)),
            sharedPreferencesProvider.overrideWithValue(prefs),
            connectivitySourceProvider.overrideWithValue(network),
            networkValidationProvider.overrideWithValue(validation),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: _RacineQuiTientLeCoordinateur(surAccueil: surAccueil),
          ),
        ),
      );
      for (int i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(tester.takeException(), isNull, reason: 'premier rendu');

      surAccueil.value = false;
      for (int i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(tester.takeException(), isNull, reason: 'bande démontée');

      reseau.add(const <ConnectivityResult>[ConnectivityResult.none]);
      validation.value = false;
      await queueOp(db, id: 'A2', entityType: 'representant', entityId: 'repA');
      for (int i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 300));
      }
      expect(tester.takeException(), isNull, reason: 'changements hors écran');

      surAccueil.value = true;
      await tester.pump();
      expect(tester.takeException(), isNull, reason: 'retour sur la bande');
      for (int i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 50));
        expect(tester.takeException(), isNull, reason: 'image $i après retour');
      }

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
    });
  });
}

/// Comme `CpiGoApp` : la racine tient le coordinateur, donc le flux réseau
/// continue d'émettre même quand aucune bande n'est montée.
class _RacineQuiTientLeCoordinateur extends ConsumerWidget {
  const _RacineQuiTientLeCoordinateur({required this.surAccueil});

  final ValueNotifier<bool> surAccueil;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(syncCoordinatorProvider.notifier);
    return Scaffold(
      body: ValueListenableBuilder<bool>(
        valueListenable: surAccueil,
        builder: (BuildContext context, bool accueil, Widget? _) =>
            accueil ? const PendingBanner() : const Text('autre onglet'),
      ),
    );
  }
}

class _FakeConnectivity implements ConnectivitySource {
  _FakeConnectivity(this._changes);

  final Stream<List<ConnectivityResult>> _changes;

  @override
  Future<List<ConnectivityResult>> current() async =>
      const <ConnectivityResult>[ConnectivityResult.wifi];

  @override
  Stream<List<ConnectivityResult>> changes() => _changes;
}

class _FakeValidation implements NetworkValidation {
  _FakeValidation(this.value);

  bool? value;

  @override
  Future<bool?> isValidated() async => value;
}

/// Compte les cycles demandés sans en exécuter aucun.
class _CountingCoordinator extends SyncCoordinator {
  int cycles = 0;

  @override
  Future<SyncOutcome> run({bool pull = true}) async {
    cycles++;
    return const SyncOutcome.skipped('test');
  }
}

/// Un coordinateur figé : le test décrit un ÉTAT, il n'exécute pas de cycle.
class _FrozenCoordinator extends SyncCoordinator {
  _FrozenCoordinator(this._state);

  final SyncUiState _state;

  @override
  SyncUiState build() => _state;
}
