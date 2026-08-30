import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/utils/app_money.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';

/// The day's control panel.
///
/// One number carries the card. The previous version gave the cash row, the
/// urgency line and two bordered stat tiles roughly the same visual weight, so
/// the eye had four entry points and picked none of them. Here the takings are
/// set at display size, the two counts drop to a quiet divided row underneath,
/// and the single primary action closes the block.
class StudioHealthCard extends ConsumerWidget {
  const StudioHealthCard({
    super.key,
    required this.dailyCash,
    required this.transactionCount,
    required this.urgentCount,
    required this.waitingCount,
    required this.onCashTap,
    required this.onUrgentTap,
    required this.onWaitingTap,
    required this.onCreateOrder,
  });

  final double dailyCash;
  final int transactionCount;
  final int urgentCount;
  final int waitingCount;
  final VoidCallback onCashTap;
  final VoidCallback onUrgentTap;
  final VoidCallback onWaitingTap;
  final VoidCallback onCreateOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final amount = money.formatAmount(dailyCash);
    final rule = context.borderColor.withValues(alpha: 0.72);
    final ledger = transactionCount == 0
        ? 'Aucun encaissement pour le moment'
        : '$transactionCount encaissement${transactionCount > 1 ? 's' : ''} enregistré${transactionCount > 1 ? 's' : ''}';

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.surfaceColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        border: Border.all(color: rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PressableSurface(
            onTap: onCashTap,
            backgroundColor: Colors.transparent,
            showBorder: false,
            borderRadius: 0,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.cardPadding,
              AppSpacing.cardPadding,
              AppSpacing.cardPadding,
              AppSpacing.md,
            ),
            semanticLabel:
                'Caisse du jour, ${money.format(dailyCash)}. $ledger. Ouvrir le détail',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'CAISSE DU JOUR',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.overline.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 20,
                      color: context.textSecondaryColor.withValues(alpha: 0.7),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // The one large number on the screen. Mono with tabular
                // figures, so the amount reads as a quantity rather than as a
                // headline that happens to be numeric.
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: amount),
                        TextSpan(
                          text: '  ${money.currency}',
                          style: AppTextStyles.numeric.copyWith(
                            fontSize: 14,
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ],
                    ),
                    maxLines: 1,
                    style: AppTextStyles.statValue.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  ledger,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 1, color: rule),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: _OperationalSignal(
                    label: 'urgentes',
                    value: urgentCount,
                    icon: Icons.priority_high_rounded,
                    tone: urgentCount > 0
                        ? context.statusForeground(AppColors.warning)
                        : context.textSecondaryColor,
                    semanticLabel:
                        '$urgentCount commande${urgentCount > 1 ? 's' : ''} urgente${urgentCount > 1 ? 's' : ''}',
                    onTap: onUrgentTap,
                  ),
                ),
                VerticalDivider(width: 1, thickness: 1, color: rule),
                Expanded(
                  child: _OperationalSignal(
                    label: 'en production',
                    value: waitingCount,
                    icon: Icons.content_cut_rounded,
                    tone: context.textSecondaryColor,
                    semanticLabel: '$waitingCount en production',
                    onTap: onWaitingTap,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 1, color: rule),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            child: FilledButton.icon(
              onPressed: onCreateOrder,
              icon: const Icon(Icons.add_rounded, size: 19),
              label: const Text(
                'Nouvelle commande',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(AppSpacing.buttonHeightLG),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A count, demoted on purpose. Value first so the row can be scanned down the
/// digit; the label trails at reading size and never takes a colour of its own.
class _OperationalSignal extends StatelessWidget {
  const _OperationalSignal({
    required this.label,
    required this.value,
    required this.icon,
    required this.tone,
    required this.semanticLabel,
    required this.onTap,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color tone;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      backgroundColor: Colors.transparent,
      showBorder: false,
      borderRadius: 0,
      semanticLabel: semanticLabel,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 14,
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 24),
        child: Row(
          children: [
            Icon(icon, color: tone, size: 17),
            const SizedBox(width: 9),
            Text(
              '$value',
              style: AppTextStyles.numeric.copyWith(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: context.textPrimaryColor,
              ),
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
