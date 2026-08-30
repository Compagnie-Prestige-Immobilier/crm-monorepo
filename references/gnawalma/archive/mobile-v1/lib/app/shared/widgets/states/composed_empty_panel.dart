import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_motion.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../layouts/polished_page.dart';
import '../visuals/atelier_illustration.dart';

/// Empty state for a section that already sits inside a scrolling page.
///
/// [EmptyState] cannot be used in that position: it wraps itself in its own
/// scroll view, which would nest inside the step's scroller. Same composition —
/// illustration, title, message, one full-width primary action — with no
/// scroller of its own. Shared by every in-page empty section so no screen
/// ever renders as a bare form with nothing in it.
class ComposedEmptyPanel extends StatelessWidget {
  const ComposedEmptyPanel({
    super.key,
    required this.motif,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.actionIcon,
    required this.onAction,
  });

  final AtelierMotif motif;
  final String title;
  final String message;
  final String actionLabel;
  final IconData actionIcon;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final panel = AppSectionSurface(
      bordered: true,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.cardPadding,
        vertical: AppSpacing.lg,
      ),
      child: Column(
        children: [
          AtelierIllustration(motif: motif, height: 128),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTextStyles.h5.copyWith(color: context.textPrimaryColor),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
              height: 1.42,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onAction,
              icon: Icon(actionIcon, size: 19),
              label: Text(
                actionLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );

    if (AppMotion.reduced(context)) return panel;
    return panel
        .animate()
        .fadeIn(duration: AppMotion.standard, curve: AppMotion.enter)
        .slideY(begin: .04, end: 0, curve: AppMotion.enter);
  }
}
