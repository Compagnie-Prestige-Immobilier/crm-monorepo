import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../theme/app_motion.dart';
import '../../theme/app_spacing.dart';

/// Layout-matched loading placeholders.
///
/// A centred spinner tells the user nothing about what is coming and forces the
/// whole viewport to re-flow the moment the data lands. These primitives exist
/// so a loading branch can be built to the same geometry as the loaded branch —
/// same paddings, same card heights, same number of rows — and the page never
/// jumps.
///
/// Wrap the placeholder subtree in [Skeleton]: it owns the single pulse driver
/// and announces "Chargement…" once, instead of a screen reader walking dozens
/// of empty blocks.
class Skeleton extends StatelessWidget {
  const Skeleton({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final subtree = ExcludeSemantics(child: child);
    return Semantics(
      label: 'Chargement…',
      liveRegion: true,
      child: AppMotion.reduced(context)
          ? subtree
          : subtree
                .animate(
                  onPlay: (controller) => controller.repeat(reverse: true),
                )
                .fade(
                  begin: .45,
                  end: 1,
                  duration: AppMotion.shimmer,
                  curve: Curves.easeInOut,
                ),
    );
  }
}

/// A neutral placeholder block.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height,
    this.radius = AppSpacing.radiusSM,
    this.circle = false,
  });

  final double? width;
  final double? height;
  final double radius;
  final bool circle;

  /// Fill derived from the scheme so it reads as a placeholder on both the
  /// light and the dark page.
  static Color fillOf(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Color.alphaBlend(
      scheme.outlineVariant.withValues(alpha: 0.55),
      scheme.surfaceContainerHighest,
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = circle ? width ?? height : null;
    return Container(
      width: size ?? width,
      height: size ?? height,
      decoration: BoxDecoration(
        color: fillOf(context),
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: circle ? null : BorderRadius.circular(radius),
      ),
    );
  }
}

/// Stacked placeholder text lines.
class SkeletonText extends StatelessWidget {
  const SkeletonText({
    super.key,
    this.lines = 3,
    this.lineHeight = 12,
    this.lastLineFraction = 0.6,
    this.spacing = AppSpacing.xs,
  });

  final int lines;
  final double lineHeight;
  final double lastLineFraction;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var index = 0; index < lines; index++) ...[
          if (index > 0) SizedBox(height: spacing),
          if (index == lines - 1 && lines > 1)
            FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: lastLineFraction,
              child: SkeletonBox(
                height: lineHeight,
                radius: AppSpacing.pillRadius,
              ),
            )
          else
            SkeletonBox(
              width: double.infinity,
              height: lineHeight,
              radius: AppSpacing.pillRadius,
            ),
        ],
      ],
    );
  }
}
