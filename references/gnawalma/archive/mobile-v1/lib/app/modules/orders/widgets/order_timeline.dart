import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../data/models/order_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';

class OrderTimeline extends StatelessWidget {
  const OrderTimeline({super.key, required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('d MMMM yyyy', 'fr');
    final entries = <_TimelineEntry>[
      _TimelineEntry(
        label: 'Commande créée',
        value: dateFormat.format(order.orderDate),
        icon: Icons.add_task_rounded,
        color: Theme.of(context).colorScheme.primary,
        complete: true,
      ),
      if (order.expectedDeliveryDate != null)
        _TimelineEntry(
          label: 'Livraison prévue',
          value: dateFormat.format(order.expectedDeliveryDate!),
          icon: Icons.event_available_outlined,
          color: order.isOverdue ? AppColors.error : AppColors.warning,
          complete: order.actualDeliveryDate != null,
        ),
      if (order.actualDeliveryDate != null)
        _TimelineEntry(
          label: 'Commande livrée',
          value: dateFormat.format(order.actualDeliveryDate!),
          icon: Icons.verified_outlined,
          color: context.statusForeground(AppColors.success),
          complete: true,
        ),
    ];

    return Column(
      children: [
        for (var index = 0; index < entries.length; index++)
          _TimelineRow(
            entry: entries[index],
            last: index == entries.length - 1,
          ),
      ],
    );
  }
}

class _TimelineEntry {
  const _TimelineEntry({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.complete,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool complete;
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.entry, required this.last});

  final _TimelineEntry entry;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 42,
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: entry.color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: entry.color.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Icon(entry.icon, size: 17, color: entry.color),
                ),
                if (!last)
                  Expanded(
                    child: Container(width: 2, color: context.borderColor),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.label,
                    style: AppTextStyles.label.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    entry.value,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
