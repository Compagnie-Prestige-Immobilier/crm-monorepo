import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

abstract final class SinglePush {
  static const Duration cooldown = Duration(milliseconds: 700);

  static DateTime Function() now = DateTime.now;

  static String? _lastTarget;
  static DateTime? _lastAt;

  static void reset() {
    _lastTarget = null;
    _lastAt = null;
  }

  static bool shouldNavigate(String target, {String? currentLocation}) {
    if (currentLocation != null && currentLocation == target) return false;
    final DateTime at = now();
    final DateTime? previous = _lastAt;
    if (_lastTarget == target &&
        previous != null &&
        at.difference(previous) < cooldown) {
      return false;
    }
    _lastTarget = target;
    _lastAt = at;
    return true;
  }
}

extension SinglePushX on BuildContext {
  void pushOnce(String location) {
    final GoRouter router = GoRouter.of(this);
    final String current = router.routerDelegate.currentConfiguration.uri
        .toString();
    if (!SinglePush.shouldNavigate(location, currentLocation: current)) return;
    router.push<Object?>(location).ignore();
  }
}
