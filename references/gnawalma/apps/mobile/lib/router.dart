import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'config.dart';
import 'screens/atelier/clients.dart';
import 'screens/atelier/dashboard.dart';
import 'screens/atelier/orders.dart';
import 'screens/atelier/profile.dart';
import 'screens/atelier/settings.dart';
import 'screens/auth.dart';
import 'screens/client/home.dart';
import 'screens/wizard.dart';
import 'models.dart';
import 'notifications.dart';
import 'session.dart';
import 'ui.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier(0);

  late final GoRouter router;
  // Lien reçu avant l'intro ou avant la connexion : gardé, puis rejoué une fois la destination atteignable.
  String? pending;
  // La réinitialisation de code passe avant tout, même l'intro.
  bool blocked(String path) => !path.startsWith('/reinitialiser') &&
      (ref.read(introSeenProvider).value != '1' || (path.startsWith('/atelier') && ref.read(userProvider) == null));

  void follow(String? path) {
    if (path == null) return;
    blocked(path) ? pending = path : router.go(path);
  }

  void resume() {
    final path = pending;
    if (path == null || blocked(path)) return;
    pending = null;
    WidgetsBinding.instance.addPostFrameCallback((_) => router.go(path));
  }

  void changed() { refresh.value++; resume(); }
  ref.listen(sessionProvider, (_, _) => changed());
  ref.listen(introSeenProvider, (_, _) => changed());
  updateRequired.addListener(changed);
  ref.onDispose(() => updateRequired.removeListener(changed));

  void consumeNotificationTap() { follow(notificationTap.value); notificationTap.value = null; }
  // Un lancement à froid a déjà rempli notificationTap.value avant que le routeur n'existe : on le consomme après la première frame.
  WidgetsBinding.instance.addPostFrameCallback((_) => consumeNotificationTap());
  notificationTap.addListener(consumeNotificationTap);
  final links = AppLinks().uriLinkStream.map(deepLinkPath).listen(follow);
  ref.onDispose(links.cancel);
  ref.onDispose(() => notificationTap.removeListener(consumeNotificationTap));

  return router = GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      if (updateRequired.value) return state.uri.path == '/mise-a-jour' ? null : '/mise-a-jour';
      final session = ref.read(sessionProvider);
      final intro = ref.read(introSeenProvider);
      if (session.isLoading || intro.isLoading) return null;
      final path = state.uri.path;
      if (path == '/reinitialiser') return null;
      final user = session.value?.user;
      final seen = intro.value == '1';

      if (path == '/') return !seen ? '/intro' : user == null ? '/client' : user.isAtelier ? '/atelier/commandes' : '/client';
      if (!seen) return path == '/intro' ? null : '/intro';
      // Session tombée sur un écran d'atelier : l'accueil garde la destination pour y revenir après connexion.
      if (user == null) return path.startsWith('/atelier') ? '/bienvenue?next=${Uri.encodeQueryComponent(path)}' : null;
      if (user.isAtelier) {
        if (user.atelier?.completed != true) return path == '/atelier/assistant' ? null : '/atelier/assistant';
        // Lien profond vers une fiche : l'atelier la voit dans son propre aperçu.
        if (path.startsWith('/client/ateliers/')) return '/atelier/reglages/apercu/${path.split('/').last}';
        if (path == '/atelier/assistant' || path.startsWith('/client')) return '/atelier/commandes';
      } else if (path.startsWith('/atelier')) {
        return '/client';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const Scaffold()),
      GoRoute(path: '/intro', builder: (_, _) => const IntroScreen()),
      GoRoute(path: '/mise-a-jour', builder: (_, _) => const _UpdateRequired()),
      GoRoute(path: '/bienvenue', builder: (_, s) => WelcomeScreen(next: s.uri.queryParameters['next'])),
      GoRoute(path: '/connexion', builder: (_, s) => LoginScreen(next: s.uri.queryParameters['next'], initial: s.uri.queryParameters['identifiant'])),
      GoRoute(path: '/inscription', builder: (_, s) => RegisterScreen(next: s.uri.queryParameters['next'], role: s.uri.queryParameters['role'])),
      GoRoute(path: '/reinitialiser', builder: (_, s) => ResetPinScreen(email: s.uri.queryParameters['email'] ?? '', token: s.uri.queryParameters['token'] ?? '')),
      GoRoute(path: '/atelier/assistant', builder: (_, _) => const WizardScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => _Shell(shell, const [
          AppNavItem('Commandes', FIcons.receipt, FIcons.receipt),
          AppNavItem('Clients', FIcons.users, FIcons.users),
          AppNavItem('Tableau', FIcons.layoutGrid, FIcons.layoutGrid),
          AppNavItem('Réglages', FIcons.settings, FIcons.settings),
        ], atelier: true),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/atelier/commandes', builder: (_, _) => const OrdersScreen(), routes: [
            GoRoute(path: 'nouvelle', builder: (_, s) => NewOrderScreen(clientId: int.tryParse(s.uri.queryParameters['client'] ?? ''))),
            GoRoute(path: 'impayes', builder: (_, _) => const UnpaidByClientScreen()),
            GoRoute(path: ':id', builder: (_, s) => _byId(s, OrderScreen.new), routes: [
              GoRoute(path: 'modifier', builder: (_, s) => _byId(s, EditOrderScreen.new)),
            ]),
          ])]),
          StatefulShellBranch(routes: [GoRoute(path: '/atelier/clients', builder: (_, _) => const ClientsScreen(), routes: [
            GoRoute(path: 'nouveau', builder: (_, _) => const ClientFormScreen()),
            GoRoute(path: ':id', builder: (_, s) => _byId(s, ClientScreen.new), routes: [
              GoRoute(path: 'modifier', builder: (_, s) => _byId(s, (id) => ClientFormScreen(id: id))),
              GoRoute(path: 'beneficiaires/nouveau', builder: (_, s) => _byId(s, (id) => BeneficiaryFormScreen(clientId: id))),
              GoRoute(path: 'beneficiaires/:bid', builder: (_, s) {
                final bid = _id(s, 'bid');
                return bid == null ? const _InvalidLink() : _byId(s, (id) => BeneficiaryFormScreen(clientId: id, id: bid));
              }),
            ]),
          ])]),
          StatefulShellBranch(routes: [GoRoute(path: '/atelier/tableau', builder: (_, _) => const DashboardScreen(), routes: [
            GoRoute(path: 'demandes', builder: (_, _) => const RequestsScreen()),
          ])]),
          StatefulShellBranch(routes: [GoRoute(path: '/atelier/reglages', builder: (_, _) => const SettingsScreen(), routes: [
            GoRoute(path: 'profil', builder: (_, _) => const ProfileScreen()),
            GoRoute(path: 'code', builder: (_, _) => const ChangePinScreen()),
            GoRoute(path: 'apercu/:id', builder: (_, s) => _byId(s, AtelierScreen.new)),
          ])]),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => _Shell(shell, const [
          AppNavItem('Accueil', FIcons.house, FIcons.house),
          AppNavItem('Favoris', FIcons.heart, FIcons.heart),
          AppNavItem('Activité', FIcons.history, FIcons.history),
          AppNavItem('Profil', FIcons.user, FIcons.user),
        ]),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/client', builder: (_, _) => const ClientHomeScreen(), routes: [
            GoRoute(path: 'recherche', builder: (_, s) => SearchScreen(query: s.uri.queryParameters['q'], specialty: s.uri.queryParameters['specialite'], region: s.uri.queryParameters['region'])),
            GoRoute(path: 'carte', builder: (_, _) => const MapScreen()),
            GoRoute(path: 'ateliers/:id', builder: (_, s) => _byId(s, (id) => AtelierScreen(id, initial: s.extra as Atelier?))),
          ])]),
          StatefulShellBranch(routes: [GoRoute(path: '/client/favoris', builder: (_, _) => const FavoritesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/client/activite', builder: (_, _) => const ActivityScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/client/profil', builder: (_, _) => const ClientProfileScreen(), routes: [
            GoRoute(path: 'code', builder: (_, _) => const ChangePinScreen()),
          ])]),
        ],
      ),
    ],
  );
});

