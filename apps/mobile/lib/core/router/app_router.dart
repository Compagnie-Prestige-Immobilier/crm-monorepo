import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/about/presentation/about_screen.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/corrections/presentation/corrections_screen.dart';
import '../../features/historique/presentation/historique_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/permissions/presentation/battery_help_screen.dart';
import '../../features/phase2/presentation/phase2_screen.dart';
import '../../features/prospect/presentation/prospect_entry_screen.dart';
import '../../features/reglages/presentation/reglages_screen.dart';
import '../../features/representant/presentation/representant_form_screen.dart';
import '../../features/representant/presentation/representant_picker_screen.dart';
import '../../features/shell/app_shell.dart';
import '../providers/app_providers.dart';
import '../theme/cpi_tokens.dart';
import 'route_memory.dart';
import 'route_paths.dart';

class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authControllerProvider, (AuthState? previous, AuthState next) {
      if (previous?.status != next.status) notifyListeners();
    });
  }
}

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(
  debugLabel: 'root',
);

final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final RouteMemory memory = ref.watch(routeMemoryProvider);
  final _AuthRefreshNotifier refresh = _AuthRefreshNotifier(ref);
  ref.onDispose(refresh.dispose);

  final bool authenticated = ref.read(authControllerProvider).isAuthenticated;
  final String initial = memory.read(authenticated: authenticated) ?? Routes.home;

  final GoRouter router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: initial,
    refreshListenable: refresh,
    debugLogDiagnostics: kDebugMode,
    redirect: (BuildContext context, GoRouterState state) {
      final AuthState auth = ref.read(authControllerProvider);
      final String location = state.uri.toString();

      if (!auth.isResolved) return null;

      final bool onLogin = Routes.isPublic(location);

      if (!auth.isAuthenticated) {
        return onLogin ? null : Routes.loginWithNext(location);
      }

      if (onLogin) {
        final String? next = state.uri.queryParameters[Routes.nextParam];
        if (next == null || next.isEmpty || Routes.isPublic(next)) {
          return Routes.home;
        }
        return next;
      }

      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: Routes.login,
        name: 'login',
        builder: (BuildContext context, GoRouterState state) => const LoginScreen(),
      ),

      GoRoute(
        path: Routes.representants,
        name: 'representants',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const RepresentantPickerScreen(),
      ),
      GoRoute(
        path: Routes.newRepresentant,
        name: 'newRepresentant',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => RepresentantFormScreen(
          draftId: state.uri.queryParameters[Routes.draftParam],
          representantId: state.uri.queryParameters['id'],
          prefillName: state.uri.queryParameters[Routes.prefillNameParam],
          prefillPhone: state.uri.queryParameters[Routes.prefillPhoneParam],
        ),
      ),
      GoRoute(
        path: Routes.newProspect,
        name: 'newProspect',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProspectEntryScreen(
          representantId: state.uri.queryParameters[Routes.repParam],
          draftId: state.uri.queryParameters[Routes.draftParam],
        ),
      ),
      GoRoute(
        path: Routes.phase2,
        name: 'phase2',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => const Phase2Screen(),
      ),
      GoRoute(
        path: Routes.notifications,
        name: 'notifications',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const NotificationsScreen(),
      ),
      GoRoute(
        path: Routes.batteryHelp,
        name: 'batteryHelp',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => const BatteryHelpScreen(),
      ),
      GoRoute(
        path: Routes.about,
        name: 'about',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => const AboutScreen(),
      ),

      StatefulShellRoute.indexedStack(
        builder:
            (BuildContext context, GoRouterState state, StatefulNavigationShell shell) =>
                AppShell(shell: shell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.home,
                name: 'home',
                builder: (BuildContext context, GoRouterState state) =>
                    const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.historique,
                name: 'historique',
                builder: (BuildContext context, GoRouterState state) =>
                    const HistoriqueScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.corrections,
                name: 'corrections',
                builder: (BuildContext context, GoRouterState state) =>
                    const CorrectionsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.reglages,
                name: 'reglages',
                builder: (BuildContext context, GoRouterState state) =>
                    const ReglagesScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
    errorBuilder: (BuildContext context, GoRouterState state) =>
        _RouteNotFound(location: state.uri.toString()),
  );

  void remember() {
    final RouteMatchList config = router.routerDelegate.currentConfiguration;
    if (config.isEmpty) return;
    final String location = config.uri.toString();
    if (location.isEmpty) return;
    unawaited(memory.write(location));
  }

  router.routerDelegate.addListener(remember);
  ref.onDispose(() => router.routerDelegate.removeListener(remember));

  return router;
});

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound({required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Page introuvable')),
      body: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Cette adresse n\'existe pas.', style: theme.textTheme.titleMedium),
            const SizedBox(height: CpiSpacing.xs),
            Text(location, style: theme.textTheme.bodySmall),
            const SizedBox(height: CpiSpacing.xl),
            FilledButton(
              onPressed: () => context.go(Routes.home),
              child: const Text('Revenir à l\'accueil'),
            ),
          ],
        ),
      ),
    );
  }
}
