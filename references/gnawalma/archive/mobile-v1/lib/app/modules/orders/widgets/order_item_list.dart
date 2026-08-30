import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/project_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/states/inline_empty_state.dart';

class OrderItemList extends StatelessWidget {
  const OrderItemList({super.key, required this.projects});

  final List<ProjectModel> projects;

  @override
  Widget build(BuildContext context) {
    if (projects.isEmpty) {
      return const InlineEmptyState(
        icon: Icons.checkroom_outlined,
        message: 'Aucun article associé',
        description: 'Les articles de confection apparaîtront ici.',
      );
    }

    return Column(
      children: [
        for (var index = 0; index < projects.length; index++) ...[
          _ProjectItem(project: projects[index]),
          if (index != projects.length - 1)
            const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _ProjectItem extends StatelessWidget {
  const _ProjectItem({required this.project});

  final ProjectModel project;

  @override
  Widget build(BuildContext context) {
    final measurementCount = _measurementCount(project.measurementsSnapshot);
    return PressableSurface(
      onTap: () => AppNavigator.toProjectDetail(context, projectId: project.id),
      semanticLabel:
          '${project.name}. ${project.status.label}. Ouvrir le détail.',
      accentColor: project.status.color,
      child: Row(
        children: [
          _ProjectThumb(project: project),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  project.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  [
                    project.garmentType,
                    if (project.forWhom?.trim().isNotEmpty == true)
                      project.forWhom!,
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
                const SizedBox(height: 7),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: 4,
                  children: [
                    _MetaChip(
                      icon: project.status.icon,
                      label: project.status.label,
                      color: project.status.color,
                    ),
                    if (measurementCount > 0)
                      _MetaChip(
                        icon: Icons.straighten_rounded,
                        label: '$measurementCount mesures',
                        color: context.statusForeground(AppColors.success),
                      ),
                    if (project.measurementNotes?.trim().isNotEmpty == true)
                      _MetaChip(
                        icon: Icons.notes_rounded,
                        label: 'Mesures écrites',
                        color: context.textSecondaryColor,
                      ),
                    // La consigne vocale était enregistrée et jamais relue :
                    // rien dans le détail d'une commande n'y renvoyait.
                    if (project.audioNotePath?.trim().isNotEmpty == true)
                      _MetaChip(
                        icon: Icons.mic_rounded,
                        label: 'Note vocale',
                        color: context.textSecondaryColor,
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Icon(Icons.chevron_right_rounded, color: context.textSecondaryColor),
        ],
      ),
    );
  }

  static int _measurementCount(String? snapshot) {
    if (snapshot == null || snapshot.isEmpty) return 0;
    try {
      final decoded = jsonDecode(snapshot);
      if (decoded is Map) {
        return decoded.values
            .where((value) => value is num && value > 0)
            .length;
      }
    } catch (_) {
      return 0;
    }
    return 0;
  }
}

class _ProjectThumb extends StatelessWidget {
  const _ProjectThumb({required this.project});

  final ProjectModel project;

  @override
  Widget build(BuildContext context) {
    final path = project.photoUrls.isEmpty ? null : project.photoUrls.first;
    if (path == null) {
      return Container(
        width: 58,
        height: 68,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: project.status.color.withValues(alpha: 0.09),
          borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
        ),
        child: Icon(Icons.checkroom_outlined, color: project.status.color),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
      child: Image.file(
        File(path),
        width: 58,
        height: 68,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => Container(
          width: 58,
          height: 68,
          alignment: Alignment.center,
          color: context.backgroundColor,
          child: const Icon(Icons.broken_image_outlined),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
