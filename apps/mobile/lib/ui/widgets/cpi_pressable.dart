import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/theme/cpi_tokens.dart';

/// Entrée en cascade d'une liste : fondu et glissement de bas en haut, décalés
/// de [CpiMotion.stagger] par rang.
///
/// Au-delà de [maxStaggered] rangs l'enfant est rendu nu : une liste de deux
/// cents fiches ne doit pas monter deux cents contrôleurs, et personne n'attend
/// que la centième arrive.
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
    return _Entrance(
      key: ValueKey<int>(index),
      delay: motion.stagger * index,
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

class _EntranceState extends State<_Entrance>
    with SingleTickerProviderStateMixin {
  // Le retard est un `Interval` du même contrôleur : un `Future.delayed` par
  // ligne survivait au démontage et rallumait une animation sur un écran quitté.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.delay + widget.duration,
  );
  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: Interval(
      widget.delay.inMicroseconds /
          (widget.delay + widget.duration).inMicroseconds,
      1,
      curve: widget.curve,
    ),
  );

  @override
  void initState() {
    super.initState();
    unawaited(_controller.forward());
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _curved,
    child: SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.06),
        end: Offset.zero,
      ).animate(_curved),
      child: widget.child,
    ),
  );
}

/// Arrivée d'un bloc qui vient de se poser : il grandit jusqu'à sa taille avec
/// un léger dépassement. Pour un résultat, une confirmation, une carte qui
/// apparaît — pas pour une liste.
class CpiSpringIn extends StatefulWidget {
  const CpiSpringIn({super.key, required this.child});

  final Widget child;

  @override
  State<CpiSpringIn> createState() => _CpiSpringInState();
}

class _CpiSpringInState extends State<CpiSpringIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this);
  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: Curves.linear,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final CpiMotion motion = CpiMotion.of(context);
    _controller.duration = motion.component;
    _curved.curve = motion.easeSpring;
    if (motion.component == Duration.zero) {
      _controller.value = 1;
    } else if (!_controller.isAnimating && _controller.value == 0) {
      unawaited(_controller.forward());
    }
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      ScaleTransition(scale: _curved, child: widget.child);
}
