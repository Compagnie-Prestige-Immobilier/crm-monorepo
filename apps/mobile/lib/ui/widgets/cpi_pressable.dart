import 'package:flutter/material.dart';

import '../../core/theme/cpi_tokens.dart';

/// Surface tapable avec **retour de pression**.
///
/// ## Pourquoi une mise à l'échelle et rien d'autre
///
/// docs/design.md §5 rappelle qu'une ombre coûte une passe de rendu par
/// élément dans une liste, et §7 qu'une animation qui n'informe de rien se
/// supprime. Une pression, elle, informe : elle dit « le doigt a bien été
/// enregistré ». On la rend donc par une seule transformation : `Transform.scale`
/// : qui n'invalide pas la couche de peinture des enfants, ne compose aucune
/// opacité sur un grand sous-arbre et n'anime aucun flou.
///
/// La durée vient de [CpiMotion.of], qui la ramène à zéro sous
/// `MediaQuery.disableAnimations`. Le widget reste alors parfaitement
/// fonctionnel, simplement immobile.
class CpiPressable extends StatefulWidget {
  const CpiPressable({
    super.key,
    required this.child,
    required this.onTap,
    this.onLongPress,
    this.borderRadius = CpiRadius.brLg,
    this.pressedScale = 0.97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius borderRadius;

  /// 0,97 et non 0,90 : au-delà, la carte « saute » et le mouvement devient le
  /// sujet au lieu d'être la confirmation.
  final double pressedScale;

  @override
  State<CpiPressable> createState() => _CpiPressableState();
}

class _CpiPressableState extends State<CpiPressable> {
  bool _pressed = false;

  void _set(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    final bool enabled = widget.onTap != null;

    return AnimatedScale(
      scale: _pressed && enabled ? widget.pressedScale : 1.0,
      duration: motion.micro,
      curve: motion.easeOut,
      child: Material(
        color: Colors.transparent,
        borderRadius: widget.borderRadius,
        child: InkWell(
          borderRadius: widget.borderRadius,
          onTap: widget.onTap,
          onLongPress: widget.onLongPress,
          onHighlightChanged: _set,
          onTapCancel: () => _set(false),
          child: widget.child,
        ),
      ),
    );
  }
}

/// Entrée en liste, décalée par rang.
///
/// Le décalage est **plafonné** : au-delà de six éléments, tout arrive en même
/// temps. Un escalier qui court sur quarante lignes n'est plus une entrée, c'est
/// une attente : et sur un appareil lent, quarante animations simultanées
/// coûtent des images.
class CpiListEntrance extends StatelessWidget {
  const CpiListEntrance({
    super.key,
    required this.index,
    required this.child,
    this.maxStaggered = 6,
  });

  final int index;
  final Widget child;
  final int maxStaggered;

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    if (motion.component == Duration.zero || index >= maxStaggered) {
      return child;
    }
    final Duration delay = Duration(milliseconds: 40 * index);
    return _Entrance(
      key: ValueKey<int>(index),
      delay: delay,
      duration: motion.component,
      curve: motion.easeOut,
      child: child,
    );
  }
}

class _Entrance extends StatefulWidget {
  const _Entrance({
    super.key,
    required this.delay,
    required this.duration,
    required this.curve,
    required this.child,
  });

  final Duration delay;
  final Duration duration;
  final Curve curve;
  final Widget child;

  @override
  State<_Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<_Entrance> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Animation<double> curved = CurvedAnimation(
      parent: _controller,
      curve: widget.curve,
    );
    // `SlideTransition` seule : une opacité animée force une couche de
    // composition sur tout le sous-arbre, ce que §5 interdit dans une liste.
    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.06),
        end: Offset.zero,
      ).animate(curved),
      child: widget.child,
    );
  }
}
