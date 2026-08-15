import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/connectivity.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Icône réseau de l'AppBar, posée à gauche de `SyncBadge`.
///
/// ## Pourquoi elle n'apparaît QUE quand ça ne va pas
///
/// Une icône « connecté » affichée en permanence serait une affirmation que
/// `connectivity_plus` ne permet pas de tenir : il mesure l'interface, pas
/// l'accessibilité (voir `core/providers/connectivity.dart`). Elle serait en
/// plus du bruit permanent à côté du badge de synchronisation, qui répond déjà
/// à la vraie question : « ce que j'ai saisi est-il parti ? ».
///
/// Deux états défavorables, et **ils ne se disent pas pareil** :
///
///  · *hors ligne* : aucune interface. Certain, et l'utilisateur le sait
///    généralement déjà ;
///  · *injoignable* : l'interface est là, le réseau affiche des barres, et
///    pourtant rien ne sort : portail captif d'hôtel ou de salle de formation,
///    forfait data épuisé. C'est le cas où l'utilisateur ne comprend PAS, appelle
///    le support, et où l'application lui affichait exactement la même chose
///    qu'en fonctionnement normal : rien.
///
/// ## Sur l'animation
///
/// Une pulsation lente d'opacité, jamais un clignotement : l'icône doit se
/// remarquer sans capter le regard pendant une saisie. Elle s'éteint dans deux
/// cas, et les deux comptent :
///
///  · `MediaQuery.disableAnimationsOf`, le réglage d'accessibilité système,
///    déjà combiné au réglage de l'app à la racine (`app.dart`) ;
///  · `TickerMode`, obtenu gratuitement par `SingleTickerProviderStateMixin`,
///    qui met le ticker en sourdine quand la branche de navigation n'est plus
///    visible. Sans lui, les quatre branches du shell animeraient en même temps
///    une icône que personne ne regarde, une image par vsync, sur un appareil
///    déjà lent.
class OfflineIndicator extends ConsumerWidget {
  const OfflineIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CpiConnectivity state = ref.watch(connectivityProvider);

    return AnimatedSwitcher(
      duration: CpiMotion.of(context).micro,
      switchInCurve: CpiMotion.of(context).easeSpring,
      transitionBuilder: (Widget child, Animation<double> animation) =>
          ScaleTransition(scale: animation, child: child),
      child: switch (state) {
        CpiConnectivity.offline => const _OfflinePulse(
          key: ValueKey<String>('offline'),
          icon: PhosphorIconsRegular.wifiSlash,
          label: 'Hors ligne. Les saisies partiront au retour du réseau.',
        ),
        CpiConnectivity.unreachable => const _OfflinePulse(
          key: ValueKey<String>('unreachable'),
          // Une prise barrée et non un Wi-Fi barré : il y a bien du réseau,
          // c'est le serveur qu'on n'atteint pas. Deux icônes différentes pour
          // deux pannes différentes.
          icon: PhosphorIconsRegular.plugsConnected,
          label:
              'Réseau présent mais serveur injoignable. '
              'Vérifiez le portail Wi-Fi ou votre crédit data.',
        ),
        CpiConnectivity.online => const SizedBox.shrink(),
      },
    );
  }
}

class _OfflinePulse extends StatefulWidget {
  const _OfflinePulse({super.key, required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  State<_OfflinePulse> createState() => _OfflinePulseState();
}

class _OfflinePulseState extends State<_OfflinePulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced) {
      if (_controller.isAnimating) _controller.stop();
      _controller.value = 0;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Sur le bordeaux de l'AppBar, l'or lisible est `accentOnDark` (#FFC65A,
    // 8,71:1) ; l'or de surface #C8921A y serait illisible (docs/design.md
    // §2.3).
    final Color color = context.cpi.accentOnDark;
    final Widget icon = Icon(widget.icon, size: 20, color: color);

    return Semantics(
      // La couleur et la forme ne peuvent pas être les seules porteuses de
      // l'information (WCAG 1.4.1).
      label: widget.label,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: CpiSpacing.xs),
        child: FadeTransition(
          // 0,45 au creux et non 0 : une icône qui disparaît complètement se
          // lit comme un défaut d'affichage, pas comme une alerte.
          opacity: Tween<double>(begin: 1, end: 0.45).animate(_controller),
          child: icon,
        ),
      ),
    );
  }
}
