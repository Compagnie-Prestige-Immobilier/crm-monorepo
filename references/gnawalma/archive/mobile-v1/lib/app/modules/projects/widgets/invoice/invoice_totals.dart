import 'package:flutter/material.dart';

import '../../../../data/models/order_model.dart';
import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/theme/app_spacing.dart';

class InvoiceTotals extends StatelessWidget {
  const InvoiceTotals({
    super.key,
    required this.project,
    this.order,
    required this.formatCurrency,
    this.brandColor,
  });

  final ProjectModel project;
  final OrderModel? order;
  final String Function(double) formatCurrency;
  final Color? brandColor;

  @override
  Widget build(BuildContext context) {
    final total = order?.totalAmount ?? project.estimatedPrice ?? 0;
    final paid = order?.depositPaid ?? project.advancePayment ?? 0;
    final remaining = order?.remainingBalance ?? project.remainingAmount;
    final accent = brandColor ?? AppColors.primary;

    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 330),
        child: Column(
          children: [
            _TotalLine(label: 'Montant total', value: formatCurrency(total)),
            if (paid > 0)
              _TotalLine(
                label: 'Déjà encaissé',
                value: '- ${formatCurrency(paid)}',
                valueColor: AppColors.success,
              ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(
                color: accent,
                borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      remaining <= 0 ? 'Solde' : 'Net à payer',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    formatCurrency(
                      remaining.clamp(0, double.infinity).toDouble(),
                    ),
                    style: AppTextStyles.h5.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TotalLine extends StatelessWidget {
  const _TotalLine({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTextStyles.bodySmall.copyWith(
                color: Colors.grey.shade600,
              ),
            ),
          ),
          Text(
            value,
            style: AppTextStyles.label.copyWith(
              color: valueColor ?? Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}
