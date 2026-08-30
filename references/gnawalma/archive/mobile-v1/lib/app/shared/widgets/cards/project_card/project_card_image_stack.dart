import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../indicators/status_badge.dart';
import 'project_card_placeholder.dart';

class ProjectCardImageStack extends StatelessWidget {
  final ProjectModel project;
  final bool isOverdue;

  const ProjectCardImageStack({
    super.key,
    required this.project,
    required this.isOverdue,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusLG),
          ),
          child: Hero(
            tag: 'project-photo-${project.id}',
            child: project.fabricPhotoUrl != null
                ? Image.file(
                    File(project.fabricPhotoUrl!),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => ProjectCardPlaceholder(
                      garmentType: project.garmentType,
                    ),
                  )
                : project.photoUrls.isNotEmpty
                ? Image.file(
                    File(project.photoUrls.first),
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => ProjectCardPlaceholder(
                      garmentType: project.garmentType,
                    ),
                  )
                : ProjectCardPlaceholder(garmentType: project.garmentType),
          ),
        ),
        Positioned(
          top: AppSpacing.sm,
          right: AppSpacing.sm,
          child: StatusBadge.fromProjectStatus(
            project.status,
            isOverdue: isOverdue,
          ),
        ),
        if (isOverdue)
          Positioned(
            left: 0,
            top: 10,
            bottom: 10,
            child: Container(
              width: 4,
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.only(
                  topRight: Radius.circular(4),
                  bottomRight: Radius.circular(4),
                ),
              ),
            ),
          ),
        if (project.remainingAmount > 0)
          Positioned(
            bottom: AppSpacing.sm,
            right: AppSpacing.sm,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(AppSpacing.radiusXS),
              ),
              child: Text(
                'Reste: ${NumberFormat.currency(locale: 'fr_XOF', symbol: 'F', decimalDigits: 0).format(project.remainingAmount)}',
                style: const TextStyle(
                  color: AppColors.textOnPrimary,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        if (project.isRetouch)
          Positioned(
            bottom: AppSpacing.sm,
            left: AppSpacing.sm,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.warning,
                borderRadius: BorderRadius.circular(AppSpacing.radiusXS),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(
                    Icons.build_circle,
                    size: 10,
                    color: AppColors.textOnPrimary,
                  ),
                  SizedBox(width: 2),
                  Text(
                    'Retouche',
                    style: TextStyle(
                      color: AppColors.textOnPrimary,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
