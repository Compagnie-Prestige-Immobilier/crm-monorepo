import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/states/inline_empty_state.dart';

class ClientMeasurementsCard extends StatelessWidget {
  const ClientMeasurementsCard({
    super.key,
    required this.client,
    required this.onAddMeasurement,
  });

  final ClientModel client;
  final VoidCallback onAddMeasurement;

  @override
  Widget build(BuildContext context) {
    final latest = client.latestMeasurement;
    final values = latest == null
        ? const <_MeasurementData>[]
        : _values(latest);

    return Semantics(
      container: true,
      label: 'Mensurations du client',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Mensurations',
            subtitle: latest == null
                ? 'Aucune fiche corporelle enregistrée'
                : 'Dernière prise le ${DateFormat('d MMMM yyyy', 'fr').format(latest.recordedDate)}',
            icon: Icons.straighten_rounded,
            actionLabel: latest == null ? null : 'Mettre à jour',
            onAction: latest == null ? null : onAddMeasurement,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppSectionSurface(
            child: latest == null || latest.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.sm,
                    ),
                    child: InlineEmptyState(
                      icon: Icons.straighten_outlined,
                      message: 'Aucune mesure enregistrée',
                      description:
                          'Ajoutez une fiche pour accélérer les prochaines commandes.',
                      onAction: onAddMeasurement,
                      actionLabel: 'Ajouter les mensurations',
                    ),
                  )
                : Column(
                    children: [
                      Row(
                        children: [
                          _SummaryMetric(
                            value: '${values.length}',
                            label: 'mesures',
                            icon: Icons.format_list_numbered_rounded,
                          ),
                          const SizedBox(width: 10),
                          _SummaryMetric(
                            value: '${client.measurements.length}',
                            label: client.measurements.length > 1
                                ? 'relevés'
                                : 'relevé',
                            icon: Icons.history_rounded,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      const Divider(height: 1),
                      const SizedBox(height: AppSpacing.sm),
                      ...values.map(
                        (measurement) => _MeasurementRow(data: measurement),
                      ),
                      if (latest.notes != null &&
                          latest.notes!.trim().isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        AppStatusBanner(
                          title: 'Note de prise de mesure',
                          message: latest.notes!.trim(),
                          icon: Icons.notes_rounded,
                          tone: AppStatusTone.neutral,
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  List<_MeasurementData> _values(MeasurementRecord value) {
    final rows = <_MeasurementData>[
      _MeasurementData('Tour de cou', value.neckCircumference),
      _MeasurementData('Carrure', value.shoulderWidth),
      _MeasurementData('Poitrine', value.bustCircumference),
      _MeasurementData('Taille', value.waistCircumference),
      _MeasurementData('Hanches', value.hipCircumference),
      _MeasurementData('Longueur dos', value.backLength),
      _MeasurementData('Longueur manche', value.sleeveLength),
      _MeasurementData('Tour de bras', value.armCircumference),
      _MeasurementData('Hauteur totale', value.totalHeight),
      _MeasurementData('Entrejambe', value.inseamLength),
      _MeasurementData('Longueur jupe', value.skirtLength),
      _MeasurementData('Longueur pantalon', value.pantsLength),
      ...value.customMeasurements.map(
        (entry) => _MeasurementData(entry.name, entry.value),
      ),
    ];
    return rows.where((entry) => entry.value != null).toList(growable: false);
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.value,
    required this.label,
    required this.icon,
  });

  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: context.backgroundColor,
          borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
          border: Border.all(color: context.borderColor.withValues(alpha: .7)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
            Text(
              value,
              style: AppTextStyles.h5.copyWith(
                color: context.textPrimaryColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
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

class _MeasurementRow extends StatelessWidget {
  const _MeasurementRow({required this.data});

  final _MeasurementData data;

  @override
  Widget build(BuildContext context) {
    final value = data.value!;
    final primary = Theme.of(context).colorScheme.primary;
    return Semantics(
      label: '${data.label}, ${value.toStringAsFixed(1)} centimètres',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 9),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  data.label,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: context.textPrimaryColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: primary.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
                ),
                child: Text(
                  '${value.toStringAsFixed(1)} cm',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: primary,
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MeasurementData {
  const _MeasurementData(this.label, this.value);

  final String label;
  final double? value;
}
