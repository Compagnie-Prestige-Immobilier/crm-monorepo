import 'package:flutter/material.dart';

import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_colors.dart';

class InvoiceItemsTable extends StatelessWidget {
  const InvoiceItemsTable({
    super.key,
    required this.articles,
    required this.formatCurrency,
    this.brandColor,
  });

  final List<ProjectModel> articles;
  final String Function(double) formatCurrency;
  final Color? brandColor;

  @override
  Widget build(BuildContext context) {
    final accent = brandColor ?? Colors.black87;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
        ),
        child: Column(
          children: [
            Container(
              color: AppColors.documentSurface,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Article',
                      style: AppTextStyles.caption.copyWith(
                        color: Colors.grey.shade700,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    'Montant',
                    style: AppTextStyles.caption.copyWith(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            for (var index = 0; index < articles.length; index++) ...[
              _InvoiceItemRow(
                item: articles[index],
                accent: accent,
                formatCurrency: formatCurrency,
              ),
              if (index != articles.length - 1)
                Divider(height: 1, color: Colors.grey.shade200),
            ],
          ],
        ),
      ),
    );
  }
}

class _InvoiceItemRow extends StatelessWidget {
  const _InvoiceItemRow({
    required this.item,
    required this.accent,
    required this.formatCurrency,
  });

  final ProjectModel item;
  final Color accent;
  final String Function(double) formatCurrency;

  @override
  Widget build(BuildContext context) {
    final amount = item.actualPrice ?? item.estimatedPrice ?? 0;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
            ),
            child: Icon(Icons.checkroom_outlined, size: 18, color: accent),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: Colors.black87,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    item.garmentType,
                    if (item.forWhom?.trim().isNotEmpty == true) item.forWhom!,
                  ].join(' · '),
                  style: AppTextStyles.bodySmall.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
                if (item.description?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 5),
                  Text(
                    item.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption.copyWith(
                      color: Colors.grey.shade600,
                      height: 1.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            formatCurrency(amount),
            textAlign: TextAlign.end,
            style: AppTextStyles.label.copyWith(color: Colors.black87),
          ),
        ],
      ),
    );
  }
}
