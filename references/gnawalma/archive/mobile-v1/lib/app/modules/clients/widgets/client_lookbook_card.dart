import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../data/models/project_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';

class ClientLookbookCard extends StatelessWidget {
  const ClientLookbookCard({
    super.key,
    required this.project,
    required this.onTap,
  });

  final ProjectModel project;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final delivery = project.actualDeliveryDate ?? project.expectedDeliveryDate;
    return SizedBox(
      width: 176,
      child: PressableSurface(
        onTap: onTap,
        padding: EdgeInsets.zero,
        semanticLabel:
            '${project.name}. ${project.garmentType}. Statut ${project.status.label}.',
        elevated: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1.22,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _ProjectImage(project: project),
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: context.surfaceColor.withValues(alpha: .94),
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusSheetTop,
                        ),
                        border: Border.all(
                          color: project.status.color.withValues(alpha: .28),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            project.status.icon,
                            size: 14,
                            color: project.status.color,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            project.status.label,
                            style: AppTextStyles.caption.copyWith(
                              color: project.status.color,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: context.textPrimaryColor,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    delivery == null
                        ? project.garmentType
                        : '${project.garmentType} · ${DateFormat('MMM yyyy', 'fr').format(delivery)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.caption.copyWith(
                      color: context.textSecondaryColor,
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

class _ProjectImage extends StatelessWidget {
  const _ProjectImage({required this.project});

  final ProjectModel project;

  @override
  Widget build(BuildContext context) {
    final path = project.photoUrls.isEmpty ? null : project.photoUrls.first;
    if (path != null && path.trim().isNotEmpty) {
      return Image.file(
        File(path),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _Fallback(project: project),
      );
    }
    return _Fallback(project: project);
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.project});

  final ProjectModel project;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: project.status.color.withValues(alpha: .08),
      child: Center(
        child: Icon(
          Icons.checkroom_rounded,
          size: 42,
          color: project.status.color,
        ),
      ),
    );
  }
}
