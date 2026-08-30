import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/beneficiary_model.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/forms/measurement_input_widget.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/new_order_provider.dart';

class OrderMeasurementSection extends ConsumerWidget {
  const OrderMeasurementSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final count = state.itemMeasurements.values
        .where((value) => value > 0)
        .length;
    final complete = count >= 8;

    return PressableSurface(
      onTap: () => _openMeasurementStudio(context, state, notifier),
      semanticLabel: count == 0
          ? 'Ajouter les mesures du destinataire'
          : 'Modifier les mesures. $count mesures renseignées',
      selected: count > 0,
      accentColor: complete
          ? AppColors.success
          : Theme.of(context).colorScheme.primary,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color:
                  (complete
                          ? AppColors.success
                          : Theme.of(context).colorScheme.primary)
                      .withValues(alpha: 0.09),
              borderRadius: BorderRadius.circular(AppSpacing.radiusControl),
            ),
            child: Icon(
              complete ? Icons.fact_check_outlined : Icons.straighten_rounded,
              color: complete
                  ? AppColors.success
                  : Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Mesures du destinataire',
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  count == 0
                      ? 'Aucune mesure saisie'
                      : '$count mesure${count == 1 ? '' : 's'} renseignée${count == 1 ? '' : 's'}',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: complete
                        ? AppColors.success
                        : context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          if (count > 0)
            SelectionIndicator(
              selected: true,
              accent: complete
                  ? AppColors.success
                  : Theme.of(context).colorScheme.primary,
              size: 26,
            )
          else
            Icon(
              Icons.chevron_right_rounded,
              color: context.textSecondaryColor,
            ),
        ],
      ),
    );
  }

  void _openMeasurementStudio(
    BuildContext context,
    dynamic state,
    dynamic notifier,
  ) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (context) => Scaffold(
          backgroundColor: context.backgroundColor,
          appBar: AppBar(
            leading: IconButton(
              tooltip: 'Fermer',
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded),
            ),
            title: const Text('Studio de mesures'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Terminer'),
              ),
            ],
          ),
          body: Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  0,
                ),
                child: AppStatusBanner(
                  title: 'Mesures enregistrées automatiquement',
                  message:
                      'Chaque valeur valide est conservée dans le brouillon de l’article.',
                  icon: Icons.cloud_done_outlined,
                  tone: AppStatusTone.info,
                ),
              ),
              Expanded(
                child: MeasurementInputWidget(
                  key: ValueKey(
                    '${state.selectedClient?.id}_${state.selectedForWhom}_${state.selectedBeneficiary?.id}',
                  ),
                  initialValues: state.itemMeasurements,
                  initialGender:
                      state.selectedBeneficiary?.gender ==
                              BeneficiaryGender.female ||
                          (state.selectedBeneficiary == null &&
                              state.selectedClient?.gender == Gender.female)
                      ? Gender.female
                      : Gender.male,
                  garmentType: state.garmentType,
                  onMeasurementChanged: notifier.addMeasurement,
                  onGenderChanged: (_) {},
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
