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

    test(
      'un portail captif est annoncé AVANT le premier échec de cycle',
      () async {
        // Android a déjà sondé : `NET_CAPABILITY_VALIDATED` est absente. Sans ce
        // canal, il fallait attendre qu'un cycle de synchronisation échoue pour
        // que l'écran ose dire quoi que ce soit : l'utilisateur entrait dans la
        // salle de formation et voyait une application qui se croyait en ligne.
        final ProviderContainer container = withValidation(false);
        container.listen(
          connectivityInterfaceProvider,
          (Object? _, Object? _) {},
        );
        container.listen(networkValidatedProvider, (Object? _, Object? _) {});
        await pumpEventQueue();

        expect(
          container.read(connectivityProvider),
          CpiConnectivity.unreachable,
        );
      },
    );

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
