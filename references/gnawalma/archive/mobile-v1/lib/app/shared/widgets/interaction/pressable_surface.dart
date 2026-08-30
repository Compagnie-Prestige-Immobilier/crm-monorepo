import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_motion.dart';

/// A restrained, accessible interactive surface used by cards, tiles and
/// selectors. It provides immediate press/focus feedback without the repeated
/// bouncing animations that make an operational app feel like a toy.
class PressableSurface extends StatefulWidget {
  const PressableSurface({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.semanticLabel,
    this.padding = const EdgeInsets.all(AppSpacing.cardPadding),
    this.margin = EdgeInsets.zero,
    this.backgroundColor,
    this.accentColor,
    this.borderColor,
    this.borderRadius = AppSpacing.radiusLG,
    this.selected = false,
    // Bordered by default. `background` and `surface` are both pure white, so a
    // borderless card was literally invisible on the light page — the hairline
    // is what makes a card a card in this design language. Surfaces that sit on
    // a tinted or nested background opt out explicitly.
    this.showBorder = true,
    this.elevated = false,
    this.enabled = true,
    this.haptic = true,
    this.hasNestedActions = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final String? semanticLabel;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color? backgroundColor;
  final Color? accentColor;
  final Color? borderColor;
  final double borderRadius;
  final bool selected;
  final bool showBorder;
  final bool elevated;
  final bool enabled;
  final bool haptic;

  /// Set when the card contains its own buttons.
  ///
  /// Without it the card's [semanticLabel] replaces the whole subtree, and any
  /// control inside disappears from the accessibility tree while staying
  /// visible and tappable — the failure mode is invisible to a sighted tester
  /// and total for anyone using assistive technology.
  final bool hasNestedActions;

  @override
  State<PressableSurface> createState() => _PressableSurfaceState();
}

class _PressableSurfaceState extends State<PressableSurface> {
  bool _pressed = false;
  bool _focused = false;

  bool get _interactive => widget.enabled && widget.onTap != null;

  void _setPressed(bool value) {
    if (!_interactive || _pressed == value || !mounted) return;
    setState(() => _pressed = value);
  }

  void _handleTap() {
    if (!_interactive) return;
    if (widget.haptic) HapticFeedback.selectionClick();
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final accent = widget.accentColor ?? Theme.of(context).colorScheme.primary;
    final background = widget.backgroundColor ?? context.surfaceColor;
    final border = widget.borderColor ?? context.borderColor;
    final radius = BorderRadius.circular(widget.borderRadius);
    final selectedWash = Color.alphaBlend(
      accent.withValues(alpha: 0.055),
      background,
    );

    final surface = AnimatedScale(
      scale: !reduceMotion && _pressed ? 0.985 : 1,
      duration: AppMotion.duration(context, AppMotion.instant),
      curve: Curves.easeOutCubic,
      child: AnimatedContainer(
        duration: AppMotion.duration(context, AppMotion.exit),
        curve: Curves.easeOutCubic,
        margin: widget.margin,
        decoration: BoxDecoration(
          color: widget.selected ? selectedWash : background,
          borderRadius: radius,
          border: widget.showBorder || widget.selected || _focused
              ? Border.all(
                  color: widget.selected
                      ? accent.withValues(alpha: 0.55)
                      : _focused
                      ? accent.withValues(alpha: 0.42)
                      : border.withValues(alpha: 0.82),
                  width: widget.selected || _focused ? 1.4 : 1,
                )
              : null,
          boxShadow: widget.elevated
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.065),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: radius,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: _interactive ? _handleTap : null,
            onLongPress: widget.enabled && widget.onLongPress != null
                ? widget.onLongPress
                : null,
            onTapDown: _interactive ? (_) => _setPressed(true) : null,
            onTapUp: _interactive ? (_) => _setPressed(false) : null,
            onTapCancel: _interactive ? () => _setPressed(false) : null,
            onFocusChange: (value) {
              if (!mounted || _focused == value) return;
              setState(() => _focused = value);
            },
            borderRadius: radius,
            splashColor: accent.withValues(alpha: 0.09),
            highlightColor: accent.withValues(alpha: 0.045),
            child: Padding(padding: widget.padding, child: widget.child),
          ),
        ),
      ),
    );

    // A card that carries its own actions must not swallow them.
    //
    // `semanticLabel` exists so a card reads as one sentence instead of six
    // fragments, and it did that by excluding the whole subtree. That also
    // removed every control nested inside: on the client activity list,
    // "J'ai été servi" and "Donner mon avis" were painted on screen and
    // present in no accessibility tree at all — unreachable by TalkBack, by
    // switch access, and by `uiautomator`. WCAG 4.1.2: a control has to expose
    // its name and role.
    //
    // `explicitChildNodes` keeps the summary label on the card and leaves
    // genuinely interactive descendants addressable underneath it. Cards with
    // no nested controls keep the merged reading they had.
    return Semantics(
      button: _interactive,
      enabled: widget.enabled,
      selected: widget.selected,
      label: widget.semanticLabel,
      container: widget.semanticLabel != null,
      explicitChildNodes:
          widget.semanticLabel != null && widget.hasNestedActions,
      child: ExcludeSemantics(
        excluding: widget.semanticLabel != null && !widget.hasNestedActions,
        child: surface,
      ),
    );
  }
}

/// Small selection indicator shared by cards, chips and multi-step forms.
class SelectionIndicator extends StatelessWidget {
  const SelectionIndicator({
    super.key,
    required this.selected,
    required this.accent,
    this.size = 28,
  });

  final bool selected;
  final Color accent;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: AppMotion.duration(context, AppMotion.exit),
      switchInCurve: Curves.easeOutBack,
      switchOutCurve: Curves.easeIn,
      child: selected
          ? Container(
              key: const ValueKey('selected'),
              width: size,
              height: size,
              decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
              child: Icon(
                Icons.check_rounded,
                size: size * 0.62,
                color: Colors.white,
              ),
            )
          : Container(
              key: const ValueKey('unselected'),
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: context.surfaceColor,
                shape: BoxShape.circle,
                border: Border.all(color: context.borderColor, width: 1.4),
              ),
            ),
    );
  }
}
