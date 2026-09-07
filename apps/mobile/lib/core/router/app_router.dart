import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/about/presentation/about_screen.dart';
import '../../features/accueil/presentation/chiffres_screen.dart';
import '../../features/accueil/presentation/registre_screen.dart';
import '../../features/accueil/presentation/visite_form_screen.dart';
import '../../features/auth/auth_state.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/contacts/presentation/mes_contacts_screen.dart';
import '../../features/corrections/presentation/corrections_screen.dart';
import '../../features/diagnostic/presentation/diagnostic_android_screen.dart';
import '../../features/historique/presentation/historique_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/permissions/presentation/battery_help_screen.dart';
import '../../features/phase2/presentation/phase2_screen.dart';
import '../../features/prospect/presentation/prospect_detail_screen.dart';
import '../../features/prospect/presentation/prospect_entry_screen.dart';
import '../../features/rappels/presentation/rappels_screen.dart';
import '../../features/reglages/presentation/reglages_screen.dart';
import '../../features/representant/presentation/representant_detail_screen.dart';
import '../../features/representant/presentation/representant_form_screen.dart';
import '../../features/representant/presentation/representant_picker_screen.dart';
import '../../features/representant/presentation/representant_qualification_screen.dart';
import '../../features/shell/app_shell.dart';
import '../../features/shell/grand_public_fiches_screen.dart';
import '../../features/shell/grand_public_screen.dart';
import '../../features/shell/hub_screen.dart';
import '../../features/shell/projects.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../providers/app_providers.dart';
import '../theme/cpi_tokens.dart';
import 'route_guard.dart';
import 'route_memory.dart';
import 'route_paths.dart';

class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen<AuthState>(authControllerProvider, (
      AuthState? previous,
      AuthState next,
    ) {
      if (previous?.status != next.status) notifyListeners();
    });
    // La fiche tenue est lue en base, donc APRÈS la première trame : sans ce
    // réveil, le démarrage resterait sur l'écran mémorisé. Le réveil attend la
    // fin de la trame : la qualification ferme la fiche PENDANT le `pop` de
    // son écran, et relancer le routeur à cet instant rebâtit le Navigator
    // verrouillé.
    ref.listen<AsyncValue<String?>>(routeFicheTenueProvider, (
      AsyncValue<String?>? previous,
      AsyncValue<String?> next,
    ) {
      if (previous?.value == next.value) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_disposed) notifyListeners();
      });
    });
  }

  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

/// Publique pour ce qui doit ouvrir une feuille SANS être sous le `Router` :
/// `RepCallbackDueListener` coiffe l'application entière et n'a donc aucun
/// `Navigator` au-dessus de lui.
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>(
  debugLabel: 'root',
);

/// EB-08 : la fiche tenue, quand la route demandée n'est pas la sienne. C'est
/// elle que le démarrage rouvre, et elle qu'aucune autre route ne quitte.
///
/// Seul le CHEMIN compte : la fiche d'un prospect porte son numéro en
/// paramètre, et le réécrire à chaque passage relancerait sa recherche. Un rôle
/// qui n'a plus le droit de l'ouvrir n'y est pas renvoyé : le garde la
/// rejetterait, et les deux règles se renverraient la balle sans fin.
String? _ficheARouvrir(Ref ref, String demande, String? role) {
  final String? fiche = ref.read(routeFicheTenueProvider).value;
  if (fiche == null) return null;
  final String chemin = Uri.parse(fiche).path;
  if (chemin == demande || !RouteGuard.autorise(chemin, role)) return null;
  return fiche;
}

GoRouterWidgetBuilder _chues(Widget Function(GoRouterState state) screen) {
  return (BuildContext context, GoRouterState state) =>
      ProjectScope(project: CpiProject.chues, child: screen(state));
}

