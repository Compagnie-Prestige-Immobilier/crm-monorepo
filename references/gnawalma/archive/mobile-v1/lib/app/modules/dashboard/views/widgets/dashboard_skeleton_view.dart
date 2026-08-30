import 'package:flutter/material.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';

/// The dashboard's shape before the data arrives.
///
/// It mirrors the real layout block for block — dateline, greeting, the tall
/// takings card with its divided counts and its action, then the queue — so the
/// page does not visibly re-flow the moment the query returns.
class DashboardSkeletonView extends StatelessWidget {
  const DashboardSkeletonView({super.key});

  @override
  Widget build(BuildContext context) {
    final rule = context.borderColor.withValues(alpha: 0.72);

    Widget line(double width, {double height = 14}) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: context.borderColor.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
    );

    Widget block(Widget child) => Container(
      decoration: BoxDecoration(
        color: context.surfaceColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        border: Border.all(color: rule),
      ),
      child: child,
    );

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        bottom: false,
        child: ListView(
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            AppSpacing.md,
            AppSpacing.gutter,
            MediaQuery.paddingOf(context).bottom + AppSpacing.lg,
          ),
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      line(112, height: 11),
                      const SizedBox(height: 11),
                      line(180, height: 26),
                      const SizedBox(height: 8),
                      line(132),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: context.borderColor.withValues(alpha: 0.45),
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            block(
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.cardPadding),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        line(118, height: 11),
                        const SizedBox(height: 14),
                        line(206, height: 32),
                        const SizedBox(height: 12),
                        line(158),
                      ],
                    ),
                  ),
                  Divider(height: 1, thickness: 1, color: rule),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: 18,
                    ),
                    child: Row(
                      children: [
                        Expanded(child: line(double.infinity)),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(child: line(double.infinity)),
                      ],
                    ),
                  ),
                  Divider(height: 1, thickness: 1, color: rule),
                  Padding(
                    padding: const EdgeInsets.all(AppSpacing.cardPadding),
                    child: line(
                      double.infinity,
                      height: AppSpacing.buttonHeightLG,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sectionSpacing),
            line(168, height: 18),
            const SizedBox(height: AppSpacing.md),
            for (var index = 0; index < 3; index++) ...[
              block(
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.cardPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      line(126, height: 11),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(child: line(double.infinity, height: 18)),
                          const SizedBox(width: AppSpacing.lg),
                          line(76),
                        ],
                      ),
                      const SizedBox(height: 10),
                      line(150, height: 12),
                      const SizedBox(height: AppSpacing.md),
                      line(double.infinity, height: 6),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ],
        ),
      ),
    );
  }
}