int? _id(GoRouterState s, [String key = 'id']) => int.tryParse(s.pathParameters[key] ?? '');

/// Un identifiant d'URL malformé ne doit jamais faire planter l'écran ouvert par un lien.
Widget _byId(GoRouterState s, Widget Function(int id) build) {
  final id = _id(s);
  return id == null ? const _InvalidLink() : build(id);
}

class _InvalidLink extends StatelessWidget {
  const _InvalidLink();
  @override
  Widget build(BuildContext context) => AppScaffold(body: AppState(
    kind: AppStateKind.error, title: 'Lien invalide', message: 'Ce lien ne mène à rien. Revenez à l\'accueil pour continuer.',
    actionLabel: 'Aller à l\'accueil', onAction: () => context.go('/'),
  ));
}

class _UpdateRequired extends StatelessWidget {
  const _UpdateRequired();
  @override
  Widget build(BuildContext context) => AppScaffold(body: AppState(
    kind: AppStateKind.error, title: 'Mettez à jour Gnawalma',
    message: 'Cette version n\'est plus prise en charge. Installez la dernière pour continuer.',
    actionLabel: 'Ouvrir le Play Store', onAction: () => launchUrl(Uri.parse(playStoreUrl), mode: LaunchMode.externalApplication),
  ));
}

final _atelierLink = RegExp(r'^/(?:a|atelier)/(\d+)$');

// Accepte https://hote/reinitialiser?…, gnawalma://reinitialiser?…, https://hote/a/12 et gnawalma://atelier/12.
String? deepLinkPath(Uri uri) {
  final path = uri.scheme == 'gnawalma' ? '/${uri.host}${uri.path}' : uri.path;
  final atelier = _atelierLink.firstMatch(path);
  if (atelier != null) return '/client/ateliers/${atelier[1]}';
  if (path != '/reinitialiser') return null;
  return uri.hasQuery ? '$path?${uri.query}' : path;
}

class _Shell extends ConsumerWidget {
  const _Shell(this.shell, this.items, {this.atelier = false});
  final StatefulNavigationShell shell;
  final List<AppNavItem> items;
  final bool atelier;

  Widget _bar(List<AppNavItem> items) => AppNavBar(items: items, index: shell.currentIndex, onTap: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = atelier && ref.watch(userProvider)?.isAtelier == true ? dashboardProvider(ref) : null;
    return Scaffold(
      extendBody: true,
      body: shell,
      // Les demandes en attente se voient depuis n'importe quel onglet.
      bottomNavigationBar: board == null
        ? _bar(items)
        : board.watch((d, _) {
            final pending = d == null ? 0 : (d['pending_requests'] as num?)?.toInt() ?? 0;
            return _bar([for (final (i, it) in items.indexed) i == 2 ? it.withBadge(pending) : it]);
          }),
    );
  }
}
