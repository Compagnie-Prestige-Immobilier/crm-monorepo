import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../theme/forui_theme.dart';
import 'route_paths.dart';

void popOrHome(BuildContext context, {String fallback = Routes.home}) {
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router == null) {
    // `maybePop` redemanderait son avis au `PopScope` qui vient de nous
    // appeler, qui rappellerait `popOrHome` : l'écran se fige.
    final NavigatorState navigator = Navigator.of(context);
    if (navigator.canPop()) navigator.pop();
    return;
  }
  if (router.canPop()) {
    router.pop();
    return;
  }
  router.go(fallback);
}

bool canPopHere(BuildContext context) {
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router != null) return router.canPop();
  return Navigator.maybeOf(context)?.canPop() ?? false;
}

class CpiBackButton extends StatelessWidget {
  const CpiBackButton({
    super.key,
    this.fallback = Routes.home,
    this.tooltip = 'Retour',
  });

  final String fallback;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    // Sans `container`, la coquille fusionne dans le nœud du `FHeader` : le
    // bandeau entier se faisait appeler « Retour » et le vrai bouton n'exposait
    // plus que `focus` (WCAG 4.1.2, 2.4.4).
    return MergeSemantics(
      child: Semantics(
        container: true,
        button: true,
        label: tooltip,
        tooltip: tooltip,
        onTap: () => popOrHome(context, fallback: fallback),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minWidth: kCpiHeaderActionSize,
            minHeight: kCpiHeaderActionSize,
          ),
          child: FButton.icon(
            variant: FButtonVariant.ghost,
            onPress: () => popOrHome(context, fallback: fallback),
            child: const Icon(PhosphorIconsRegular.arrowLeft),
          ),
        ),
      ),
    );
  }
}

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
    final bool canPop = canPopHere(context);
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
