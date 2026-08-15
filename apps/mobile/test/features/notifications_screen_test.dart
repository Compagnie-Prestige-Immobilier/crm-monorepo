import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/push/push_message.dart';
import 'package:cpi_go/core/push/push_transport.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/notifications/notification_inbox.dart';
import 'package:cpi_go/features/notifications/notifications_controller.dart';
import 'package:cpi_go/features/notifications/presentation/notification_bell.dart';
import 'package:cpi_go/features/notifications/presentation/notifications_screen.dart';
import 'package:cpi_go/features/notifications/push_deep_link_listener.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/db_fixture.dart';

/// Centre de notifications et navigation par lien profond.
///
/// Le point le plus important de ce fichier est le groupe « démarrage à
/// froid » : c'est le cas où un lien profond se perd le plus facilement, et
/// c'est aussi le seul qui compte vraiment : une notification se tape depuis
/// l'écran de verrouillage, application fermée.

/// `testWidgets`, plus le démontage explicite de l'arbre à la fin.
///
/// Sans lui, chaque test échoue sur « A Timer is still pending even after the
/// widget tree was disposed » : quand un `StreamProvider` de drift est disposé,
/// `StreamQueryStore.markAsClosed` programme un minuteur de durée nulle, et le
/// binding démonte l'arbre APRÈS le dernier `pump`.
void notificationTestWidgets(String description, WidgetTesterCallback body) {
  testWidgets(description, (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await body(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  });
}

/// Session ouverte, sans toucher au stockage chiffré.
class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'me',
    fullName: 'Awa Diop',
  );
}

/// Boîte de réception muette.
///
/// Les tests d'interface ne parlent à aucun serveur : sans cette doublure, le
/// premier cadre déclencherait une vraie requête `Dio`, dont le minuteur de
/// connexion survivrait au démontage de l'arbre et ferait échouer le test sur
/// « A Timer is still pending ». Elle prouve aussi que l'écran ne dépend PAS du
/// réseau pour afficher sa liste : tout vient de SQLite.
class _SilentInbox implements NotificationInbox {
  int refreshes = 0;
  final List<String> reads = <String>[];

  /// Verdict rendu au prochain [refresh]. Par défaut : le serveur répond.
  InboxSync outcome = InboxSync.ok;

  final ValueNotifier<InboxStatus> _status = ValueNotifier<InboxStatus>(
    const InboxStatus.never(),
  );

  @override
  ValueListenable<InboxStatus> get status => _status;

  @override
  Future<int> refresh({bool force = false, int pageSize = 50}) async {
    refreshes++;
    _status.value = InboxStatus(
      state: outcome,
      lastSuccessAt: outcome == InboxSync.ok ? DateTime.now() : null,
    );
    return 0;
  }

  @override
  Future<void> markRead(String notificationId) async => reads.add(notificationId);

  @override
  void dispose() => _status.dispose();
}

/// Coordinateur de synchronisation à l'arrêt.
///
/// Le vrai branche cinq déclencheurs, dont un minuteur de 60 s et un écouteur
/// de connectivité : instancié dans un test de widget, il ne se stabilise
/// jamais. Le coordinateur de notifications l'observe (`ref.listen`), donc il
/// faut le neutraliser explicitement.
class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

/// Session dont le verdict n'est pas encore rendu : l'état d'un démarrage à
/// froid pendant la lecture du jeton de renouvellement.
class _ResolvingController extends AuthController {
  @override
  AuthState build() => const AuthState.unknown();

  void resolveAuthenticated() {
    state = const AuthState(
      status: AuthStatus.authenticated,
      userId: 'me',
      fullName: 'Awa',
    );
  }
}

