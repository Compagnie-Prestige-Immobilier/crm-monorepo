import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/about/presentation/about_screen.dart';
import '../../features/accueil/presentation/registre_screen.dart';
import '../../features/accueil/presentation/visite_form_screen.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/corrections/presentation/corrections_screen.dart';
import '../../features/historique/presentation/historique_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/permissions/presentation/battery_help_screen.dart';
import '../../features/campagnes/campagnes.dart';
import '../../features/campagnes/presentation/campagne_file_screen.dart';
import '../../features/campagnes/presentation/campagnes_screen.dart';
import '../../features/phase2/presentation/phase2_screen.dart';
import '../../features/prospect/presentation/prospect_entry_screen.dart';
import '../../features/reglages/presentation/reglages_screen.dart';
import '../../features/representant/presentation/representant_detail_screen.dart';
import '../../features/representant/presentation/representant_form_screen.dart';
import '../../features/representant/presentation/representant_picker_screen.dart';
import '../../features/shell/app_shell.dart';
import '../../features/shell/grand_public_screen.dart';
import '../../features/shell/hub_screen.dart';
import '../../features/shell/projects.dart';
import '../providers/app_providers.dart';
import '../theme/cpi_tokens.dart';
import 'route_memory.dart';
import 'route_paths.dart';

class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authControllerProvider, (
      AuthState? previous,
      AuthState next,
    ) {
      if (previous?.status != next.status) notifyListeners();
    });
  }
}

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(
  debugLabel: 'root',
);

GoRouterWidgetBuilder _chues(Widget Function(GoRouterState state) screen) {
  return (BuildContext context, GoRouterState state) =>
      ProjectScope(project: CpiProject.chues, child: screen(state));
}

final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final RouteMemory memory = ref.watch(routeMemoryProvider);
  final _AuthRefreshNotifier refresh = _AuthRefreshNotifier(ref);
  ref.onDispose(refresh.dispose);

  final bool authenticated = ref.read(authControllerProvider).isAuthenticated;
  final String initial =
      memory.read(authenticated: authenticated) ?? Routes.home;

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
        builder: (BuildContext context, GoRouterState state) =>
            const LoginScreen(),
      ),

      GoRoute(
        path: Routes.home,
        name: 'hub',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const HubScreen(),
      ),
      GoRoute(
        path: Routes.accueil,
        name: 'accueil',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const ProjectScope(
              project: CpiProject.accueil,
              child: RegistreScreen(),
            ),
      ),
      GoRoute(
        path: Routes.accueilVisiteNew,
        name: 'accueilVisiteNew',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProjectScope(
          project: CpiProject.accueil,
          child: VisiteFormScreen(
            draftId: state.uri.queryParameters[Routes.draftParam],
          ),
        ),
      ),
      GoRoute(
        path: Routes.grandPublicNew,
        name: 'grandPublicNew',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProjectScope(
          project: CpiProject.grandPublic,
          child: ProspectEntryScreen(
            projet: 'GRAND_PUBLIC',
            draftId: state.uri.queryParameters[Routes.draftParam],
          ),
        ),
      ),
      GoRoute(
        path: CampagnesRoutes.grandPublicListe,
        name: 'grandPublicCampagnes',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const ProjectScope(
              project: CpiProject.grandPublic,
              child: CampagnesScreen(grandPublic: true),
            ),
      ),
      GoRoute(
        path: CampagnesRoutes.grandPublicFile,
        name: 'grandPublicCampagneFile',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProjectScope(
          project: CpiProject.grandPublic,
          child: CampagneFileScreen(
            campaignId: state.pathParameters[CampagnesRoutes.idParam] ?? '',
            grandPublic: true,
          ),
        ),
      ),
      GoRoute(
        path: CampagnesRoutes.grandPublicConsole,
        name: 'grandPublicConsole',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProjectScope(
          project: CpiProject.grandPublic,
          child: Phase2Screen(
            prefillPhone: state.uri.queryParameters[Routes.prefillPhoneParam],
          ),
        ),
      ),
      GoRoute(
        path: Routes.grandPublic,
        name: 'grandPublic',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const ProjectScope(
              project: CpiProject.grandPublic,
              child: GrandPublicScreen(),
            ),
      ),

      GoRoute(
        path: Routes.representants,
        name: 'representants',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => const RepresentantPickerScreen(),
        ),
      ),
      GoRoute(
        path: Routes.newRepresentant,
        name: 'newRepresentant',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => RepresentantFormScreen(
            draftId: state.uri.queryParameters[Routes.draftParam],
            representantId: state.uri.queryParameters['id'],
            prefillName: state.uri.queryParameters[Routes.prefillNameParam],
            prefillPhone: state.uri.queryParameters[Routes.prefillPhoneParam],
          ),
        ),
      ),
      // Après `newRepresentant` : go_router essaie les routes dans l'ordre, et
      // `:id` avalerait `/representants/nouveau`.
      GoRoute(
        path: Routes.representantDetail,
        name: 'representantDetail',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => RepresentantDetailScreen(
            representantId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: Routes.newProspect,
        name: 'newProspect',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => ProspectEntryScreen(
            representantId: state.uri.queryParameters[Routes.repParam],
            draftId: state.uri.queryParameters[Routes.draftParam],
          ),
        ),
      ),
      GoRoute(
        path: Routes.phase2,
        name: 'phase2',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => Phase2Screen(
            prefillPhone: state.uri.queryParameters[Routes.prefillPhoneParam],
          ),
        ),
      ),
      GoRoute(
        path: CampagnesRoutes.liste,
        name: 'campagnes',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues((GoRouterState state) => const CampagnesScreen()),
      ),
      GoRoute(
        path: CampagnesRoutes.file,
        name: 'campagneFile',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => CampagneFileScreen(
            campaignId: state.pathParameters[CampagnesRoutes.idParam] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: Routes.notifications,
        name: 'notifications',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues((GoRouterState state) => const NotificationsScreen()),
      ),
      GoRoute(
        path: Routes.batteryHelp,
        name: 'batteryHelp',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues((GoRouterState state) => const BatteryHelpScreen()),
      ),
      GoRoute(
        path: Routes.about,
        name: 'about',
        parentNavigatorKey: _rootNavigatorKey,
        builder: _chues((GoRouterState state) => const AboutScreen()),
      ),

      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell shell,
            ) => ProjectScope(
              project: CpiProject.chues,
              child: AppShell(shell: shell),
            ),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.chues,
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
            Text(
              'Cette adresse n\'existe pas.',
              style: theme.textTheme.titleMedium,
            ),
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
