import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';

/// The one way to set an atelier's logo.
///
/// Two screens used to do this job with nothing in common: the setup wizard
/// drew a 168px well at radius 28, centred, with a `+` glyph; the profile
/// editor drew a 96px well at radius 18, left-aligned in a row, with an unDraw
/// *illustration of a garment* standing in for the missing logo — the same
/// drawing used as the empty-orders state on eight other screens, so "no logo
/// yet" and "no orders yet" looked identical.
///
/// Neither offered the camera, a way to remove the image, or any indication
/// that something was happening while the file was copied. Both were a single
/// tap target with three lines of caption underneath explaining what the tap
/// would do.
class LogoPicker extends StatelessWidget {
  const LogoPicker({
    super.key,
    required this.logoPath,
    required this.onPick,
    required this.onRemove,
    this.busy = false,
    this.error,
    this.size = 112,
  });

  /// Absolute path to the stored image, or null when none is set.
  final String? logoPath;

  /// Called with the chosen source. The caller owns copying and persisting.
  final ValueChanged<ImageSource> onPick;

  final VoidCallback onRemove;

  /// Shows progress over the well while the image is being stored.
  final bool busy;

  /// Rendered under the well. A failed pick has to say so where it happened —
  /// a toast for a correctable error is a design-review rejection.
  final String? error;

  final double size;

  @override
  Widget build(BuildContext context) {
    final hasLogo = logoPath != null;
    final radius = BorderRadius.circular(AppSpacing.radiusContainer);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          button: true,
          label: hasLogo ? 'Modifier le logo' : 'Ajouter un logo',
          child: Material(
            type: MaterialType.transparency,
            borderRadius: radius,
            clipBehavior: Clip.antiAlias,
            child: Ink(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: context.surfaceLightColor,
                borderRadius: radius,
                border: Border.all(
                  color: error != null
                      ? Theme.of(context).colorScheme.error
                      : context.borderColor,
                  width: error != null ? 1.4 : 1,
                ),
                image: hasLogo
                    ? DecorationImage(
                        image: FileImage(File(logoPath!)),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: InkWell(
                onTap: busy ? null : () => _openSheet(context, hasLogo),
                borderRadius: radius,
                child: busy
                    ? const Center(
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator.adaptive(
                            strokeWidth: 2,
                          ),
                        ),
                      )
                    : hasLogo
                    ? null
                    // A plus, not a picture. What goes here is the user's
                    // own mark; showing a stock drawing of a garment
                    // suggests the slot is already filled.
                    : Icon(
                        Icons.add_rounded,
                        size: 28,
                        color: context.textSecondaryColor,
                      ),
              ),
            ),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            error!,
            style: AppTextStyles.caption.copyWith(
              color: Theme.of(context).colorScheme.error,
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _openSheet(BuildContext context, bool hasLogo) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Prendre une photo'),
              onTap: () {
                Navigator.pop(sheetContext);
                onPick(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choisir dans la galerie'),
              onTap: () {
                Navigator.pop(sheetContext);
                onPick(ImageSource.gallery);
              },
            ),
            if (hasLogo)
              ListTile(
                leading: Icon(
                  Icons.delete_outline_rounded,
                  color: Theme.of(sheetContext).colorScheme.error,
                ),
                title: Text(
                  'Retirer le logo',
                  style: TextStyle(
                    color: Theme.of(sheetContext).colorScheme.error,
                  ),
                ),
                onTap: () {
                  Navigator.pop(sheetContext);
                  onRemove();
                },
              ),
            const SizedBox(height: AppSpacing.xs),
          ],
        ),
      ),
    );
  }
}
