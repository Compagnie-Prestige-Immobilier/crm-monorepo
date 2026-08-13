import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'route_paths.dart';

/// Retour arrière qui aboutit **toujours**.
///
/// ## Le bug que ce fichier ferme
///
/// Les écrans pleine page (`/phase2`, les formulaires, les autorisations) sont
/// des routes de premier niveau. Tant qu'on y arrivait par `context.go`, la
/// pile de navigation était **remplacée** : il ne restait qu'une seule route,
/// donc `Navigator.maybePop` ne pouvait rien dépiler, la flèche de l'AppBar
/// n'avait aucun effet et le geste système sortait de l'application. C'est
/// exactement ce qui a été signalé sur Phase 2.
///
/// Le correctif tient en deux moitiés, et il faut les deux :
///
/// 1. **`context.push` à l'aller.** `go` remplace la pile, `push` l'empile.
/// 2. **Une destination de repli au retour.** Même avec `push`, une route peut
///    être la première de la pile : au démarrage à froid, la mémoire de route
///    restaure directement `/phase2` en `initialLocation`. Il n'y a alors rien
///    à dépiler, et il ne doit pas pour autant être impossible de revenir.
///    [popOrHome] retombe sur l'accueil.
void popOrHome(BuildContext context, {String fallback = Routes.home}) {
  final GoRouter router = GoRouter.of(context);
  if (router.canPop()) {
    router.pop();
    return;
  }
  router.go(fallback);
}

/// Flèche de retour de l'AppBar.
///
/// À utiliser sur tout écran hors coque de navigation. Elle ne se contente pas
/// de `maybePop` : voir [popOrHome].
class CpiBackButton extends StatelessWidget {
  const CpiBackButton({super.key, this.fallback = Routes.home, this.tooltip = 'Retour'});

  final String fallback;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(PhosphorIconsRegular.arrowLeft),
      tooltip: tooltip,
      onPressed: () => popOrHome(context, fallback: fallback),
    );
  }
}

/// Rend le **geste système** aussi fiable que la flèche.
///
/// `PopScope(canPop: false)` intercepte le retour quand la pile est vide et
/// redirige au lieu de laisser Android fermer l'application. Quand la pile
/// contient quelque chose, on laisse le comportement natif faire son travail :
/// l'animation de retour prédictif d'Android 14+ en dépend.
class CpiPopScope extends StatelessWidget {
  const CpiPopScope({
    super.key,
    required this.child,
    this.fallback = Routes.home,
  });

  final Widget child;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final bool canPop = GoRouter.of(context).canPop();
    return PopScope<Object?>(
      canPop: canPop,
      onPopInvokedWithResult: (bool didPop, Object? _) {
        if (didPop) return;
        popOrHome(context, fallback: fallback);
      },
      child: child,
    );
  }
}
