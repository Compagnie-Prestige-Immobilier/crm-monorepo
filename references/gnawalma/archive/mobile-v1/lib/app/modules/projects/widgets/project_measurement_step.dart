import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/forms/measurement_input_widget.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';

class ProjectMeasurementStep extends ConsumerWidget {
  const ProjectMeasurementStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: Column(
            children: [
              AppSectionHeader(
                title: 'Vérifier les mesures',
                subtitle:
                    'Touchez une mesure, puis ajustez-la avec la réglette.',
                icon: Icons.straighten_rounded,
                accentColor: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: AppSpacing.sm),
              AppStatusBanner(
                title: state.currentMeasurements.isEmpty
                    ? 'Aucune mesure enregistrée'
                    : '${state.currentMeasurements.length} mesure${state.currentMeasurements.length == 1 ? '' : 's'} renseignée${state.currentMeasurements.length == 1 ? '' : 's'}',
                message: state.currentMeasurements.isEmpty
                    ? 'Cette étape peut être complétée plus tard depuis la fiche client ou l’article.'
                    : 'Relisez les valeurs importantes avant de poursuivre.',
                icon: state.currentMeasurements.isEmpty
                    ? Icons.info_outline_rounded
                    : Icons.check_circle_outline_rounded,
                tone: state.currentMeasurements.isEmpty
                    ? AppStatusTone.info
                    : AppStatusTone.success,
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
    );
  }
}
