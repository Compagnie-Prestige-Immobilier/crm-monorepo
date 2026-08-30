import '../../../shared/utils/app_money.dart';
import '../../../shared/utils/app_numbers.dart';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/forms/app_text_field.dart';
import '../../../shared/widgets/inputs/premium_image_picker.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/new_order_provider.dart';

class ProjectDetailsCard extends ConsumerWidget {
  const ProjectDetailsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final money = ref.watch(moneyFormatterProvider);

    return AppSectionSurface(
      showAccent: true,
      accentColor: Theme.of(context).colorScheme.primary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Description du vêtement',
            subtitle: 'Nom, références visuelles et matière utilisée',
            icon: Icons.checkroom_outlined,
            accentColor: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Type de vêtement',
            hint: 'Ex. boubou, robe longue, chemise',
            controller: notifier.garmentTypeController,
            onChanged: notifier.setGarmentType,
            icon: Icons.checkroom_outlined,
            isValid: state.garmentType.trim().isNotEmpty,
            errorText: state.itemErrors['garmentType'],
          ),
          const SizedBox(height: AppSpacing.lg),
          AppSectionHeader(
            title: 'Photos de référence',
            subtitle: state.itemPhotos.isEmpty
                ? 'Facultatif, mais utile pour éviter les ambiguïtés'
                : '${state.itemPhotos.length} photo${state.itemPhotos.length > 1 ? 's' : ''} ajoutée${state.itemPhotos.length > 1 ? 's' : ''}',
            icon: Icons.photo_library_outlined,
            accentColor: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 96,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _AddPhotoTile(
                  onTap: () => _showImageSourceSelection(
                    context,
                    notifier.pickModelPhoto,
                  ),
                ),
                for (final entry in state.itemPhotos.asMap().entries)
                  _ReferencePhoto(
                    path: entry.value,
                    onRemove: () => notifier.removeModelPhoto(entry.key),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          AppSectionHeader(
            title: 'Tissu',
            subtitle: 'Une photo et un mot suffisent à le reconnaître',
            icon: Icons.texture_rounded,
            accentColor: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Description du tissu',
            hint: 'Couleur, motif ou particularité',
            onChanged: notifier.setFabricNote,
            maxLines: 2,
            icon: Icons.notes_rounded,
          ),
          const SizedBox(height: AppSpacing.md),
          PremiumImagePicker(
            label: 'Photo du tissu',
            imagePath: state.fabricPhoto,
            onPick: () =>
                _showImageSourceSelection(context, notifier.pickFabricPhoto),
            onRemove: notifier.removeFabricPhoto,
          ),
          const SizedBox(height: AppSpacing.xl),
          AppTextField(
            label: 'Prix de confection',
            hint: '0',
            controller: notifier.priceController,
            keyboardType: TextInputType.number,
            onChanged: (value) =>
                notifier.setItemPrice(AppNumbers.tryParse(value) ?? 0),
            icon: Icons.payments_outlined,
            suffix: money.currency,
            isValid: state.itemPrice > 0,
            errorText: state.itemErrors['itemPrice'],
          ),
        ],
      ),
    );
  }

  void _showImageSourceSelection(
    BuildContext context,
    ValueChanged<ImageSource> onSelect,
  ) {
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppSectionHeader(
              title: 'Ajouter une photo',
              subtitle: 'Choisissez la source de l’image',
              icon: Icons.add_a_photo_outlined,
              accentColor: Theme.of(sheetContext).colorScheme.primary,
            ),
            const SizedBox(height: AppSpacing.md),
            AppActionTile(
              title: 'Prendre une photo',
              subtitle: 'Utiliser l’appareil photo',
              icon: Icons.camera_alt_outlined,
              onTap: () {
                Navigator.of(sheetContext).pop();
                onSelect(ImageSource.camera);
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            AppActionTile(
              title: 'Choisir dans la galerie',
              subtitle: 'Utiliser une image existante',
              icon: Icons.photo_library_outlined,
              onTap: () {
                Navigator.of(sheetContext).pop();
                onSelect(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _AddPhotoTile extends StatelessWidget {
  const _AddPhotoTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 96,
      child: PressableSurface(
        onTap: onTap,
        accentColor: Theme.of(context).colorScheme.primary,
        semanticLabel: 'Ajouter une photo de référence',
        padding: EdgeInsets.zero,
        child: Center(
          child: Icon(
            Icons.add_a_photo_outlined,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ),
    );
  }
}

class _ReferencePhoto extends StatelessWidget {
  const _ReferencePhoto({required this.path, required this.onRemove});

  final String path;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      margin: const EdgeInsets.only(left: AppSpacing.sm),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
        border: Border.all(color: context.borderColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.file(
            File(path),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => ColoredBox(
              color: context.surfaceLightColor,
              child: const Icon(Icons.broken_image_outlined),
            ),
          ),
          Positioned(
            top: 5,
            right: 5,
            child: IconButton.filled(
              tooltip: 'Retirer la photo',
              visualDensity: VisualDensity.compact,
              onPressed: onRemove,
              icon: const Icon(Icons.close_rounded, size: 16),
              style: IconButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: AppColors.textOnPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
