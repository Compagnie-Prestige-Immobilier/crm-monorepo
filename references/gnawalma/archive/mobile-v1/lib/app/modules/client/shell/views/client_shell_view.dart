import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/location/location_service.dart';
import '../../../../shared/widgets/navigation/app_nav_bar.dart';

/// Client workspace shell.
///
/// Five destinations. `Rechercher` used to be one of them; search is now a
/// persistent field at the top of `Accueil` that pushes its own results screen.
/// A search tab makes finding something a place you navigate to; a search field
/// makes it the first thing on the page.
///
/// This shell also used to run on an `IndexedStack` driven by `setState`, while
/// the atelier shell ran on `StatefulShellRoute` — so the two spaces did not
/// merely look different, they had different back-stack semantics. Both are on
/// the router now.
class ClientShellView extends ConsumerStatefulWidget {
  const ClientShellView({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<ClientShellView> createState() => _ClientShellViewState();
}

class _ClientShellViewState extends ConsumerState<ClientShellView> {
  @override
  void initState() {
    super.initState();
    // Reprend une autorisation déjà accordée sans rien demander : la demande
    // reste un geste explicite, depuis l'accueil.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(locationControllerProvider.notifier).refreshIfGranted();
    });
  }

  static const _destinations = <AppNavItem>[
    AppNavItem(
      icon: Icons.home_outlined,
      activeIcon: Icons.home_rounded,
      label: 'Accueil',
    ),
    // §3.2 liste la carte parmi les destinations principales : une liste
    // repond a « lequel », une carte repond a « ou », et dans une ville ou l'on
    // se repere par quartier c'est souvent la seconde question qui decide.
    AppNavItem(
      icon: Icons.map_outlined,
      activeIcon: Icons.map_rounded,
      label: 'Carte',
    ),
    AppNavItem(
      icon: Icons.favorite_border_rounded,
      activeIcon: Icons.favorite_rounded,
      label: 'Favoris',
    ),
    AppNavItem(
      icon: Icons.receipt_long_outlined,
      activeIcon: Icons.receipt_long_rounded,
      label: 'Activité',
    ),
    AppNavItem(
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: 'Profil',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    // The client accent is installed above the router (see `main.dart`), not
    // here — see the note in `ShellView`.
    return PopScope(
      canPop: widget.navigationShell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) widget.navigationShell.goBranch(0);
      },
      child: Scaffold(
        body: widget.navigationShell,
        bottomNavigationBar: AppNavBar(
          items: _destinations,
          currentIndex: widget.navigationShell.currentIndex,
          onSelected: (index) {
            widget.navigationShell.goBranch(
              index,
              initialLocation: index == widget.navigationShell.currentIndex,
            );
          },
        ),
      ),
    );
  }
}
