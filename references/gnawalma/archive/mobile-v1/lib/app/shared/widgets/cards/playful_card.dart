import 'package:flutter/material.dart';

import '../../../shared/theme/app_spacing.dart';
import '../interaction/pressable_surface.dart';

/// Backwards-compatible card wrapper.
///
/// The historical name is kept to avoid churn in feature modules, while the
/// implementation now uses the restrained interaction system shared by the
/// entire application.
class PlayfulCard extends StatelessWidget {
  const PlayfulCard({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.padding,
    this.margin,
    this.color,
    this.hasBorder = true,
    this.borderColor,
    this.hasGradientBorder = false,
    this.elevation,
    this.borderRadius,
    this.enableTapAnimation = true,
    this.selected = false,
    this.accentColor,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final bool hasBorder;
  final Color? borderColor;
  final bool hasGradientBorder;
  final double? elevation;
  final double? borderRadius;
  final bool enableTapAnimation;
  final bool selected;
  final Color? accentColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      onLongPress: onLongPress,
      semanticLabel: semanticLabel,
      padding: padding ?? const EdgeInsets.all(AppSpacing.cardPadding),
      margin: margin ?? const EdgeInsets.all(AppSpacing.sm),
      backgroundColor: color,
      accentColor: accentColor,
      borderColor: borderColor,
      borderRadius: borderRadius ?? AppSpacing.cardRadius,
      selected: selected,
      showBorder: hasBorder || hasGradientBorder,
      elevated: (elevation ?? 0) > 0,
      haptic: enableTapAnimation,
      child: child,
    );
  }
}
