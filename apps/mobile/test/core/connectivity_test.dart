import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';

/// État réseau exposé à l'interface.
///
/// Deux défauts que ces tests interdisent :
///
///  1. le `try` entourait le `yield*` : une erreur du canal plateforme émettait
///     « en ligne » ET TERMINAIT le générateur. L'indicateur affirmait ensuite
///     « en ligne » pour le reste de la session, quoi qu'il arrive ;
///  2. toute interface autre que `none` valait « en ligne » : sur un portail
///     captif ou une SIM sans crédit, l'écran affichait exactement la même chose
///     qu'en fonctionnement normal, c'est-à-dire rien.
void main() {
  ProviderContainer containerWith(ConnectivitySource source) {
    final ProviderContainer container = ProviderContainer(
      overrides: [connectivitySourceProvider.overrideWithValue(source)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('flux d\'interface', () {
    test('une erreur du canal ne termine pas le flux', () async {
      final StreamController<List<ConnectivityResult>> events =
          StreamController<List<ConnectivityResult>>();
      addTearDown(events.close);

      final ProviderContainer container = containerWith(
        _FakeSource(
          initial: <ConnectivityResult>[ConnectivityResult.wifi],
          changes: events.stream,
        ),
      );
      final List<CpiConnectivity> seen = <CpiConnectivity>[];
      container.listen<AsyncValue<CpiConnectivity>>(
        connectivityInterfaceProvider,
        (AsyncValue<CpiConnectivity>? _, AsyncValue<CpiConnectivity> next) {
          final CpiConnectivity? value = next.value;
          if (value != null) seen.add(value);
        },
        fireImmediately: true,
      );
      await pumpEventQueue();

      // Le canal hoquette : c'est le moment où l'ancien code se taisait pour de
      // bon.
      events.addError(StateError('canal plateforme indisponible'));
      await pumpEventQueue();

      // Puis le réseau tombe VRAIMENT.
      events.add(<ConnectivityResult>[ConnectivityResult.none]);
      await pumpEventQueue();

      expect(
        seen.last,
        CpiConnectivity.offline,
        reason: 'un hoquet du canal ne doit pas geler l\'indicateur',
      );
    });
  });

  group('une seule source pour toute l\'application', () {
    test('trois observateurs n\'ouvrent qu\'un abonnement plateforme', () async {
      final _CountingSource source = _CountingSource();
      final ProviderContainer container = containerWith(source);

      container.listen(
        connectivityInterfaceProvider,
        (Object? _, Object? _) {},
      );
      container.listen(connectivityTriggerProvider, (Object? _, Object? _) {});
      container.listen(connectivityResultsProvider, (Object? _, Object? _) {});
      await pumpEventQueue();

      expect(
        source.subscriptions,
        1,
        reason:
            'chaque abonnement est un NetworkCallback Android de plus, réveillé '
            'à chaque bascule d\'antenne',
      );
    });

    test(
      'le premier état n\'est pas un changement : rien ne se déclenche',
      () async {
        final StreamController<List<ConnectivityResult>> events =
            StreamController<List<ConnectivityResult>>.broadcast();
        addTearDown(events.close);
        final ProviderContainer container = containerWith(
          _FakeSource(
            initial: <ConnectivityResult>[ConnectivityResult.wifi],
            changes: events.stream,
          ),
        );

        final List<List<ConnectivityResult>> triggers =
            <List<ConnectivityResult>>[];
        container.listen<AsyncValue<List<ConnectivityResult>>>(
          connectivityTriggerProvider,
          (
            AsyncValue<List<ConnectivityResult>>? _,
            AsyncValue<List<ConnectivityResult>> next,
          ) {
            final List<ConnectivityResult>? value = next.value;
            if (value != null) triggers.add(value);
          },
          fireImmediately: true,
        );
        await pumpEventQueue();

        expect(
          triggers,
          isEmpty,
          reason:
              'sinon un cycle complet part à chaque construction de provider',
        );
      },
    );

    test('une rafale de bascules ne produit qu\'un déclenchement', () async {
      fakeAsync((FakeAsync async) {
        final StreamController<List<ConnectivityResult>> events =
            StreamController<List<ConnectivityResult>>.broadcast();
        final ProviderContainer container = ProviderContainer(
          overrides: [
            connectivitySourceProvider.overrideWithValue(
              _FakeSource(
                initial: <ConnectivityResult>[ConnectivityResult.wifi],
                changes: events.stream,
              ),
            ),
          ],
        );

        final List<List<ConnectivityResult>> triggers =
            <List<ConnectivityResult>>[];
        container.listen<AsyncValue<List<ConnectivityResult>>>(
          connectivityTriggerProvider,
          (
            AsyncValue<List<ConnectivityResult>>? _,
            AsyncValue<List<ConnectivityResult>> next,
          ) {
            final List<ConnectivityResult>? value = next.value;
            if (value != null) triggers.add(value);
          },
        );
        async.flushMicrotasks();

        // Un basculement Wi-Fi → mobile émet trois ou quatre événements en moins
        // d'une seconde. Chacun déclenchait sa propre vidange.
        events.add(<ConnectivityResult>[ConnectivityResult.none]);
        async.flushMicrotasks();
        events.add(<ConnectivityResult>[ConnectivityResult.mobile]);
        async.flushMicrotasks();
        events.add(<ConnectivityResult>[
          ConnectivityResult.mobile,
          ConnectivityResult.vpn,
        ]);
        async.flushMicrotasks();

        expect(
          triggers,
          isEmpty,
          reason: 'rien avant la fin de l\'anti-rebond',
        );
        async.elapse(kConnectivityDebounce * 2);
        expect(triggers, hasLength(1));
        expect(triggers.single, <ConnectivityResult>[
          ConnectivityResult.mobile,
          ConnectivityResult.vpn,
        ]);

        container.dispose();
        unawaited(events.close());
      });
    });
  });

  group('verdict de validation du système', () {
    ProviderContainer withValidation(bool? validated) {
      final ProviderContainer container = ProviderContainer(
        overrides: [
          connectivitySourceProvider.overrideWithValue(
            _FakeSource(
              initial: <ConnectivityResult>[ConnectivityResult.wifi],
              changes: const Stream<List<ConnectivityResult>>.empty(),
            ),
          ),
          networkValidationProvider.overrideWithValue(
            _FakeValidation(validated),
          ),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    /// Mesuré sur emulator-5554 : le Wi-Fi devient le réseau par défaut à t+8 s
    /// et n'est validé qu'à t+12 s (t+15,8 s au démarrage) ; le lien data, lui,
    /// route vers l'API sans jamais recevoir `NET_CAPABILITY_VALIDATED`. Un
    /// « non » du système est donc soit un « pas encore », soit une erreur : il
    /// ne coupe pas la connexion à quelqu'un qui pouvait travailler.
    test('un verdict « non » n\'allume aucune bande à lui seul', () async {
      final ProviderContainer container = withValidation(false);
      container.listen(
        connectivityInterfaceProvider,
        (Object? _, Object? _) {},
      );
      container.listen(networkValidatedProvider, (Object? _, Object? _) {});
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    /// Démarrage à froid sur l'écran de connexion : lui seul écoute le verdict,
    /// et il refuse le bouton tant qu'il n'est pas « en ligne ».
    test('démarrage à froid : aucune bande sur l\'écran de connexion', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer container = ProviderContainer(
          overrides: [
            connectivitySourceProvider.overrideWithValue(
              _FakeSource(
                initial: <ConnectivityResult>[ConnectivityResult.wifi],
                changes: const Stream<List<ConnectivityResult>>.empty(),
              ),
            ),
            networkValidationProvider.overrideWithValue(
              const _FakeValidation(false),
            ),
          ],
        );
        final List<CpiConnectivity> seen = <CpiConnectivity>[];
        container.listen<CpiConnectivity>(
          connectivityProvider,
          (CpiConnectivity? _, CpiConnectivity next) => seen.add(next),
          fireImmediately: true,
        );
        async.elapse(kConnectivityDebounce * 2);

        expect(seen, everyElement(CpiConnectivity.online));
        expect(container.read(connectivityProvider), CpiConnectivity.online);

        container.dispose();
      });
    });

    test('un verdict positif laisse l\'application tranquille', () async {
      final ProviderContainer container = withValidation(true);
      container.listen(
        connectivityInterfaceProvider,
        (Object? _, Object? _) {},
      );
      container.listen(networkValidatedProvider, (Object? _, Object? _) {});
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    test('« je ne sais pas encore » ne fait clignoter aucune panne', () async {
      // Juste après un changement d'antenne, la sonde système n'a pas tranché.
      final ProviderContainer container = withValidation(null);
      container.listen(
        connectivityInterfaceProvider,
        (Object? _, Object? _) {},
      );
      container.listen(networkValidatedProvider, (Object? _, Object? _) {});
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    test('sans interface, « hors ligne » prime sur le verdict', () async {
      final ProviderContainer container = ProviderContainer(
        overrides: [
          connectivitySourceProvider.overrideWithValue(
            _FakeSource(
              initial: <ConnectivityResult>[ConnectivityResult.none],
              changes: const Stream<List<ConnectivityResult>>.empty(),
            ),
          ),
          networkValidationProvider.overrideWithValue(
            const _FakeValidation(false),
          ),
        ],
      );
      addTearDown(container.dispose);
      container.listen(
        connectivityInterfaceProvider,
        (Object? _, Object? _) {},
      );
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.offline);
    });

    /// Le terrain, reproduit deux fois sur emulator-5554 : la Wi-Fi revient,
    /// Android ne l'a pas encore validée à l'instant de l'événement, et plus
    /// aucun événement ne suivra. La bande « Hors ligne » ne repartait plus de
    /// la session.
    test('le réseau revient avant qu\'Android ne l\'ait validé', () {
      fakeAsync((FakeAsync async) {
        final StreamController<List<ConnectivityResult>> events =
            StreamController<List<ConnectivityResult>>.broadcast();
        final ProviderContainer container = ProviderContainer(
          overrides: [
            connectivitySourceProvider.overrideWithValue(
              _FakeSource(
                initial: <ConnectivityResult>[ConnectivityResult.none],
                changes: events.stream,
              ),
            ),
            networkValidationProvider.overrideWithValue(
              const _FakeValidation(false),
            ),
          ],
        );
        container.listen(connectivityProvider, (Object? _, Object? _) {});
        async.elapse(const Duration(milliseconds: 100));
        expect(container.read(connectivityProvider), CpiConnectivity.offline);

        events.add(<ConnectivityResult>[ConnectivityResult.wifi]);
        async.elapse(kConnectivityDebounce * 2);

        expect(container.read(connectivityProvider), CpiConnectivity.online);

        container.dispose();
        unawaited(events.close());
      });
    });

    test(
      'le canal absent ne fait pas lever : il rend « je ne sais pas »',
      () async {
        // Aucun gestionnaire enregistré : c'est l'état d'un test de widget, d'un
        // aperçu, et de toute plateforme non Android.
        expect(await const PlatformNetworkValidation().isValidated(), isNull);
      },
    );
  });

  group('troisième état : injoignable', () {
    ProviderContainer online() => containerWith(
      _FakeSource(
        initial: <ConnectivityResult>[ConnectivityResult.mobile],
        changes: const Stream<List<ConnectivityResult>>.empty(),
      ),
    );

    test(
      'sans preuve d\'échec, une interface active vaut « en ligne »',
      () async {
        final ProviderContainer container = online();
        container.listen(
          connectivityInterfaceProvider,
          (Object? _, Object? _) {},
        );
        await pumpEventQueue();
        expect(container.read(connectivityProvider), CpiConnectivity.online);
      },
    );

    test(
      'un échec de lien récent rend « injoignable », sans un octet de plus',
      () async {
        final ProviderContainer container = online();
        container.listen(
          connectivityInterfaceProvider,
          (Object? _, Object? _) {},
        );
        await pumpEventQueue();

        container
            .read(unreachableEvidenceProvider.notifier)
            .record(DateTime.now());
        expect(
          container.read(connectivityProvider),
          CpiConnectivity.unreachable,
        );
      },
    );

    test('la preuve expire toute seule : pas d\'icône collée à l\'écran', () {
      // L'ancienne version datait la preuve dans le passé et relisait la
      // fraîcheur : elle prouvait une soustraction. Rien ne recalculait ce
      // verdict, donc « Serveur injoignable » restait à l'écran jusqu'à ce
      // qu'une autre dépendance bouge par hasard.
      fakeAsync((FakeAsync async) {
        final ProviderContainer container = online();
        final List<CpiConnectivity> seen = <CpiConnectivity>[];
        container.listen<CpiConnectivity>(
          connectivityProvider,
          (CpiConnectivity? _, CpiConnectivity next) => seen.add(next),
        );
        async.flushMicrotasks();

        container
            .read(unreachableEvidenceProvider.notifier)
            .record(DateTime.now());
        expect(
          container.read(connectivityProvider),
          CpiConnectivity.unreachable,
        );

        async.elapse(kUnreachableFreshness + const Duration(seconds: 1));

        expect(
          seen.last,
          CpiConnectivity.online,
          reason: 'sans notification, l\'écran garde son bandeau',
        );
        expect(container.read(connectivityProvider), CpiConnectivity.online);
      });
    });

    /// L'échec prouvait l'ancien lien, pas le nouveau. Sur l'écran de connexion
    /// aucun cycle ne tourne pour l'effacer : la bande y survivait au retour du
    /// réseau.
    test('le retour d\'une interface efface la preuve', () async {
      final StreamController<List<ConnectivityResult>> events =
          StreamController<List<ConnectivityResult>>.broadcast();
      addTearDown(events.close);
      final ProviderContainer container = containerWith(
        _FakeSource(
          initial: <ConnectivityResult>[ConnectivityResult.none],
          changes: events.stream,
        ),
      );
      container.listen(connectivityProvider, (Object? _, Object? _) {});
      await pumpEventQueue();

      container
          .read(unreachableEvidenceProvider.notifier)
          .record(DateTime.now());
      events.add(<ConnectivityResult>[ConnectivityResult.wifi]);
      await pumpEventQueue();

      expect(container.read(unreachableEvidenceProvider), isNull);
      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    test('un succès efface la preuve immédiatement', () async {
      final ProviderContainer container = online();
      container.listen(
        connectivityInterfaceProvider,
        (Object? _, Object? _) {},
      );
      await pumpEventQueue();

      final UnreachableEvidence evidence = container.read(
        unreachableEvidenceProvider.notifier,
      );
      evidence.record(DateTime.now());
      evidence.clear();
      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    /// Le terrain : la bande reste « Hors ligne » alors que la Wi-Fi est
    /// revenue. Le verdict doit redescendre à « en ligne » sur le seul
    /// événement d'interface, sans attendre un cycle de synchronisation.
    test('le réseau revient : le verdict repasse en ligne', () async {
      final StreamController<List<ConnectivityResult>> events =
          StreamController<List<ConnectivityResult>>.broadcast();
      addTearDown(events.close);
      final ProviderContainer container = ProviderContainer(
        overrides: [
          connectivitySourceProvider.overrideWithValue(
            _FakeSource(
              initial: <ConnectivityResult>[ConnectivityResult.none],
              changes: events.stream,
            ),
          ),
          networkValidationProvider.overrideWithValue(
            const _FakeValidation(true),
          ),
        ],
      );
      addTearDown(container.dispose);

      container.listen(connectivityProvider, (Object? _, Object? _) {});
      await pumpEventQueue();
      expect(container.read(connectivityProvider), CpiConnectivity.offline);

      events.add(<ConnectivityResult>[ConnectivityResult.wifi]);
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    /// Le même retour de réseau, mais pendant que plus aucun écran n'affiche le
    /// verdict : c'est le cas réel, la bande ne vit que sur l'accueil.
    test('le réseau revient pendant qu\'aucun écran n\'écoute', () async {
      final StreamController<List<ConnectivityResult>> events =
          StreamController<List<ConnectivityResult>>.broadcast();
      addTearDown(events.close);
      final ProviderContainer container = ProviderContainer(
        overrides: [
          connectivitySourceProvider.overrideWithValue(
            _FakeSource(
              initial: <ConnectivityResult>[ConnectivityResult.none],
              changes: events.stream,
            ),
          ),
          networkValidationProvider.overrideWithValue(
            const _FakeValidation(true),
          ),
        ],
      );
      addTearDown(container.dispose);

      // La source reste active pour toute l'application, comme le tient
      // `SyncCoordinator` ; seul l'écran s'en va.
      container.listen(connectivityResultsProvider, (Object? _, Object? _) {});
      final ProviderSubscription<CpiConnectivity> ecran = container.listen(
        connectivityProvider,
        (Object? _, Object? _) {},
      );
      await pumpEventQueue();
      expect(container.read(connectivityProvider), CpiConnectivity.offline);

      ecran.close();
      events.add(<ConnectivityResult>[ConnectivityResult.wifi]);
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    /// L'onglet quitté n'est pas démonté : Flutter coupe son `TickerMode`, ce
    /// que Riverpod traduit par une mise en pause des abonnements.
    test('le réseau revient pendant que l\'écran est en pause', () async {
      final StreamController<List<ConnectivityResult>> events =
          StreamController<List<ConnectivityResult>>.broadcast();
      addTearDown(events.close);
      final ProviderContainer container = ProviderContainer(
        overrides: [
          connectivitySourceProvider.overrideWithValue(
            _FakeSource(
              initial: <ConnectivityResult>[ConnectivityResult.none],
              changes: events.stream,
            ),
          ),
          networkValidationProvider.overrideWithValue(
            const _FakeValidation(true),
          ),
        ],
      );
      addTearDown(container.dispose);

      container.listen(connectivityResultsProvider, (Object? _, Object? _) {});
      final ProviderSubscription<CpiConnectivity> ecran = container.listen(
        connectivityProvider,
        (Object? _, Object? _) {},
      );
      await pumpEventQueue();
      expect(container.read(connectivityProvider), CpiConnectivity.offline);

      ecran.pause();
      events.add(<ConnectivityResult>[ConnectivityResult.wifi]);
      await pumpEventQueue();
      ecran.resume();
      await pumpEventQueue();

      expect(container.read(connectivityProvider), CpiConnectivity.online);
    });

    test(
      'aucune interface prime sur tout : c\'est la seule certitude',
      () async {
        final ProviderContainer container = containerWith(
          _FakeSource(
            initial: <ConnectivityResult>[ConnectivityResult.none],
            changes: const Stream<List<ConnectivityResult>>.empty(),
          ),
        );
        container.listen(
          connectivityInterfaceProvider,
          (Object? _, Object? _) {},
        );
        await pumpEventQueue();

        container
            .read(unreachableEvidenceProvider.notifier)
            .record(DateTime.now());
        expect(container.read(connectivityProvider), CpiConnectivity.offline);
      },
    );
  });
}

class _FakeValidation implements NetworkValidation {
  const _FakeValidation(this._verdict);

  final bool? _verdict;

  @override
  Future<bool?> isValidated() async => _verdict;
}

/// Compte les abonnements réellement ouverts sur le canal plateforme.
class _CountingSource implements ConnectivitySource {
  int subscriptions = 0;

  @override
  Future<List<ConnectivityResult>> current() async => <ConnectivityResult>[
    ConnectivityResult.wifi,
  ];

  @override
  Stream<List<ConnectivityResult>> changes() {
    subscriptions++;
    return const Stream<List<ConnectivityResult>>.empty();
  }
}

class _FakeSource implements ConnectivitySource {
  _FakeSource({
    required this.initial,
    required Stream<List<ConnectivityResult>> changes,
  }) : _changes = changes;

  final List<ConnectivityResult> initial;
  final Stream<List<ConnectivityResult>> _changes;

  @override
  Future<List<ConnectivityResult>> current() async => initial;

  @override
  Stream<List<ConnectivityResult>> changes() => _changes;
}
