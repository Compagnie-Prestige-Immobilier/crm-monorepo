import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/navigation/app_nav_bar.dart';

/// Atelier workspace shell.
///
/// Four destinations: le tableau, les commandes, les clients et le reste.
class ShellView extends StatelessWidget {
  const ShellView({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = <AppNavItem>[
    AppNavItem(
      icon: Icons.grid_view_outlined,
      activeIcon: Icons.grid_view_rounded,
      label: 'Tableau',
    ),
    AppNavItem(
      icon: Icons.receipt_long_outlined,
      activeIcon: Icons.receipt_long_rounded,
      label: 'Commandes',
    ),
    AppNavItem(
      icon: Icons.people_outline_rounded,
      activeIcon: Icons.people_rounded,
      label: 'Clients',
    ),
    AppNavItem(
      icon: Icons.more_horiz_rounded,
      activeIcon: Icons.more_horiz_rounded,
      label: 'Plus',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    // The atelier accent is installed above the router (see `main.dart`), not
    // here — a shell-scoped Theme leaves every pushed route on the fallback
    // palette. No screen needs to know which space it is in; they read
    // `context.accentColor`.
    return PopScope(
      // System back (and iOS edge swipe at shell level) returns to the first
      // destination before exiting the app, per platform navigation guidance.
      canPop: navigationShell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) navigationShell.goBranch(0);
      },
      child: Scaffold(
        // The bar occupies its own space rather than floating over the page,
        // so branches no longer need a synthetic bottom inset to clear it and
        // nothing can end up hidden underneath.
        body: navigationShell,
        bottomNavigationBar: AppNavBar(
          items: _destinations,
          currentIndex: navigationShell.currentIndex,
          onSelected: (index) {
            navigationShell.goBranch(
              index,
              // Tapping the destination you are already on returns it to its
              // root, which is the behaviour users expect from a tab bar.
              initialLocation: index == navigationShell.currentIndex,
            );
          },
        ),
      ),
    );
  }
}
