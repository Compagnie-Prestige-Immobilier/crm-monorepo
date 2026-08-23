import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/sync_engine.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Envoi automatique quand l'application revient au premier plan, **sans qu'un
/// seul écran ait été touché**.
///
/// ## Le défaut redouté
///
/// C'est la plainte de terrain : « je coupe le réseau, je saisis, je rebranche,
/// et rien ne part tant que je ne tire pas pour rafraîchir ». Si la vidange ne
/// se déclenchait qu'au geste de l'utilisateur, une journée de prospection
/// pourrait rester sur le téléphone jusqu'au soir.
///
/// Le déclencheur existe (`AppLifecycleListener` dans `SyncCoordinator`), mais
/// il n'était vérifié nulle part, et il ne suffit pas qu'il existe : encore
/// faut-il que le coordinateur soit VIVANT à ce moment-là. Il l'est parce que
/// `app.dart` l'observe à la racine authentifiée, indépendamment de la route
/// affichée. Ce test reproduit exactement cette situation (un conteneur, aucun
/// widget, aucun écran) et exige que la file se vide toute seule.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  ProviderContainer buildContainer() {
    final ProviderContainer container = ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        // `InMemoryTokenStore` et non `SecureTokenStore` : le stockage chiffré
        // passe par un canal de plateforme qui n'existe pas ici. La session est
        // ouverte, sinon le moteur rendrait `no_session` et le test passerait
        // pour la mauvaise raison.
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore(refreshToken: 'jeton', userId: 'me'),
        ),
        clockProvider.overrideWithValue(const SystemClock()),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('un retour au premier plan vide la file, sans aucun écran monté', () async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221771111111');
    await queueOp(
      db,
      id: 'op-1',
      entityType: 'representant',
      entityId: 'rep-1',
      payload: <String, Object?>{
        'id': 'rep-1',
        'fullName': 'Représentant',
        'phoneE164': '+221771111111',
        'departementId': 'dep-1',
      },
    );

    final ProviderContainer container = buildContainer();
    // Exactement ce que fait `app.dart` dès que la session est ouverte : lire le
    // notifier, rien d'autre. Aucun écran n'est construit.
    final SyncCoordinator coordinator = container.read(
      syncCoordinatorProvider.notifier,
    );

    // Le cycle de démarrage.
    await coordinator.run();
    expect(api.rows.keys, contains('rep-1'));

    // Deuxième saisie pendant que l'application est en arrière-plan.
    await insertRepresentant(db, id: 'rep-2', phone: '+221772222222');
    await queueOp(
      db,
      id: 'op-2',
      entityType: 'representant',
      entityId: 'rep-2',
      payload: <String, Object?>{
        'id': 'rep-2',
        'fullName': 'Deuxième',
        'phoneE164': '+221772222222',
        'departementId': 'dep-1',
      },
    );

    // Le système ramène l'application au premier plan. Personne ne touche
    // l'écran, personne ne tire pour rafraîchir.
    TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(
      AppLifecycleState.inactive,
    );
    TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(
      AppLifecycleState.resumed,
    );
    // Le déclencheur est synchrone, le cycle ne l'est pas : on laisse la file de
    // micro-tâches se dérouler.
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(
      api.rows.keys,
      contains('rep-2'),
      reason:
          'la file doit se vider au retour au premier plan, sans geste de '
          "l'utilisateur",
    );
    expect(await db.countPendingOutbox().getSingle(), 0);
  });

  test('le minuteur de 60 s s\'arrête en veille et repart au réveil', () async {
    // La documentation de `SyncCoordinator` promet un cycle « tant que
    // l'application est visible ». Le minuteur n'était jamais annulé : une
    // application laissée en arrière-plan tirait le serveur toutes les minutes,
    // toute la journée, sur le forfait mobile du commercial. Et c'est
    // exactement le travail que le worker WorkManager fait déjà, une fois,
    // quand le système le permet.
    final ProviderContainer container = buildContainer();
    final SyncCoordinator coordinator = container.read(
      syncCoordinatorProvider.notifier,
    );
    await Future<void>.delayed(Duration.zero);
    expect(coordinator.isPolling, isTrue);

    for (final AppLifecycleState state in <AppLifecycleState>[
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
    ]) {
      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(state);
    }
    await Future<void>.delayed(Duration.zero);
    expect(
      coordinator.isPolling,
      isFalse,
      reason: 'une application invisible ne doit pas tirer le serveur',
    );

    for (final AppLifecycleState state in <AppLifecycleState>[
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ]) {
      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(state);
    }
    await Future<void>.delayed(Duration.zero);
    expect(
      coordinator.isPolling,
      isTrue,
      reason: 'sans remontage, le cycle périodique ne repartirait jamais',
    );
  });

  test('la mise en veille survit à un WorkManager indisponible', () async {
    // Sur un téléphone où l'enregistrement de la tâche de fond échoue (ROM
    // constructeur, service Google absent), la mise en veille avec une file
    // pleine lançait une erreur asynchrone que personne n'attrapait.
    final ProviderContainer container = buildContainer();
    container.read(syncCoordinatorProvider.notifier);
    await Future<void>.delayed(const Duration(milliseconds: 10));

    await insertRepresentant(db, id: 'rep-4', phone: '+221774444444');
    await queueOp(
      db,
      id: 'op-4',
      entityType: 'representant',
      entityId: 'rep-4',
      payload: <String, Object?>{
        'id': 'rep-4',
        'fullName': 'Quatrième',
        'phoneE164': '+221774444444',
        'departementId': 'dep-1',
      },
    );

    for (final AppLifecycleState state in <AppLifecycleState>[
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
    ]) {
      TestWidgetsFlutterBinding.instance.handleAppLifecycleStateChanged(state);
    }
    await Future<void>.delayed(const Duration(milliseconds: 10));

    // La saisie doit toujours être en file : le rattrapage n'a pas pu être
    // programmé, mais rien n'est perdu et l'application tient debout.
    expect(await db.countPendingOutbox().getSingle(), 1);
  });

  test('un lien mort laisse une preuve, un succès l\'efface', () async {
    // Le seul signal d'accessibilité que l'app possède, et il ne coûte rien :
    // il vient d'une requête qu'on faisait de toute façon. `connectivity_plus`
    // ne peut pas le produire, il annonce `mobile` sur un portail captif.
    final ProviderContainer container = buildContainer();
    final SyncCoordinator coordinator = container.read(
      syncCoordinatorProvider.notifier,
    );
    // Le cycle de démarrage part tout seul dans une micro-tâche : on le laisse
    // finir avant d'armer la panne, sinon il la consomme sur une file vide.
    await Future<void>.delayed(const Duration(milliseconds: 10));

    await insertRepresentant(db, id: 'rep-3', phone: '+221773333333');
    await queueOp(
      db,
      id: 'op-3',
      entityType: 'representant',
      entityId: 'rep-3',
      payload: <String, Object?>{
        'id': 'rep-3',
        'fullName': 'Troisième',
        'phoneE164': '+221773333333',
        'departementId': 'dep-1',
      },
    );

    api.failNextPush = const ApiException(
      'NETWORK',
      kind: FailureKind.unreachable,
    );
    await coordinator.run();
    expect(container.read(unreachableEvidenceProvider), isNotNull);
    expect(container.read(connectivityProvider), CpiConnectivity.unreachable);

    await coordinator.run();
    expect(container.read(unreachableEvidenceProvider), isNull);
    expect(container.read(connectivityProvider), CpiConnectivity.online);
  });

  // ═══ L'ANNUAIRE N'AVAIT QU'UN BOUTON POUR SE REMPLIR ═══
  //
  // `Phase2DirectorySync.pull` n'était appelé que par un bouton d'écran. Le
  // téléconseiller parti sans avoir appuyé composait des numéros
  // « introuvables » toute la journée : l'annuaire est ce qui dit à quel
  // prospect appartient le numéro qu'il compose.

  test('le cycle de synchronisation remplit l\'annuaire de phase 2', () async {
    api.directoryPages.add(
      directoryPage(
        entries: <Phase2DirectoryEntry>[
          directoryEntry(prospectId: 'pro-1', phoneE164: '+221770000001'),
        ],
      ),
    );

    final ProviderContainer container = buildContainer();
    await container.read(syncCoordinatorProvider.notifier).run();

    expect(api.directoryCalls, isNotEmpty);
    expect(await db.countPhase2Directory().getSingle(), 1);
  });

  test('un annuaire injoignable ne fait pas échouer le cycle', () async {
    api.failNextDirectoryPull = const ApiException(
      'NETWORK',
      kind: FailureKind.unreachable,
    );

    final ProviderContainer container = buildContainer();
    final SyncOutcome outcome = await container
        .read(syncCoordinatorProvider.notifier)
        .run();

    expect(outcome.isOk, isTrue);
  });

  test('une vidange seule ne tire pas l\'annuaire', () async {
    final ProviderContainer container = buildContainer();
    await container.read(syncCoordinatorProvider.notifier).run(pull: false);

    expect(api.directoryCalls, isEmpty);
  });
}
