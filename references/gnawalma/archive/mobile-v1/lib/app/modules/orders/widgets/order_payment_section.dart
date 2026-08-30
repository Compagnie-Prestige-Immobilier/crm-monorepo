import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/order_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

class OrderPaymentSection extends ConsumerWidget {
  const OrderPaymentSection({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final remaining = order.remainingBalance.clamp(0, double.infinity);
    final deliveredWithBalance =
        order.status == OrderStatus.delivered && remaining > 0;
    final progress = (order.paymentProgress / 100).clamp(0.0, 1.0);

    return AppSectionSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AppSectionHeader(
            title: 'Paiement',
            subtitle: 'Total, acompte et solde de la commande',
            icon: Icons.payments_outlined,
          ),
          if (deliveredWithBalance) ...[
            const SizedBox(height: AppSpacing.sm),
            const AppStatusBanner(
              title: 'Solde encore dû',
              message: 'La commande a été livrée avant le règlement complet.',
              icon: Icons.warning_amber_rounded,
              tone: AppStatusTone.error,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _MoneyLine(
            label: 'Montant total',
            value: money.format(order.totalAmount),
          ),
          const SizedBox(height: AppSpacing.sm),
          _MoneyLine(
            label: 'Déjà encaissé',
            value: money.format(order.depositPaid),
            color: context.statusForeground(AppColors.success),
          ),
          const Divider(height: AppSpacing.lg),
          _MoneyLine(
            label: 'Solde restant',
            value: money.format(remaining),
            color: remaining > 0 ? AppColors.error : AppColors.success,
            emphasized: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Progression du paiement',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ),
              Text(
                '${(progress * 100).round()} %',
                style: AppTextStyles.label.copyWith(
                  color: order.paymentStatus.color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 9,
              backgroundColor: context.borderColor,
              valueColor: AlwaysStoppedAnimation<Color>(
                order.paymentStatus.color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MoneyLine extends StatelessWidget {
  const _MoneyLine({
    required this.label,
    required this.value,
    this.color,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final Color? color;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: (emphasized ? AppTextStyles.label : AppTextStyles.bodyMedium)
                .copyWith(color: context.textPrimaryColor),
          ),
        ),
        Text(
          value,
          style: (emphasized ? AppTextStyles.h5 : AppTextStyles.label).copyWith(
            color: color ?? context.textPrimaryColor,
          ),
        ),
      ],
    );
  }
}
