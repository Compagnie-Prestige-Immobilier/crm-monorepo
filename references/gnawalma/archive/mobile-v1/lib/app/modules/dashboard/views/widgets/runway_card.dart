import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../data/models/project_model.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';

/// A finished piece, waiting to be handed over.
///
/// The card carries a hairline so it exists on a white page even before the
/// photo loads, and the fallback visual is a neutral tile rather than a green
/// wash — the status is already stated by the badge, and saying it twice turned
/// a row of these into a band of colour.
class RunwayCard extends StatelessWidget {
  const RunwayCard({super.key, required this.project, required this.onTap});

  final ProjectModel project;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      accentColor: AppColors.success,
      showBorder: true,
      borderRadius: AppSpacing.radiusLG,
      padding: EdgeInsets.zero,
      semanticLabel:
          '${project.name}, prêt à livrer pour ${project.forWhom ?? 'le client'}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                _ProjectVisual(project: project),
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      // An opaque status chip, so the fill stays the base hue
                      // on both themes — lifting it for dark mode would leave
                      // white type on a pale green.
                      color: context.statusForeground(AppColors.success),
                      borderRadius: BorderRadius.circular(
                        AppSpacing.pillRadius,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.check_rounded,
                          color: AppColors.textOnPrimary,
                          size: 14,
                        ),
                        const SizedBox(width: AppSpacing.xxs),
                        Text(
                          'PRÊTE',
                          style: AppTextStyles.tag.copyWith(
                            color: AppColors.textOnPrimary,
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
            padding: const EdgeInsets.fromLTRB(12, 11, 12, 13),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  project.name,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  project.forWhom ?? 'Client non renseigné',
                  style: AppTextStyles.caption.copyWith(
                    color: context.textSecondaryColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProjectVisual extends StatelessWidget {
  const _ProjectVisual({required this.project});

  final ProjectModel project;

  @override
  Widget build(BuildContext context) {
    final placeholder = ColoredBox(
      color: context.surfaceLightColor,
      child: Center(
        child: Icon(
          Icons.checkroom_rounded,
          color: context.textSecondaryColor.withValues(alpha: 0.55),
          size: 38,
        ),
      ),
    );
    if (project.photoUrls.isEmpty) return placeholder;
    return Image.file(
      File(project.photoUrls.first),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => placeholder,
    );
  }
}
