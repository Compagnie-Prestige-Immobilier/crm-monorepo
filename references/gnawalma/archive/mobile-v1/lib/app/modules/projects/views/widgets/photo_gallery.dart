import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';

class PhotoGallery extends StatelessWidget {
  const PhotoGallery({super.key, required this.photoUrls});

  final List<String> photoUrls;

  @override
  Widget build(BuildContext context) {
    if (photoUrls.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 174,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(bottom: 4),
        itemCount: photoUrls.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          return SizedBox(
            width: 156,
            child: PressableSurface(
              onTap: () => _openPhoto(context, photoUrls[index], index),
              padding: EdgeInsets.zero,
              semanticLabel: 'Ouvrir la photo ${index + 1}',
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(
                      AppSpacing.radiusLG - 1,
                    ),
                    child: Image.file(
                      File(photoUrls[index]),
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => ColoredBox(
                        color: context.surfaceLightColor,
                        child: Center(
                          child: Icon(
                            Icons.broken_image_outlined,
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 8,
                    bottom: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.66),
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusSheetTop,
                        ),
                      ),
                      child: Text(
                        '${index + 1}/${photoUrls.length}',
                        style: AppTextStyles.caption.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openPhoto(BuildContext context, String path, int index) {
    showDialog<void>(
      context: context,
      builder: (context) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: SafeArea(
          child: Stack(
            children: [
              Center(
                child: InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 4,
                  child: Image.file(
                    File(path),
                    fit: BoxFit.contain,
                    errorBuilder: (_, _, _) => const Icon(
                      Icons.broken_image_outlined,
                      color: Colors.white70,
                      size: 54,
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 8,
                left: 8,
                child: IconButton.filled(
                  onPressed: () => Navigator.of(context).pop(),
                  tooltip: 'Fermer',
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              Positioned(
                top: 16,
                right: 20,
                child: Text(
                  '${index + 1}/${photoUrls.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
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