void main() {
  late AppDatabase db;

  setUp(() async {
    db = await openTestDatabase();
  });

  tearDown(() async => db.close());

  PushMessage message(String id, {String? route}) => PushMessage(
    id: id,
    title: 'Appels en attente',
    body: 'Il vous reste 3 fiches à appeler.',
    category: 'RAPPEL',
    route: route,
    sentAt: t0,
  );

  // ───────────────────────────────────────────────────────────────────────────
  group('centre d’annonces', () {
    late _SilentInbox inbox;

    setUp(() => inbox = _SilentInbox());

    Widget host() {
      return ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          notificationInboxProvider.overrideWithValue(inbox),
          authControllerProvider.overrideWith(_SignedInController.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const NotificationsScreen(),
        ),
      );
    }

    notificationTestWidgets('affiche un état vide explicite', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(find.text('Aucune annonce'), findsOneWidget);
    });

    notificationTestWidgets(
      'NE DIT PLUS que les notifications sont indisponibles',
      (WidgetTester tester) async {
        // Le message « Notifications indisponibles sur cet appareil / La
        // messagerie push n'est pas configurée » était devenu l'état permanent
        // après l'abandon de Firebase : l'application annonçait sa propre panne
        // à chaque ouverture, alors que la liste marche.
        await tester.pumpWidget(host());
        await tester.pumpAndSettle();

        expect(find.textContaining('indisponibles'), findsNothing);
        expect(find.textContaining('messagerie push'), findsNothing);
        expect(find.text('Autoriser'), findsNothing);
        expect(find.text('Ouvrir les réglages'), findsNothing);
      },
    );

    notificationTestWidgets('liste ce qui est en base, sans réseau', (
      WidgetTester tester,
    ) async {
      await PushInboxHelper(db).seed(message('ntf-1'));

      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(find.text('Appels en attente'), findsOneWidget);
      expect(find.text('Il vous reste 3 fiches à appeler.'), findsOneWidget);
    });

    notificationTestWidgets('RAPATRIE la boîte de réception à l’ouverture', (
      WidgetTester tester,
    ) async {
      // `refreshInbox` n'avait AUCUN appelant : la promesse « les annonces
      // restent consultables ici, à chaque ouverture » était fausse. Sans
      // transport push, c'est le seul chemin par lequel une annonce composée au
      // siège atteint le téléphone.
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(inbox.refreshes, greaterThan(0));
    });

    notificationTestWidgets('un tap marque lu, localement ET au serveur', (
      WidgetTester tester,
    ) async {
      await PushInboxHelper(db).seed(message('ntf-1'));

      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Appels en attente'));
      await tester.pumpAndSettle();

      final StoredNotification? row = await (db.select(
        db.notifications,
      )..where((Notifications t) => t.id.equals('ntf-1'))).getSingleOrNull();
      expect(row!.readAt, isNotNull);
      // Sans la remontée, le siège ne saurait jamais qu'une annonce a été lue.
      expect(inbox.reads, contains('ntf-1'));
    });

    notificationTestWidgets('un échec de rapatriement le DIT, avec sa date', (
      WidgetTester tester,
    ) async {
      // « Aucune annonce » recouvrait trois situations : boîte vraiment vide,
      // rapatriement pas encore fait, rapatriement échoué. L'utilisateur en
      // concluait que le siège n'envoyait rien.
      inbox.outcome = InboxSync.offline;

      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(find.textContaining('Liste non actualisée'), findsOneWidget);
    });

    notificationTestWidgets('un rapatriement réussi ne dit rien', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(find.textContaining('Liste non actualisée'), findsNothing);
    });

    notificationTestWidgets('l\'état VIDE offre lui aussi le tirer-pour-actualiser', (
      WidgetTester tester,
    ) async {
      // `RefreshIndicator` n'enveloppait que la branche non vide : sur un
      // premier lancement raté : c'est-à-dire exactement l'état où il faut
      // réessayer : il n'existait aucun geste pour redemander la liste.
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(find.text('Aucune annonce'), findsOneWidget);
      expect(
        find.ancestor(
          of: find.text('Aucune annonce'),
          matching: find.byType(RefreshIndicator),
        ),
        findsOneWidget,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('pastille de l’AppBar', () {
    Widget host() {
      return ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          notificationInboxProvider.overrideWithValue(_SilentInbox()),
          authControllerProvider.overrideWith(_SignedInController.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: Scaffold(
            appBar: AppBar(
              title: const Text('CPI GO'),
              actions: const <Widget>[NotificationBell()],
            ),
          ),
        ),
      );
    }

    notificationTestWidgets('n’affiche aucun chiffre quand tout est lu', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host());
      await tester.pumpAndSettle();
      expect(find.text('1'), findsNothing);
    });

    notificationTestWidgets('affiche le nombre de non-lues', (WidgetTester tester) async {
      await PushInboxHelper(db).seed(message('a'));
      await PushInboxHelper(db).seed(message('b'));

      await tester.pumpWidget(host());
      await tester.pumpAndSettle();

      expect(find.text('2'), findsOneWidget);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('navigation par lien profond depuis un DÉMARRAGE À FROID', () {
    /// Application minimale avec le vrai `go_router` et le vrai sas de route.
    Widget host({
      required FakePushTransport transport,
      required AuthController Function() authFactory,
    }) {
      final GoRouter router = GoRouter(
        initialLocation: Routes.home,
        routes: <RouteBase>[
          GoRoute(
            path: Routes.home,
            builder: (BuildContext context, GoRouterState state) =>
                const Scaffold(body: Center(child: Text('ACCUEIL'))),
          ),
          GoRoute(
            path: Routes.phase2,
            builder: (BuildContext context, GoRouterState state) =>
                const Scaffold(body: Center(child: Text('PHASE 2'))),
          ),
          GoRoute(
            path: Routes.notifications,
            builder: (BuildContext context, GoRouterState state) =>
                const Scaffold(body: Center(child: Text('NOTIFICATIONS'))),
          ),
        ],
      );

      return ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          pushTransportProvider.overrideWithValue(transport),
          notificationInboxProvider.overrideWithValue(_SilentInbox()),
          // Observé par le coordinateur de notifications : sans neutralisation,
          // il démarrerait ses cinq déclencheurs et le test ne se stabiliserait
          // jamais.
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(authFactory),
          // Le sas navigue par `routerProvider` et non par
          // `GoRouter.of(context)` : le `builder` de `MaterialApp.router` est
          // au-dessus de l'`InheritedGoRouter`. Le test doit donc exposer LE
          // MÊME routeur que celui passé à `routerConfig`.
          routerProvider.overrideWithValue(router),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          routerConfig: router,
          // Exactement le montage de `app.dart` : SOUS le `Router`, seule
          // position d'où `context.go` atteint le routeur réel.
          builder: (BuildContext context, Widget? child) =>
              PushDeepLinkListener(child: child ?? const SizedBox.shrink()),
        ),
      );
    }

    notificationTestWidgets(
      'le message qui a lancé l’application ouvre SA route, pas l’accueil',
      (WidgetTester tester) async {
        final FakePushTransport transport = FakePushTransport(
          launchMessage: message('ntf-1', route: Routes.phase2),
        );
        addTearDown(transport.dispose);

        await tester.pumpWidget(
          host(transport: transport, authFactory: _SignedInController.new),
        );
        await tester.pumpAndSettle();

        // Le coordinateur n'est démarré que par la racine réelle ; ici on le
        // déclenche explicitement, ce qui est exactement ce que fait `app.dart`
        // quand la session est ouverte.
        final BuildContext context = tester.element(find.byType(MaterialApp).first);
        final ProviderContainer scope = ProviderScope.containerOf(context);
        scope.read(notificationsCoordinatorProvider.notifier);
        await tester.pumpAndSettle();

        expect(find.text('PHASE 2'), findsOneWidget);
        expect(find.text('ACCUEIL'), findsNothing);
      },
    );

    notificationTestWidgets(
      'la route est RETENUE tant que le garde n’a pas tranché, puis rejouée',
      (WidgetTester tester) async {
        // C'est le défaut que ce sas existe pour empêcher : naviguer avant que
        // le garde ait résolu est sans effet, sa redirection écrase tout. Le
        // lien profond « marcherait » application ouverte et se perdrait au
        // démarrage à froid : le seul cas qui compte.
        final FakePushTransport transport = FakePushTransport();
        addTearDown(transport.dispose);

        late _ResolvingController controller;

        await tester.pumpWidget(
          host(
            transport: transport,
            authFactory: () {
              controller = _ResolvingController();
              return controller;
            },
          ),
        );
        await tester.pumpAndSettle();

        final BuildContext context = tester.element(find.byType(MaterialApp).first);
        final ProviderContainer scope = ProviderScope.containerOf(context);

        // Route offerte AVANT la résolution du garde.
        scope
            .read(pendingPushRouteProvider.notifier)
            .offerRoute(Routes.phase2, notificationId: 'ntf-1');
        await tester.pumpAndSettle();

        // Rien ne bouge : le verdict n'est pas rendu.
        expect(find.text('ACCUEIL'), findsOneWidget);
        expect(scope.read(pendingPushRouteProvider), isNotNull);

        // Le garde tranche.
        controller.resolveAuthenticated();
        await tester.pumpAndSettle();

        expect(find.text('PHASE 2'), findsOneWidget);
        // Et le sas est vidé : la relire produirait une redirection surprise.
        expect(scope.read(pendingPushRouteProvider), isNull);
      },
    );

    notificationTestWidgets('une route non sûre n’est jamais rejouée', (
      WidgetTester tester,
    ) async {
      final FakePushTransport transport = FakePushTransport();
      addTearDown(transport.dispose);

      await tester.pumpWidget(
        host(transport: transport, authFactory: _SignedInController.new),
      );
      await tester.pumpAndSettle();

      final BuildContext context = tester.element(find.byType(MaterialApp).first);
      final ProviderContainer scope = ProviderScope.containerOf(context);

      scope
          .read(pendingPushRouteProvider.notifier)
          .offerRoute('https://exemple.test/piege');
      await tester.pumpAndSettle();

      expect(scope.read(pendingPushRouteProvider), isNull);
      expect(find.text('ACCUEIL'), findsOneWidget);
    });

    notificationTestWidgets('un tap en arrière-plan ouvre aussi la route', (
      WidgetTester tester,
    ) async {
      final FakePushTransport transport = FakePushTransport();
      addTearDown(transport.dispose);

      await tester.pumpWidget(
        host(transport: transport, authFactory: _SignedInController.new),
      );
      await tester.pumpAndSettle();

      final BuildContext context = tester.element(find.byType(MaterialApp).first);
      final ProviderContainer scope = ProviderScope.containerOf(context);
      scope.read(notificationsCoordinatorProvider.notifier);
      await tester.pumpAndSettle();

      transport.emitOpened(message('ntf-2', route: Routes.notifications));
      await tester.pumpAndSettle();

      expect(find.text('NOTIFICATIONS'), findsOneWidget);
    });

    notificationTestWidgets(
      'application ouverte, la route s’EMPILE : l’écran de travail survit',
      (WidgetTester tester) async {
        // `go` remplaçait toute la pile : un commercial qui tapait une annonce
        // depuis un formulaire à moitié rempli ne pouvait plus y revenir, la
        // flèche de retour n'ayant plus rien à dépiler.
        final FakePushTransport transport = FakePushTransport();
        addTearDown(transport.dispose);

        await tester.pumpWidget(
          host(transport: transport, authFactory: _SignedInController.new),
        );
        await tester.pumpAndSettle();

        final BuildContext context = tester.element(find.byType(MaterialApp).first);
        final ProviderContainer scope = ProviderScope.containerOf(context);
        scope.read(notificationsCoordinatorProvider.notifier);
        await tester.pumpAndSettle();

        // L'utilisateur travaille sur un deuxième écran.
        final GoRouter router = scope.read(routerProvider);
        router.push(Routes.phase2);
        await tester.pumpAndSettle();
        expect(find.text('PHASE 2'), findsOneWidget);

        transport.emitOpened(message('ntf-3', route: Routes.notifications));
        await tester.pumpAndSettle();

        expect(find.text('NOTIFICATIONS'), findsOneWidget);
        expect(
          router.routerDelegate.currentConfiguration.matches.length,
          greaterThan(1),
          reason: 'la destination doit s’empiler, pas remplacer le travail en cours',
        );
      },
    );
  });
}

/// Amorçage direct de la table, sans passer par le transport.
class PushInboxHelper {
  const PushInboxHelper(this.db);

  final AppDatabase db;

  Future<void> seed(PushMessage message) async {
    await db
        .into(db.notifications)
        .insert(
          NotificationsCompanion.insert(
            id: message.id,
            title: message.title,
            body: message.body,
            createdAt: message.sentAt,
            receivedAt: message.sentAt,
          ),
        );
  }
}
