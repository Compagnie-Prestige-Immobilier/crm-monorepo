import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../../shared/constants/unified_measurements.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';

class ProjectMeasurementsCard extends StatelessWidget {
  const ProjectMeasurementsCard({super.key, this.snapshot});

  final String? snapshot;

  @override
  Widget build(BuildContext context) {
    final measurements = _decode(snapshot);
    if (measurements.isEmpty) return const SizedBox.shrink();

    final entries = UnifiedMeasurements.fields
        .where((field) => (measurements[field.key] ?? 0) > 0)
        .toList(growable: false);
    if (entries.isEmpty) return const SizedBox.shrink();

    return AppSectionSurface(
      bordered: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 540 ? 3 : 2;
          final gap = AppSpacing.sm;
          final tileWidth =
              (constraints.maxWidth - gap * (columns - 1)) / columns;

          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: entries
                .map((field) {
                  final value = measurements[field.key]!;
                  return Semantics(
                    label:
                        '${field.labelFr}, ${value.toStringAsFixed(value % 1 == 0 ? 0 : 1)} centimètres',
                    child: Container(
                      width: tileWidth,
                      constraints: const BoxConstraints(minHeight: 78),
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: context.surfaceLightColor.withValues(
                          alpha: 0.62,
                        ),
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusMD,
                        ),
                        border: Border.all(
                          color: context.borderColor.withValues(alpha: 0.72),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            field.labelFr,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.bodySmall.copyWith(
                              color: context.textSecondaryColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Flexible(
                                child: Text(
                                  value.toStringAsFixed(value % 1 == 0 ? 0 : 1),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTextStyles.h4.copyWith(
                                    color: context.textPrimaryColor,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.xxs),
                              Text(
                                'cm',
                                style: AppTextStyles.caption.copyWith(
                                  color: context.textSecondaryColor,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                })
                .toList(growable: false),
          );
        },
      ),
    );
  }

  Map<String, double> _decode(String? source) {
    if (source == null || source.trim().isEmpty) return const {};
    try {
      final decoded = jsonDecode(source);
      if (decoded is! Map) return const {};
      return decoded.map<String, double>((key, value) {
        if (value is! num) return MapEntry(key.toString(), 0);
        return MapEntry(key.toString(), value.toDouble());
      });
    } catch (_) {
      return const {};
    }
  }
}
