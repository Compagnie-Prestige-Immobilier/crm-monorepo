import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/theme/cpi_tokens.dart';

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

class _EntranceState extends State<_Entrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late final CurvedAnimation _curved = CurvedAnimation(
    parent: _controller,
    curve: widget.curve,
  );

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () {
      if (mounted) unawaited(_controller.forward());
    });
  }

  @override
  void dispose() {
    _curved.dispose();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.06),
        end: Offset.zero,
      ).animate(_curved),
      child: widget.child,
    );
  }
}
