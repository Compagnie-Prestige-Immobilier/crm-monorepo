import 'dart:async';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Ce que `nudge()` doit à un téléconseiller qui enchaîne les saisies.
///
/// ## Le défaut redouté
///
/// Le 3 septembre, dix-neuf appels saisis entre 18:35 et 19:12 ne sont arrivés
/// au serveur qu'à 20:52, groupés : l'écran appelait la vidange après chaque
/// saisie, mais une vidange déjà en cours la faisait tomber sans trace. La
/// suivante dépendait alors du cycle de soixante secondes, ou du rattrapage
/// Android de quinze minutes. Le tableau de bord a affiché dix appels pendant
/// deux heures.
///
/// Le moteur est ici un double : ces tests portent sur la POLITIQUE de relance
/// du coordinateur, pas sur la vidange elle-même, couverte par
/// `sync_engine_test.dart`.
class _ScriptedEngine extends SyncEngine {
  _ScriptedEngine({
    required super.database,
    required super.api,
    required super.tokens,
    required super.clock,
  });

  /// Verdict imposé. À `null`, le moteur vide [queued] une opération par tour.
  SyncOutcome? outcome = const SyncOutcome.skipped('no_session');
  bool busy = false;
  int queued = 0;
  int pushes = 0;

  /// Retient l'envoi en vol le temps qu'une saisie arrive par-dessus.
  Completer<void>? gate;

  /// Sans ce plafond, un enchaînement fautif ne rougirait pas : il bloquerait
  /// l'isolat sur une file de micro-tâches qui se réalimente.
  static const int _plafond = 8;

  @override
  bool get isBusy => busy;

  @override
  Future<int> schedulableCount() async => queued;

