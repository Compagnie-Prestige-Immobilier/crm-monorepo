import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';

/// Photo et description du tissu.
///
/// L'étape proposait auparavant de choisir un tissu dans le stock de l'atelier
/// et d'en déduire un métrage. Le stock n'est plus géré : ce qui reste est ce
/// que l'atelier regarde réellement pour ne pas confondre deux coupons, une
/// photo et quelques mots.
class ProjectFabricStep extends ConsumerWidget {
  const ProjectFabricStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);
    final hasPhoto = state.clientFabricPhotoUrl != null;

    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      children: [
        const AppSectionHeader(
          title: 'Le tissu',
          subtitle:
              'Une photo et une description suffisent à l’identifier sans ambiguïté.',
          icon: Icons.texture_rounded,
        ),
        const SizedBox(height: AppSpacing.md),
        AppSectionSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Photo du tissu',
                style: AppTextStyles.h5.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Recommandé pour éviter les échanges de tissus similaires.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (!hasPhoto)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: notifier.pickClientFabricPhoto,
                    icon: const Icon(Icons.camera_alt_outlined),
                    label: const Text('Prendre une photo'),
                  ),
                )
              else
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
                      child: Image.file(
                        File(state.clientFabricPhotoUrl!),
                        width: double.infinity,
                        height: 210,
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: IconButton.filledTonal(
                        onPressed: () => _confirmRemovePhoto(notifier),
                        tooltip: 'Retirer la photo',
                        style: IconButton.styleFrom(
                          minimumSize: const Size(44, 44),
                        ),
                        icon: const Icon(Icons.delete_outline_rounded),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppSectionSurface(
          child: TextFormField(
            controller: notifier.clientFabricDescription,
            minLines: 3,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Description du tissu',
              hintText: 'Couleur, motif, matière ou signe distinctif',
              alignLabelWithHint: true,
              prefixIcon: Padding(
                padding: EdgeInsets.only(bottom: 62),
                child: Icon(Icons.description_outlined),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  Future<void> _confirmRemovePhoto(AddEditProject notifier) async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Retirer la photo du tissu ?',
      message:
          'L’équipe n’aura plus de repère visuel pour identifier le tissu du client.',
      confirmLabel: 'Retirer',
      cancelLabel: 'Conserver',
      isDangerous: true,
      icon: Icons.delete_outline_rounded,
    );
    if (confirmed == true) notifier.removeClientFabricPhoto();
  }
}
