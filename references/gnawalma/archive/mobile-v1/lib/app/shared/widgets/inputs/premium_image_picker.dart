import 'dart:io';

import 'package:flutter/material.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_text_styles.dart';
import '../../theme/app_spacing.dart';

class PremiumImagePicker extends StatelessWidget {
  final String label;
  final String? imagePath;
  final VoidCallback onPick;
  final VoidCallback onRemove;

  const PremiumImagePicker({
    super.key,
    required this.label,
    required this.imagePath,
    required this.onPick,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    if (imagePath != null) {
      return Stack(
        alignment: Alignment.topRight,
        children: [
          Container(
            width: double.infinity,
            height: 180,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
              image: DecorationImage(
                image: FileImage(File(imagePath!)),
                fit: BoxFit.cover,
              ),
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.58),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: onPick,
                  icon: const Icon(Icons.edit, color: Colors.white),
                  tooltip: 'Changer',
                ),
                IconButton(
                  onPressed: onRemove,
                  icon: const Icon(Icons.delete, color: Colors.redAccent),
                  tooltip: 'Supprimer',
                ),
              ],
            ),
          ),
        ],
      );
    }

    return Material(
      color: context.surfaceColor,
      borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
      child: InkWell(
        onTap: onPick,
        borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
        child: Container(
          width: double.infinity,
          height: 120,
          decoration: BoxDecoration(
            border: Border.all(color: context.borderColor),
            borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.add_a_photo,
                size: 32,
                color: context.textSecondaryColor,
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: AppTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.w600,
                  color: context.textSecondaryColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
