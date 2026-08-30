import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:get_it/get_it.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/services/template_service.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';

class ProjectModelStep extends ConsumerWidget {
  const ProjectModelStep({super.key, required this.onPickImage});

  final void Function(ImageSource) onPickImage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);
    final templates = GetIt.I<TemplateService>().allTemplates;

    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      children: [
        const AppSectionHeader(
          title: 'Quel vêtement faut-il réaliser ?',
          subtitle:
              'Décrivez le résultat attendu et ajoutez des références visuelles utiles.',
          icon: Icons.checkroom_rounded,
        ),
        if (templates.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 106,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: templates.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) {
                final template = templates[index];
                return SizedBox(
                  width: 128,
                  child: PressableSurface(
                    onTap: () => notifier.applyTemplate(template),
                    accentColor: Theme.of(context).colorScheme.primary,
                    semanticLabel: 'Utiliser le modèle ${template.name}',
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: context.surfaceLightColor,
                            borderRadius: BorderRadius.circular(
                              AppSpacing.radiusControl,
                            ),
                          ),
                          child: Icon(
                            Icons.auto_awesome_outlined,
                            color: context.textSecondaryColor,
                            size: 20,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          template.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: AppTextStyles.caption.copyWith(
                            color: context.textPrimaryColor,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        AppSectionSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Informations du modèle',
                style: AppTextStyles.h5.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Le type de vêtement est obligatoire. Le reste améliore la compréhension de l’équipe.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.garmentTypeController,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Type de vêtement *',
                  hintText: 'Ex. Grand boubou, robe, pantalon',
                  prefixIcon: const Icon(Icons.checkroom_outlined),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.nameController,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Nom interne de l’article',
                  hintText: 'Ex. Tenue Tabaski Awa',
                  prefixIcon: Icon(Icons.label_outline_rounded),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.descriptionController,
                minLines: 3,
                maxLines: 6,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Instructions et détails',
                  hintText:
                      'Coupe, longueur, col, manches, finition ou préférence du client',
                  alignLabelWithHint: true,
                  prefixIcon: Padding(
                    padding: EdgeInsets.only(bottom: 72),
                    child: Icon(Icons.notes_rounded),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppSectionSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Références visuelles',
                          style: AppTextStyles.h5.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${state.photoUrls.length} photo${state.photoUrls.length == 1 ? '' : 's'} ajoutée${state.photoUrls.length == 1 ? '' : 's'}',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton.filledTonal(
                    onPressed: () => _showImageSourcePicker(context),
                    tooltip: 'Ajouter une photo',
                    icon: const Icon(Icons.add_a_photo_outlined),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.photoUrls.isEmpty)
                PressableSurface(
                  onTap: () => _showImageSourcePicker(context),
                  accentColor: Theme.of(context).colorScheme.primary,
                  semanticLabel: 'Ajouter une photo du modèle',
                  child: SizedBox(
                    height: 130,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.add_photo_alternate_outlined,
                            size: 36,
                            color: context.textSecondaryColor,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Ajouter une photo de référence',
                            style: AppTextStyles.label.copyWith(
                              color: context.textPrimaryColor,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Caméra ou galerie',
                            style: AppTextStyles.caption.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SizedBox(
                  height: 132,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: state.photoUrls.length + 1,
                    separatorBuilder: (_, _) =>
                        const SizedBox(width: AppSpacing.sm),
                    itemBuilder: (context, index) {
                      if (index == state.photoUrls.length) {
                        return SizedBox(
                          width: 112,
                          child: PressableSurface(
                            onTap: () => _showImageSourcePicker(context),
                            accentColor: Theme.of(context).colorScheme.primary,
                            semanticLabel: 'Ajouter une autre photo',
                            child: Center(
                              child: Icon(
                                Icons.add_rounded,
                                size: 32,
                                color: context.textSecondaryColor,
                              ),
                            ),
                          ),
                        );
                      }

                      return Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(
                              AppSpacing.radiusMD,
                            ),
                            child: Image.file(
                              File(state.photoUrls[index]),
                              width: 116,
                              height: 132,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                width: 116,
                                height: 132,
                                color: context.surfaceLightColor,
                                alignment: Alignment.center,
                                child: const Icon(Icons.broken_image_outlined),
                              ),
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: IconButton.filled(
                              onPressed: () =>
                                  _confirmRemovePhoto(notifier, index),
                              tooltip: 'Retirer cette photo',
                              style: IconButton.styleFrom(
                                backgroundColor: Colors.black.withValues(
                                  alpha: 0.66,
                                ),
                                foregroundColor: Colors.white,
                                minimumSize: const Size(44, 44),
                              ),
                              icon: const Icon(Icons.close_rounded, size: 18),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  Future<void> _confirmRemovePhoto(AddEditProject notifier, int index) async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Retirer cette photo ?',
      message:
          'La référence visuelle sera supprimée de l’article. Vous pourrez en reprendre une autre.',
      confirmLabel: 'Retirer',
      cancelLabel: 'Conserver',
      isDangerous: true,
      icon: Icons.delete_outline_rounded,
    );
    if (confirmed == true) notifier.removePhoto(index);
  }

  void _showImageSourcePicker(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppSectionHeader(
              title: 'Ajouter une référence',
              subtitle: 'Choisissez la source de la photo',
              icon: Icons.add_a_photo_outlined,
            ),
            const SizedBox(height: AppSpacing.md),
            AppActionTile(
              title: 'Prendre une photo',
              subtitle: 'Ouvrir l’appareil photo',
              icon: Icons.camera_alt_outlined,
              onTap: () {
                Navigator.of(context).pop();
                onPickImage(ImageSource.camera);
              },
            ),
            const SizedBox(height: AppSpacing.xs),
            AppActionTile(
              title: 'Choisir dans la galerie',
              subtitle: 'Utiliser une image existante',
              icon: Icons.photo_library_outlined,
              onTap: () {
                Navigator.of(context).pop();
                onPickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }
}