final Provider<GoRouter> routerProvider = Provider<GoRouter>((Ref ref) {
  final RouteMemory memory = ref.watch(routeMemoryProvider);
  final _RouterRefreshNotifier refresh = _RouterRefreshNotifier(ref);
  ref.onDispose(refresh.dispose);

  final AuthState depart = ref.read(authControllerProvider);
  final String initial =
      memory.read(authenticated: depart.isAuthenticated, role: depart.role) ??
      Routes.home;

  bool vivant = true;
  ref.onDispose(() => vivant = false);

  // Le refus se pose APRÈS la trame : `redirect` tourne pendant la
  // construction du routeur, et écrire un état Riverpod là relance la trame en
  // cours.
  void annoncerLeRefus() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (vivant) ref.read(accesRefuseProvider.notifier).poser();
    });
  }

  final RouteGuard guard = RouteGuard(
    role: () => ref.read(authControllerProvider).role,
    onRefus: annoncerLeRefus,
  );

  final GoRouter router = GoRouter(
    navigatorKey: rootNavigatorKey,
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

      final String? fiche = _ficheARouvrir(ref, state.uri.path, auth.role);
      if (fiche != null) return fiche;

      // Un rôle qui n'ouvre qu'un projet n'a rien à choisir : le hub lui
      // demandait un geste de plus pour une seule porte. Le compte d'accueil
      // arrive donc sur son registre. Une route mémorisée, elle, n'est pas
      // « / » : elle passe avant et n'est pas détournée.
      if (state.uri.path == Routes.home) {
        final String porte = RouteGuard.atterrissage(auth.role);
        return porte == Routes.home ? null : porte;
      }

      // Le projet fermé au rôle ne s'ouvre par aucun chemin : ni une route
      // mémorisée d'une session précédente, ni le lien d'une notification.
      // Sans ce garde-fou, un compte d'accueil se retrouvait dans les onglets
      // du CHUES sur un simple `router.go`.
      if (!RouteGuard.autorise(state.uri.path, auth.role)) {
        annoncerLeRefus();
        return guard.repli(auth.role);
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
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const HubScreen(),
      ),
      // La coque de l'accueil. « À corriger » et « Réglages » y sont aussi :
      // c'est dans Réglages que vit la déconnexion, et un compte d'accueil
      // n'ouvre aucun autre projet où aller la chercher.
      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell shell,
            ) => AppShell(shell: shell, project: CpiProject.accueil),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.accueil,
                name: 'accueil',
                builder: (BuildContext context, GoRouterState state) =>
                    const RegistreScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.accueilChiffres,
                name: 'accueilChiffres',
                builder: (BuildContext context, GoRouterState state) =>
                    const ChiffresScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.accueilCorrections,
                name: 'accueilCorrections',
                builder: (BuildContext context, GoRouterState state) =>
                    const CorrectionsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.accueilReglages,
                name: 'accueilReglages',
                builder: (BuildContext context, GoRouterState state) =>
                    const ReglagesScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: Routes.accueilVisiteNew,
        name: 'accueilVisiteNew',
        parentNavigatorKey: rootNavigatorKey,
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
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProjectScope(
          project: CpiProject.grandPublic,
          child: ProspectEntryScreen(
            projet: 'GRAND_PUBLIC',
            draftId: state.uri.queryParameters[Routes.draftParam],
          ),
        ),
      ),
      GoRoute(
        path: Routes.grandPublicRappels,
        name: 'grandPublicRappels',
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const ProjectScope(
              project: CpiProject.grandPublic,
              child: RappelsScreen(grandPublic: true),
            ),
      ),
      GoRoute(
        path: Routes.rappels,
        name: 'rappels',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues((GoRouterState state) => const RappelsScreen()),
      ),
      GoRoute(
        path: Routes.grandPublicCorrections,
        name: 'grandPublicCorrections',
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            const ProjectScope(
              project: CpiProject.grandPublic,
              child: CorrectionsScreen(),
            ),
      ),
      GoRoute(
        path: Routes.corrections,
        name: 'corrections',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues((GoRouterState state) => const CorrectionsScreen()),
      ),
      GoRoute(
        path: '/grand-public/phase2',
        name: 'grandPublicConsole',
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) => ProjectScope(
          project: CpiProject.grandPublic,
          child: Phase2Screen(
            prefillPhone: state.uri.queryParameters[Routes.prefillPhoneParam],
          ),
        ),
      ),
      // Le Grand Public a sa propre coque à onglets : « À corriger » et
      // « Réglages » sont globaux, mais un onglet qui sauterait dans la coque
      // CHUES ferait changer de projet sans le dire.
      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell shell,
            ) => AppShell(shell: shell, project: CpiProject.grandPublic),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.grandPublic,
                name: 'grandPublic',
                builder: (BuildContext context, GoRouterState state) =>
                    const GrandPublicScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.grandPublicFiches,
                name: 'grandPublicFiches',
                builder: (BuildContext context, GoRouterState state) =>
                    const GrandPublicFichesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.grandPublicMesContacts,
                name: 'grandPublicMesContacts',
                builder: (BuildContext context, GoRouterState state) =>
                    const MesContactsScreen(grandPublic: true),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: Routes.grandPublicReglages,
                name: 'grandPublicReglages',
                builder: (BuildContext context, GoRouterState state) =>
                    const ReglagesScreen(),
              ),
            ],
          ),
        ],
      ),

      GoRoute(
        path: Routes.representants,
        name: 'representants',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => RepresentantPickerScreen(
            pourQualifier:
                state.uri.queryParameters[Routes.butParam] ==
                Routes.butQualifier,
          ),
        ),
      ),
      GoRoute(
        path: Routes.newRepresentant,
        name: 'newRepresentant',
        parentNavigatorKey: rootNavigatorKey,
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
        path: Routes.representantQualification,
        name: 'representantQualification',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => RepresentantQualificationScreen(
            representantId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: Routes.representantDetail,
        name: 'representantDetail',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => RepresentantDetailScreen(
            representantId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: Routes.newProspect,
        name: 'newProspect',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => ProspectEntryScreen(
            representantId: state.uri.queryParameters[Routes.repParam],
            draftId: state.uri.queryParameters[Routes.draftParam],
          ),
        ),
      ),
      // Après `newProspect` : `:id` avalerait `/prospects/nouveau`. Hors
      // `ProjectScope` : la fiche choisit sa palette sur le projet du prospect.
      GoRoute(
        path: Routes.prospectDetail,
        name: 'prospectDetail',
        parentNavigatorKey: rootNavigatorKey,
        builder: (BuildContext context, GoRouterState state) =>
            ProspectDetailScreen(prospectId: state.pathParameters['id'] ?? ''),
      ),
      GoRoute(
        path: Routes.phase2,
        name: 'phase2',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => Phase2Screen(
            prefillPhone: state.uri.queryParameters[Routes.prefillPhoneParam],
          ),
        ),
      ),
      GoRoute(
        path: Routes.notifications,
        name: 'notifications',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues((GoRouterState state) => const NotificationsScreen()),
      ),
      GoRoute(
        path: Routes.batteryHelp,
        name: 'batteryHelp',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues((GoRouterState state) => const BatteryHelpScreen()),
      ),
      GoRoute(
        path: Routes.diagnosticAndroid,
        name: 'diagnosticAndroid',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues(
          (GoRouterState state) => const DiagnosticAndroidScreen(),
        ),
      ),
      GoRoute(
        path: Routes.about,
        name: 'about',
        parentNavigatorKey: rootNavigatorKey,
        builder: _chues((GoRouterState state) => const AboutScreen()),
      ),

      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell shell,
            ) => AppShell(shell: shell, project: CpiProject.chues),
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
                path: Routes.mesContacts,
                name: 'mesContacts',
                builder: (BuildContext context, GoRouterState state) =>
                    const MesContactsScreen(),
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
    // Une adresse que le rôle n'a pas le droit d'ouvrir ne se mémorise pas :
    // elle reviendrait au lancement suivant, et la fuite se rejouerait seule.
    final String? role = ref.read(authControllerProvider).role;
    if (!RouteGuard.autorise(config.uri.path, role)) return;
    unawaited(memory.write(location));
  }

  router.routerDelegate.addListener(remember);
  ref.onDispose(() => router.routerDelegate.removeListener(remember));

  guard.attacher(router);
  router.routerDelegate.addListener(guard.verifier);
  ref.onDispose(() => router.routerDelegate.removeListener(guard.verifier));

  // La toute première adresse n'émet aucun changement : sans ce contrôle-ci,
  // une adresse restaurée ne passerait que par `redirect`.
  WidgetsBinding.instance.addPostFrameCallback((_) {
    if (vivant) guard.verifier();
  });

  // Le rôle peut changer sous les pieds : jeton rafraîchi, rétrogradation
  // décidée côté serveur. `redirect` ne rejoue pas tout seul pour ça.
  ref.listen<AuthState>(authControllerProvider, (
    AuthState? previous,
    AuthState next,
  ) {
    if (previous?.role != next.role) guard.verifier();
  });

  return router;
});

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound({required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return CpiScaffold(
      title: 'Page introuvable',
      body: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // L'adresse ne dit rien à qui lit l'écran ; elle reste pour le
            // support, qui la lira au lecteur d'écran ou au rapport de bogue.
            Semantics(
              label: 'Cette page n\'existe plus. Adresse demandée : $location',
              excludeSemantics: true,
              child: Text(
                'Cette page n\'existe plus.',
                style: theme.textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: CpiSpacing.xl),
            CpiButton(
              'Revenir à l\'accueil',
              onPressed: () => context.go(Routes.home),
            ),
          ],
        ),
      ),
    );
  }
}
