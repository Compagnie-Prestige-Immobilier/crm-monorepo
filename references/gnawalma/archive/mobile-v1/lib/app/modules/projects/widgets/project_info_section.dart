import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/project_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';

class ProjectInfoSection extends ConsumerWidget {
  const ProjectInfoSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppSectionHeader(
          title: 'Identification',
          subtitle: 'Nom, type de vêtement et statut de production',
          icon: Icons.badge_outlined,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppSectionSurface(
          child: Column(
            children: [
              TextFormField(
                controller: notifier.nameController,
                scrollPadding: const EdgeInsets.only(
                  bottom: AppSpacing.keyboardScrollPadding,
                ),
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Ajoutez une désignation claire.'
                    : null,
                decoration: InputDecoration(
                  labelText: 'Désignation *',
                  hintText: 'Ex. Tenue Tabaski Awa',
                  prefixIcon: const Icon(Icons.label_outline_rounded),
                  suffixIcon: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: notifier.nameController,
                    builder: (_, value, _) => value.text.trim().isEmpty
                        ? const SizedBox.shrink()
                        : Icon(
                            Icons.check_circle_rounded,
                            color: context.statusForeground(AppColors.success),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.garmentTypeController,
                scrollPadding: const EdgeInsets.only(
                  bottom: AppSpacing.keyboardScrollPadding,
                ),
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.next,
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Précisez le type de vêtement.'
                    : null,
                decoration: InputDecoration(
                  labelText: 'Type de vêtement *',
                  hintText: 'Ex. Robe, boubou, pantalon',
                  prefixIcon: const Icon(Icons.checkroom_outlined),
                  suffixIcon: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: notifier.garmentTypeController,
                    builder: (_, value, _) => value.text.trim().isEmpty
                        ? const SizedBox.shrink()
                        : Icon(
                            Icons.check_circle_rounded,
                            color: context.statusForeground(AppColors.success),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              DropdownButtonFormField<ProjectStatus>(
                initialValue: state.selectedStatus,
                decoration: const InputDecoration(
                  labelText: 'Statut de production',
                  prefixIcon: Icon(Icons.task_alt_rounded),
                ),
                items: ProjectStatus.values
                    .map(
                      (status) => DropdownMenuItem(
                        value: status,
                        child: Row(
                          children: [
                            Icon(status.icon, size: 19, color: status.color),
                            const SizedBox(width: 9),
                            Text(status.label),
                          ],
                        ),
                      ),
                    )
                    .toList(growable: false),
                onChanged: (value) {
                  if (value != null) notifier.setStatus(value);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
