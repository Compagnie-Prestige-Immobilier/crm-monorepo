import 'package:flutter/material.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';

/// Accessible progress indicator for short multi-step flows.
class StepIndicator extends StatelessWidget {
  const StepIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    this.stepLabels,
    this.accentColor,
  });

  final int currentStep;
  final int totalSteps;
  final List<String>? stepLabels;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? Theme.of(context).colorScheme.primary;
    final safeStep = currentStep.clamp(0, totalSteps - 1);
    // The step being worked on already counts: step 1 of 5 is 20 % of the way
    // in, not zero, and the last step is not "done" until it is submitted.
    final progress = totalSteps <= 1 ? 1.0 : (safeStep + 1) / totalSteps;
    final currentLabel = stepLabels != null && safeStep < stepLabels!.length
        ? stepLabels![safeStep]
        : 'Étape ${safeStep + 1}';

    return Semantics(
      label: '$currentLabel, étape ${safeStep + 1} sur $totalSteps',
      value: '${(progress * 100).round()} %',
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.md,
        ),
        child: Column(
          children: [
            Row(
              children: [
                Text(
                  currentLabel,
                  style: AppTextStyles.caption.copyWith(
                    color: context.textPrimaryColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                Text(
                  '${safeStep + 1}/$totalSteps',
                  style: AppTextStyles.caption.copyWith(color: accent),
                ),
              ],
            ),
            const SizedBox(height: 9),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.radiusCircular),
              child: LinearProgressIndicator(
                minHeight: 6,
                value: progress,
                color: accent,
                backgroundColor: accent.withValues(alpha: 0.11),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
