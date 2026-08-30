import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/utils/app_money.dart';
import '../../../../shared/widgets/states/empty_state.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../models/daily_transaction.dart';

/// The day's takings, opened from the dashboard's headline number.
///
/// The sheet repeats the dashboard's own hierarchy — the total set large, the
/// movements listed as a ledger underneath — so the number the user tapped is
/// the same number that greets them here.
class CashLogSheet extends ConsumerWidget {
  const CashLogSheet({
    super.key,
    required this.transactions,
    required this.total,
  });

  final List<DailyTransaction> transactions;
  final double total;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final rawDate = DateFormat('EEEE d MMMM', 'fr').format(DateTime.now());
    final date = rawDate.replaceRange(
      0,
      1,
      rawDate.substring(0, 1).toUpperCase(),
    );

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          AppSpacing.sm,
          AppSpacing.gutter,
          AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Caisse du jour',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.h3.copyWith(
                          color: context.textPrimaryColor,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        date,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Fermer',
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: context.surfaceColor,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
                border: Border.all(
                  color: context.borderColor.withValues(alpha: 0.72),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'TOTAL ENCAISSÉ',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.overline.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: money.formatAmount(total)),
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
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sectionSpacing),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'ENCAISSEMENTS',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.overline.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ),
                if (transactions.isNotEmpty)
                  Text(
                    '${transactions.length}',
                    style: AppTextStyles.numeric.copyWith(
                      fontWeight: FontWeight.w700,
                      color: context.textSecondaryColor,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Flexible(
              child: transactions.isEmpty
                  ? EmptyState(
                      compact: true,
                      motif: AtelierMotif.payment,
                      title: 'Aucun encaissement',
                      message:
                          'Les paiements enregistrés aujourd’hui apparaîtront ici, avec le client et l’heure.',
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                      itemCount: transactions.length,
                      separatorBuilder: (_, _) => Divider(
                        height: 1,
                        thickness: 1,
                        color: context.dividerColor,
                      ),
                      itemBuilder: (context, index) => _TransactionRow(
                        transaction: transactions[index],
                        money: money,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A ledger line: time on the left in mono so the column aligns, the amount on
/// the right for the same reason. The card-per-transaction layout it replaces
/// made a five-payment day look like five separate objects.
class _TransactionRow extends StatelessWidget {
  const _TransactionRow({required this.transaction, required this.money});

  final DailyTransaction transaction;
  final MoneyFormatter money;

  @override
  Widget build(BuildContext context) {
    final name = transaction.clientName.trim().isEmpty
        ? 'Client non renseigné'
        : transaction.clientName.trim();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Text(
            DateFormat('HH:mm').format(transaction.time),
            style: AppTextStyles.numeric.copyWith(
              color: context.textSecondaryColor,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                if (transaction.orderId.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    'Commande ${transaction.orderId}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '+${money.format(transaction.amount, compactSymbol: true)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.numeric.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: context.statusForeground(AppColors.success),
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