  @override
  Future<SyncOutcome> runOnce({bool pull = true}) async {
    if (!pull) pushes++;
    final Completer<void>? held = gate;
    if (held != null) {
      gate = null;
      await held.future;
    }
    if (pushes > _plafond) {
      return const SyncOutcome.failed('BOUCLE', kind: FailureKind.terminal);
    }
    final SyncOutcome? forced = outcome;
    if (forced != null) return forced;
    final int sent = queued > 0 ? 1 : 0;
    queued -= sent;
    return SyncOutcome.ok(pushed: sent, pulled: 0);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    // Le cycle de vie est global au binding : un test qui a mis l'application
    // en veille laisserait le suivant démarrer avec un écouteur déjà endormi.
    lifecycle(<AppLifecycleState>[
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ]);
  });

  tearDown(() async => db.close());

  _ScriptedEngine buildEngine() => _ScriptedEngine(
    database: db,
    api: api,
    tokens: InMemoryTokenStore(refreshToken: 'jeton', userId: 'me'),
    clock: const SystemClock(),
  );

  ProviderContainer buildContainer(_ScriptedEngine engine) {
    return ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore(refreshToken: 'jeton', userId: 'me'),
        ),
        clockProvider.overrideWithValue(const SystemClock()),
        syncEngineProvider.overrideWithValue(engine),
        networkValidatedProvider.overrideWith((_) async => null),
        connectivityTriggerProvider.overrideWith((_) => const Stream.empty()),
      ],
    );
  }

  /// Le coordinateur, démarré, cycle d'amorçage consommé, compteur remis à zéro.
  ({SyncCoordinator sync, ProviderContainer container}) start(
    FakeAsync async,
    _ScriptedEngine engine,
  ) {
    final ProviderContainer container = buildContainer(engine);
    addTearDown(container.dispose);
    final SyncCoordinator sync = container.read(
      syncCoordinatorProvider.notifier,
    );
    async.flushMicrotasks();
    engine.pushes = 0;
    return (sync: sync, container: container);
  }

  test('une saisie pendant une vidange en cours part sans attendre 60 s', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.ok(pushed: 1, pulled: 0);
      engine.busy = true;

      app.sync.nudge();
      async.flushMicrotasks();
      expect(engine.pushes, 0, reason: 'le moteur occupé a refusé cet envoi');

      engine.busy = false;
      async.elapse(const Duration(seconds: 1));
      expect(
        engine.pushes,
        1,
        reason:
            'une demande tombée pendant une vidange attendait le cycle de 60 s',
      );

      app.container.dispose();
    });
  });

  test('une saisie arrivée pendant l\'envoi repart aussitôt après', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.ok(pushed: 1, pulled: 0);
      final Completer<void> enVol = Completer<void>();
      engine.gate = enVol;

      app.sync.nudge();
      async.flushMicrotasks();
      expect(engine.pushes, 1);

      app.sync.nudge();
      async.flushMicrotasks();
      expect(engine.pushes, 1, reason: 'pas deux envois de front');

      enVol.complete();
      async.flushMicrotasks();
      expect(
        engine.pushes,
        2,
        reason: 'la saisie arrivée pendant l\'envoi doit partir à sa suite',
      );

      app.container.dispose();
    });
  });

  test('un échec réseau relance à 1 s, 2 s puis 5 s', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.failed(
        'NETWORK',
        kind: FailureKind.unreachable,
      );

      app.sync.nudge();
      async.flushMicrotasks();
      expect(engine.pushes, 1);

      async.elapse(const Duration(milliseconds: 999));
      expect(engine.pushes, 1, reason: 'la première relance est à 1 s');
      async.elapse(const Duration(milliseconds: 1));
      expect(engine.pushes, 2);

      async.elapse(const Duration(seconds: 2));
      expect(engine.pushes, 3);

      async.elapse(const Duration(seconds: 5));
      expect(engine.pushes, 4);

      app.container.dispose();
    });
  });

  test('un refus définitif ne relance pas', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.failed(
        'REFUS',
        kind: FailureKind.terminal,
      );

      app.sync.nudge();
      async.flushMicrotasks();
      async.elapse(const Duration(seconds: 30));
      expect(
        engine.pushes,
        1,
        reason: 'rien ne changera d\'ici la relance suivante',
      );

      app.container.dispose();
    });
  });

  test('une session expirée ne relance pas', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.failed(
        'UNAUTHORIZED',
        kind: FailureKind.sessionExpired,
      );

      app.sync.nudge();
      async.flushMicrotasks();
      async.elapse(const Duration(seconds: 30));
      expect(
        engine.pushes,
        1,
        reason: 'relancer sans session ferait boucler l\'écran de connexion',
      );

      app.container.dispose();
    });
  });

  test('la mise en veille désarme la relance rapide', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.failed(
        'NETWORK',
        kind: FailureKind.unreachable,
      );

      app.sync.nudge();
      async.flushMicrotasks();
      expect(engine.pushes, 1);

      lifecycle(<AppLifecycleState>[
        AppLifecycleState.inactive,
        AppLifecycleState.hidden,
        AppLifecycleState.paused,
      ]);
      async.flushMicrotasks();

      expect(
        coordinatorTimers(async),
        isEmpty,
        reason: 'un minuteur armé en veille réveille le téléphone pour rien',
      );
      async.elapse(const Duration(seconds: 30));
      expect(engine.pushes, 1);

      app.container.dispose();
    });
  });

  test('la relance rapide ne survit pas à la fin du coordinateur', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = const SyncOutcome.failed(
        'NETWORK',
        kind: FailureKind.unreachable,
      );

      app.sync.nudge();
      async.flushMicrotasks();
      app.container.dispose();

      expect(coordinatorTimers(async), isEmpty);
      // Un minuteur orphelin lirait un fournisseur jeté : l'exception sort d'un
      // rappel que personne n'attrape et emporte l'application.
      async.elapse(const Duration(seconds: 30));
      expect(engine.pushes, 1);
    });
  });

  test('une vidange partielle enchaîne sur ce qui reste en file', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      engine.outcome = null;
      engine.queued = 3;

      app.sync.nudge();
      async.flushMicrotasks();
      expect(
        engine.pushes,
        3,
        reason: 'la file restante ne doit pas attendre le cycle suivant',
      );

      app.container.dispose();
    });
  });

  test('une vidange sans rien à pousser n\'enchaîne pas', () {
    fakeAsync((FakeAsync async) {
      final _ScriptedEngine engine = buildEngine();
      final ({SyncCoordinator sync, ProviderContainer container}) app = start(
        async,
        engine,
      );
      // Ce qui reste attend son `nextAttemptAt` : une saisie bloquée par sa
      // fiche parente patiente trente secondes, et rien ne la libère plus tôt.
      engine.outcome = const SyncOutcome.ok(pushed: 0, pulled: 0);
      engine.queued = 1;

      app.sync.nudge();
      async.flushMicrotasks();
      expect(
        engine.pushes,
        1,
        reason: 'enchaîner sur une file gelée boucle sans jamais rien envoyer',
      );

      app.container.dispose();
    });
  });
}

void lifecycle(List<AppLifecycleState> states) {
  for (final AppLifecycleState state in states) {
    TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(state);
  }
}

/// Les minuteurs armés PAR le coordinateur : un minuteur né ailleurs, comme la
/// péremption d'une preuve d'injoignabilité, cite aussi le coordinateur dans sa
/// trace de création puisque c'est lui qui l'a déclenchée.
final RegExp _armeParLeCoordinateur = RegExp(r'new Timer[^\n]*\n#\d+\s+Sync');

Iterable<FakeTimer> coordinatorTimers(FakeAsync async) => async.pendingTimers
    .where((FakeTimer t) => t.debugString.contains(_armeParLeCoordinateur));
