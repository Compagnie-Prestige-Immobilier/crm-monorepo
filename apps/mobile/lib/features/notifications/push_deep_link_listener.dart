import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../auth/auth_state.dart';
import 'notifications_controller.dart';

/// Rejoue la route d'une notification, **après** que le garde a tranché.
///
/// ═══ POURQUOI CE N'EST PAS UN SIMPLE `context.go()` À LA RÉCEPTION ═══
///
/// Au démarrage à froid, `getInitialMessage()` rend le message AVANT que la
/// lecture du jeton de renouvellement n'ait donné son verdict. Naviguer à cet
/// instant est sans effet : dès que le garde résout, sa redirection écrase la
/// destination. C'est très exactement ainsi qu'un lien profond « marche quand
/// l'application est déjà ouverte » et se perd au démarrage à froid — le seul
/// cas qui compte, puisque c'est celui d'une notification tapée depuis l'écran
/// de verrouillage.
///
/// Ce widget draine le sas sur deux signaux : l'arrivée d'une route, et le
/// changement d'état d'authentification.
///
/// **Il navigue par `routerProvider`, PAS par `GoRouter.of(context)`.** Le
/// `builder` de `MaterialApp.router` s'applique AU-DESSUS du `Router`, donc
/// au-dessus de l'`InheritedGoRouter` : `GoRouter.of(context)` y échoue. C'est
/// un piège discret — le widget se monte, se construit, et seule la navigation
/// ne se produit jamais. Lire l'instance dans le conteneur Riverpod, qui est
/// exactement celle passée à `routerConfig`, contourne la question.
///
/// La route survit à la CONNEXION : appuyer sur une notification, saisir son
/// mot de passe et atterrir sur l'accueil au lieu de la fiche annoncée serait
/// le même échec, en deux temps.
class PushDeepLinkListener extends ConsumerStatefulWidget {
  const PushDeepLinkListener({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<PushDeepLinkListener> createState() => _PushDeepLinkListenerState();
}

class _PushDeepLinkListenerState extends ConsumerState<PushDeepLinkListener> {
  bool _navigating = false;

  @override
  Widget build(BuildContext context) {
    ref.listen<PendingPushRoute?>(pendingPushRouteProvider, (
      PendingPushRoute? previous,
      PendingPushRoute? next,
    ) {
      if (next != null) _drain();
    });

    ref.listen<AuthState>(authControllerProvider, (AuthState? previous, AuthState next) {
      if (next.isAuthenticated) _drain();
    });

    // Cas du démarrage à froid où la route est déjà là au premier cadre : les
    // deux `listen` ci-dessus ne se déclenchent que sur un CHANGEMENT, et une
    // valeur déjà posée n'en est pas un.
    _drain();

    return widget.child;
  }

  void _drain() {
    if (_navigating) return;

    final AuthState auth = ref.read(authControllerProvider);
    // Tant que le verdict n'est pas rendu, on ne touche à rien : rediriger sur
    // `unknown` déconnecterait visuellement l'utilisateur à chaque démarrage.
    if (!auth.isResolved || !auth.isAuthenticated) return;

    final PendingPushRoute? pending = ref.read(pendingPushRouteProvider);
    if (pending == null) return;

    _navigating = true;
    // Après le cadre courant : `_drain` peut être appelé depuis `build`, et
    // naviguer pendant une construction lève. Le cadre suivant laisse aussi la
    // redirection du garde se poser d'abord, ce qui garantit que notre `go`
    // arrive en dernier — c'est tout l'objet de ce widget.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigating = false;
      if (!mounted) return;
      final PendingPushRoute? route = ref.read(pendingPushRouteProvider.notifier).take();
      if (route == null) return;
      ref.read(routerProvider).go(route.route);
    });
  }
}
