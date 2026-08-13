import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/push/push_message.dart';
import 'package:cpi_go/core/push/push_transport.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/notifications/notifications_controller.dart';
import 'package:cpi_go/features/notifications/presentation/notification_bell.dart';
import 'package:cpi_go/features/notifications/presentation/notifications_screen.dart';
import 'package:cpi_go/features/notifications/push_deep_link_listener.dart';
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
/// c'est aussi le seul qui compte vraiment — une notification se tape depuis
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

/// Session dont le verdict n'est pas encore rendu — l'état d'un démarrage à
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
  group('centre de notifications', () {
    Widget host(FakePushTransport transport) {
      return ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          pushTransportProvider.overrideWithValue(transport),
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
      final FakePushTransport transport = FakePushTransport(
        permission: PushPermission.granted,
      );
      addTearDown(transport.dispose);

      await tester.pumpWidget(host(transport));
      await tester.pumpAndSettle();

      expect(find.text('Aucune notification'), findsOneWidget);
    });

    notificationTestWidgets('liste ce qui est en base, sans réseau', (
      WidgetTester tester,
    ) async {
      final FakePushTransport transport = FakePushTransport(
        permission: PushPermission.granted,
      );
      addTearDown(transport.dispose);
      await PushInboxHelper(db).seed(message('ntf-1'));

      await tester.pumpWidget(host(transport));
      await tester.pumpAndSettle();

      expect(find.text('Appels en attente'), findsOneWidget);
      expect(find.text('Il vous reste 3 fiches à appeler.'), findsOneWidget);
    });

    notificationTestWidgets('DEMANDE l’autorisation ici, pas au lancement', (
      WidgetTester tester,
    ) async {
      // L'autorisation se demande EN CONTEXTE. Au premier lancement, avant que
      // l'utilisateur ait la moindre idée de ce que l'application enverra, elle
      // est refusée par réflexe — et Android ne repose plus jamais la question.
      final FakePushTransport transport = FakePushTransport(
        permission: PushPermission.notRequested,
      );
      addTearDown(transport.dispose);

      await tester.pumpWidget(host(transport));
      await tester.pumpAndSettle();

      expect(find.text('Recevoir les annonces du siège'), findsOneWidget);
      // Rien n'a encore été demandé : le bandeau explique d'abord.
      expect(transport.permissionRequested, isFalse);

      await tester.tap(find.text('Autoriser'));
      await tester.pumpAndSettle();

      expect(transport.permissionRequested, isTrue);
    });

    notificationTestWidgets('UN REFUS LAISSE L’APPLICATION UTILISABLE', (
      WidgetTester tester,
    ) async {
      // Les notifications sont un confort ; la prospection hors ligne est le
      // métier. Un refus ne doit rien bloquer, ni masquer la liste.
      final FakePushTransport transport = FakePushTransport(
        permission: PushPermission.denied,
      );
      addTearDown(transport.dispose);
      await PushInboxHelper(db).seed(message('ntf-1'));

      await tester.pumpWidget(host(transport));
      await tester.pumpAndSettle();

      expect(find.text('Notifications désactivées'), findsOneWidget);
      // La liste reste servie : c'est tout l'intérêt d'avoir persisté en local.
      expect(find.text('Appels en attente'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    notificationTestWidgets('l’absence de transport est dite franchement', (
      WidgetTester tester,
    ) async {
      final FakePushTransport transport = FakePushTransport(available: false);
      addTearDown(transport.dispose);

      await tester.pumpWidget(host(transport));
      await tester.pumpAndSettle();

      expect(find.text('Notifications indisponibles sur cet appareil'), findsOneWidget);
    });

    notificationTestWidgets('un tap marque lu et fait retomber la pastille', (
      WidgetTester tester,
    ) async {
      final FakePushTransport transport = FakePushTransport(
        permission: PushPermission.granted,
      );
      addTearDown(transport.dispose);
      await PushInboxHelper(db).seed(message('ntf-1'));

      await tester.pumpWidget(host(transport));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Appels en attente'));
      await tester.pumpAndSettle();

      final StoredNotification? row = await (db.select(
        db.notifications,
      )..where((Notifications t) => t.id.equals('ntf-1'))).getSingleOrNull();
      expect(row!.readAt, isNotNull);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('pastille de l’AppBar', () {
    Widget host() {
      return ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          pushTransportProvider.overrideWithValue(FakePushTransport()),
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
        scope.read(pushCoordinatorProvider.notifier);
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
        // démarrage à froid — le seul cas qui compte.
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
      scope.read(pushCoordinatorProvider.notifier);
      await tester.pumpAndSettle();

      transport.emitOpened(message('ntf-2', route: Routes.notifications));
      await tester.pumpAndSettle();

      expect(find.text('NOTIFICATIONS'), findsOneWidget);
    });
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
