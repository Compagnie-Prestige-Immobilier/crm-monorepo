import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../auth/auth_state.dart';
import 'notifications_controller.dart';

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

    _drain();

    return widget.child;
  }

  void _drain() {
    if (_navigating) return;

    final AuthState auth = ref.read(authControllerProvider);
    if (!auth.isResolved || !auth.isAuthenticated) return;

    final PendingPushRoute? pending = ref.read(pendingPushRouteProvider);
    if (pending == null) return;

    _navigating = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigating = false;
      if (!mounted) return;
      final PendingPushRoute? route = ref.read(pendingPushRouteProvider.notifier).take();
      if (route == null) return;

      final GoRouter router = ref.read(routerProvider);
      if (router.routerDelegate.currentConfiguration.matches.length <= 1) {
        router.go(route.route);
      } else {
        router.push(route.route);
      }
    });
  }
}
