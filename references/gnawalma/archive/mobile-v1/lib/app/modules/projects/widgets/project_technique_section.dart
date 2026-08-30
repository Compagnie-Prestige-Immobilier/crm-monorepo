import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/forms/measurement_input_widget.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';

class ProjectTechniqueSection extends ConsumerWidget {
  const ProjectTechniqueSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppSectionHeader(
          title: 'Données techniques',
          icon: Icons.architecture_outlined,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppSectionSurface(
          child: Column(
            children: [
              AppActionTile(
                title: 'Mesures de l’article',
                subtitle: state.currentMeasurements.isEmpty
                    ? 'Aucune mesure renseignée'
                    : '${state.currentMeasurements.length} mesure${state.currentMeasurements.length == 1 ? '' : 's'} enregistrée${state.currentMeasurements.length == 1 ? '' : 's'}',
                value: 'Modifier',
                icon: Icons.straighten_rounded,
                accentColor: Theme.of(context).colorScheme.primary,
                onTap: () => _openMeasurements(context, state, notifier),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _openMeasurements(
    BuildContext context,
    dynamic state,
    dynamic notifier,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.9,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Mesures de l’article',
                          style: AppTextStyles.h4.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                        Text(
                          'Les changements restent liés à cet article.',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton.filledTonal(
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: 'Terminer la saisie',
                    icon: const Icon(Icons.check_rounded),
                  ),
                ],
              ),
            ),
            Expanded(
              child: MeasurementInputWidget(
                initialGender: state.selectedGender,
                initialValues: state.currentMeasurements,
                garmentType: notifier.garmentTypeController.text,
                onGenderChanged: notifier.setGender,
                onMeasurementChanged: notifier.updateMeasurement,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
