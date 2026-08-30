import '../../../shared/utils/app_money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

class ClientStats extends ConsumerWidget {
  const ClientStats({super.key, required this.client});

  final ClientModel client;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final theme = Theme.of(context);
    final score = client.trustScore;
    final scoreColor = context.statusForeground(
      score >= 4
          ? AppColors.success
          : score >= 3
          ? AppColors.info
          : score >= 2
          ? AppColors.warning
          : AppColors.error,
    );
    return AppSectionSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Relation client',
            icon: Icons.insights_outlined,
            accentColor: theme.colorScheme.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _Metric(
                  value: '${client.totalOrders}',
                  label: 'Commandes',
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _Metric(
                  value: money.format(client.totalSpent, compactSymbol: true),
                  label: 'Dépensé',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Icon(Icons.verified_user_outlined, color: scoreColor, size: 22),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('Fiabilité', style: theme.textTheme.labelLarge),
                        const Spacer(),
                        Text(
                          '${score.toStringAsFixed(1)}/5',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: scoreColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusSheetTop,
                      ),
                      child: LinearProgressIndicator(
                        minHeight: 6,
                        value: (score / 5).clamp(0, 1),
                        color: scoreColor,
                        backgroundColor: scoreColor.withValues(alpha: 0.10),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    // Neutral tile, big mono value. Stat tiles read cleanest with the number
    // doing the work and no coloured wash behind them.
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.surfaceLightColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.statValue.copyWith(
              fontSize: 22,
              color: colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            label.toUpperCase(),
            style: AppTextStyles.tag.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
