import 'package:flutter/material.dart';

import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';

class ProjectActionBar extends StatelessWidget {
  const ProjectActionBar({
    super.key,
    required this.project,
    required this.isPreviewMode,
    required this.onUpdateStatus,
    required this.onArchive,
  });

  final ProjectModel project;
  final bool isPreviewMode;
  final ValueChanged<ProjectStatus> onUpdateStatus;
  final VoidCallback onArchive;

  @override
  Widget build(BuildContext context) {
    if (isPreviewMode) return const SizedBox.shrink();

    final next = _next(project.status);
    final delivered = project.status == ProjectStatus.delivered;

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: context.surfaceLightColor,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
                ),
                child: Icon(
                  project.status.icon,
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Statut actuel · ${project.status.label}',
                      style: AppTextStyles.label.copyWith(
                        color: context.textPrimaryColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      delivered
                          ? 'L’article peut maintenant être archivé.'
                          : 'La prochaine étape sera enregistrée dans le suivi.',
                      style: AppTextStyles.bodySmall.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: delivered
                  ? onArchive
                  : next == null
                  ? null
                  : () => onUpdateStatus(next),
              icon: Icon(
                delivered
                    ? Icons.archive_outlined
                    : next?.icon ?? Icons.check_rounded,
              ),
              label: Text(_actionLabel(project.status)),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(AppSpacing.buttonHeightLG),
              ),
            ),
          ),
        ],
      ),
    );
  }

  ProjectStatus? _next(ProjectStatus status) => switch (status) {
    ProjectStatus.todo => ProjectStatus.inProgress,
    ProjectStatus.inProgress => ProjectStatus.completed,
    ProjectStatus.completed => ProjectStatus.delivered,
    ProjectStatus.delivered => null,
  };

  String _actionLabel(ProjectStatus status) => switch (status) {
    ProjectStatus.todo => 'Commencer la production',
    ProjectStatus.inProgress => 'Marquer comme terminé',
    ProjectStatus.completed => 'Confirmer la livraison',
    ProjectStatus.delivered => 'Archiver le dossier',
  };
}
