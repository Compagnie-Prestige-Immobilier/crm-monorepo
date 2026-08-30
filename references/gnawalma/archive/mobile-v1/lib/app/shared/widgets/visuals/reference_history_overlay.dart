import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../shared/constants/unified_measurements.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

/// Compact measurement reference that remains readable without glass effects
/// or blocking the order form underneath it.
class ReferenceHistoryOverlay extends StatelessWidget {
  const ReferenceHistoryOverlay({
    super.key,
    required this.label,
    required this.measurements,
    this.lastUpdate,
    required this.onClose,
  });

  final String label;
  final Map<String, double> measurements;
  final DateTime? lastUpdate;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final entries = measurements.entries
        .where((entry) => entry.value > 0)
        .take(8);
    return Container(
      width: 278,
      margin: const EdgeInsets.only(right: AppSpacing.md, top: 94),
      child: Material(
        color: Colors.transparent,
        child: AppSectionSurface(
          elevated: true,
          showAccent: true,
          accentColor: Theme.of(context).colorScheme.primary,
          padding: const EdgeInsets.all(AppSpacing.cardPadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusControl,
                      ),
                    ),
                    child: Icon(
                      Icons.history_rounded,
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Mesures de référence',
                          style: AppTextStyles.label.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Fermer les mesures de référence',
                    onPressed: onClose,
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              if (entries.isEmpty)
                Text(
                  'Aucune mesure antérieure n’est disponible pour cette personne.',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                    height: 1.4,
                  ),
                )
              else
                for (final entry in entries)
                  _MeasurementReference(entry: entry),
              if (lastUpdate != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Divider(color: context.dividerColor),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Mise à jour le ${DateFormat('d MMM yyyy', 'fr').format(lastUpdate!)}',
                  style: AppTextStyles.caption.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MeasurementReference extends StatelessWidget {
  const _MeasurementReference({required this.entry});

  final MapEntry<String, double> entry;

  @override
  Widget build(BuildContext context) {
    var label = entry.key;
    for (final field in UnifiedMeasurements.fields) {
      if (field.key == entry.key) {
        label = field.labelFr;
        break;
      }
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodySmall.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '${entry.value.toStringAsFixed(1)} cm',
            style: AppTextStyles.label.copyWith(
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}
