import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import 'route_paths.dart';

void popOrHome(BuildContext context, {String fallback = Routes.home}) {
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router == null) {
    Navigator.of(context).maybePop();
    return;
  }
  if (router.canPop()) {
    router.pop();
    return;
  }
  router.go(fallback);
}

bool _canPopHere(BuildContext context) {
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router != null) return router.canPop();
  return Navigator.of(context).canPop();
}

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

class CpiPopScope extends StatelessWidget {
  const CpiPopScope({super.key, required this.child, this.fallback = Routes.home});

  final Widget child;
  final String fallback;

  @override
  Widget build(BuildContext context) {
    final bool canPop = _canPopHere(context);
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
