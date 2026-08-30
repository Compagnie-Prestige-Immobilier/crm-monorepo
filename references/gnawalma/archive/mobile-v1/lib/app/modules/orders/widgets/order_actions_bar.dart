import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/order_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

class OrderActionsBar extends ConsumerWidget {
  const OrderActionsBar({
    super.key,
    required this.order,
    required this.onStatusChanged,
    required this.onPaymentRequested,
  });

  final OrderModel order;
  final ValueChanged<OrderStatus> onStatusChanged;
  final VoidCallback onPaymentRequested;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final isPaid = order.paymentStatus == PaymentStatus.paid;
    final isDelivered = order.status == OrderStatus.delivered;
    final isClosed = isDelivered || order.status == OrderStatus.cancelled;

    return AppSectionSurface(
      elevated: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AppSectionHeader(
            title: 'Prochaine action',
            subtitle: 'Une action principale, les autres restent disponibles',
            icon: Icons.bolt_rounded,
          ),
          const SizedBox(height: AppSpacing.md),
          if (!isPaid)
            FilledButton.icon(
              onPressed: onPaymentRequested,
              icon: const Icon(Icons.payments_outlined),
              label: Text('Encaisser ${money.format(order.remainingBalance)}'),
            )
          else if (!isDelivered && order.status != OrderStatus.cancelled)
            FilledButton.icon(
              onPressed: () => onStatusChanged(OrderStatus.delivered),
              icon: const Icon(Icons.local_shipping_outlined),
              label: const Text('Confirmer la livraison'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.statusDelivered,
              ),
            )
          else
            const AppStatusBanner(
              title: 'Commande clôturée',
              message:
                  'La commande est livrée et son paiement est entièrement soldé.',
              icon: Icons.verified_outlined,
              tone: AppStatusTone.success,
            ),
          if (!isClosed) ...[
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Mettre à jour le statut',
              style: AppTextStyles.label.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: OrderStatus.values
                  .where((status) => status != order.status)
                  .map(
                    (status) => _StatusAction(
                      status: status,
                      onTap: () => onStatusChanged(status),
                    ),
                  )
                  .toList(growable: false),
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(order.status.icon, size: 17, color: order.status.color),
                const SizedBox(width: 6),
                Text(
                  'Statut actuel : ${order.status.label}',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusAction extends StatelessWidget {
  const _StatusAction({required this.status, required this.onTap});

  final OrderStatus status;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      semanticLabel: 'Passer la commande au statut ${status.label}',
      accentColor: status.color,
      borderRadius: 999,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            status.icon,
            size: 17,
            color: context.statusForeground(status.color),
          ),
          const SizedBox(width: AppSpacing.xxs + 2),
          Text(
            status.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.label.copyWith(
              color: context.statusForeground(status.color),
            ),
          ),
        ],
      ),
    );
  }
}
