import 'package:flutter/material.dart';

import '../../../data/models/order_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

class OrderDetailHeader extends StatelessWidget {
  const OrderDetailHeader({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  order.orderNumber,
                  style: AppTextStyles.h3.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
              ),
              AppMetricPill(
                label: 'Paiement',
                value: order.paymentStatus.label,
                icon: order.paymentStatus.icon,
                accentColor: order.paymentStatus.color,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(order.status.icon, size: 18, color: order.status.color),
              const SizedBox(width: 7),
              Text(
                order.status.label,
                style: AppTextStyles.label.copyWith(color: order.status.color),
              ),
              const Spacer(),
              if (order.isOverdue)
                const AppMetricPill(
                  label: 'Livraison',
                  value: 'En retard',
                  icon: Icons.warning_amber_rounded,
                  accentColor: AppColors.error,
                ),
            ],
          ),
        ],
      ),
    );
  }
}
