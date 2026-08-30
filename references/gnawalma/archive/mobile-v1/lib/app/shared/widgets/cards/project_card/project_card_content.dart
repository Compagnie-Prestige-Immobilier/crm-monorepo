import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/utils/app_assets.dart';

class ProjectCardContent extends StatelessWidget {
  final ProjectModel project;
  final bool isOverdue;

  const ProjectCardContent({
    super.key,
    required this.project,
    required this.isOverdue,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.xs,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                project.name,
                style: AppTextStyles.h5.copyWith(
                  color: context.textPrimaryColor,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                project.garmentType,
                style: AppTextStyles.caption.copyWith(
                  color: context.textSecondaryColor,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Progression',
                    style: TextStyle(
                      fontSize: 10,
                      color: context.textSecondaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '${project.progressPercentage.isFinite ? project.progressPercentage.toInt() : 0}%',
                    style: TextStyle(
                      fontSize: 10,
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppSpacing.radiusCircle),
                child: LinearProgressIndicator(
                  value:
                      (project.progressPercentage.isFinite
                          ? project.progressPercentage
                          : 0) /
                      100,
                  backgroundColor: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.1),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    project.progressPercentage == 100
                        ? AppColors.success
                        : Theme.of(context).colorScheme.primary,
                  ),
                  minHeight: 4,
                ),
              ),
            ],
          ),
          Row(
            children: [
              ColorFiltered(
                colorFilter: ColorFilter.mode(
                  isOverdue ? AppColors.error : context.textSecondaryColor,
                  BlendMode.srcIn,
                ),
                child: Image.asset(AppAssets.uiCalendar, width: 14, height: 14),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  project.expectedDeliveryDate != null
                      ? DateFormat(
                          'dd/MM/yyyy',
                          'fr_FR',
                        ).format(project.expectedDeliveryDate!)
                      : 'Pas de date',
                  style: AppTextStyles.caption.copyWith(
                    color: isOverdue
                        ? AppColors.error
                        : context.textSecondaryColor,
                    fontWeight: isOverdue ? FontWeight.bold : null,
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
