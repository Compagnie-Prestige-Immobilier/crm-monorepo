import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/forms/measurement_input_widget.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../controllers/add_edit_measurement_provider.dart';

class AddEditMeasurementView extends ConsumerStatefulWidget {
  const AddEditMeasurementView({super.key, this.client});

  final ClientModel? client;

  @override
  ConsumerState<AddEditMeasurementView> createState() =>
      _AddEditMeasurementViewState();
}

class _AddEditMeasurementViewState
    extends ConsumerState<AddEditMeasurementView> {
  Map<String, double>? _baseline;

  Future<void> _confirmDiscard() async {
    final discard = await AppDialogs.showConfirmation(
      title: 'Abandonner les mesures ?',
      message: 'Les mesures saisies pour ce client ne seront pas enregistrées.',
      confirmLabel: 'Abandonner',
      cancelLabel: 'Continuer la saisie',
      isDangerous: true,
    );
    if (discard == true) AppNavigator.back();
  }

  @override
  Widget build(BuildContext context) {
    final client = widget.client;
    if (client == null) {
      return const Scaffold(
        appBar: CustomAppBar(title: 'Mesures', showBackButton: true),
        body: SafeArea(
          top: false,
          child: ErrorState(
            message:
                'Aucun client n’a été sélectionné pour enregistrer des mesures.',
          ),
        ),
      );
    }

    final state = ref.watch(addEditMeasurementProvider(initialClient: client));
    final notifier = ref.read(
      addEditMeasurementProvider(initialClient: client).notifier,
    );
    final measurementControllers = Listenable.merge([
      notifier.neckController,
      notifier.shoulderWidthController,
      notifier.bustController,
      notifier.waistController,
      notifier.hipController,
      notifier.totalHeightController,
      notifier.backLengthController,
      notifier.inseamLengthController,
    ]);

    return AnimatedBuilder(
      animation: measurementControllers,
      builder: (context, _) {
        final values = _initialValues(notifier);
        _baseline ??= Map.of(values);
        final completedCount = values.values.where((value) => value > 0).length;
        final canSave = completedCount > 0 && !state.isSaving;
        final isDirty = !mapEquals(_baseline, values);

        return PopScope(
          canPop: !isDirty && !state.isSaving,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop || state.isSaving) return;
            _confirmDiscard();
          },
          child: Scaffold(
            appBar: CustomAppBar(
              title: 'Mesures de ${client.displayName}',
              subtitle:
                  '$completedCount mesure${completedCount > 1 ? 's' : ''} renseignée${completedCount > 1 ? 's' : ''}',
              showBackButton: true,
            ),
            body: SafeArea(
              top: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.sm,
                      AppSpacing.md,
                      AppSpacing.sm,
                    ),
                    child: AppStatusBanner(
                      title: completedCount == 0
                          ? 'Commencez par une mesure'
                          : 'Progression enregistrable',
                      message: completedCount == 0
                          ? 'Touchez une zone du mannequin, puis ajustez la valeur proposée pour enregistrer au moins une mesure.'
                          : '$completedCount mesure${completedCount > 1 ? 's' : ''} seront ajoutée${completedCount > 1 ? 's' : ''} à l’historique du client.',
                      icon: completedCount == 0
                          ? Icons.straighten_rounded
                          : Icons.check_circle_outline_rounded,
                      tone: completedCount == 0
                          ? AppStatusTone.info
                          : AppStatusTone.success,
                    ),
                  ),
                  Expanded(
                    child: Form(
                      key: notifier.formKey,
                      child: MeasurementInputWidget(
                        initialValues: values,
                        initialGender: client.gender,
                        garmentType: 'CUSTOM',
                        onMeasurementChanged: (key, value) =>
                            _updateController(key, value, notifier),
                        onGenderChanged: (_) {},
                      ),
                    ),
                  ),
                ],
              ),
            ),
            bottomNavigationBar: AppStickyActionBar(
              primary: FilledButton.icon(
                onPressed: canSave
                    ? () {
                        HapticFeedback.mediumImpact();
                        FocusScope.of(context).unfocus();
                        notifier.saveMeasurement();
                      }
                    : null,
                icon: state.isSaving
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator.adaptive(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(
                            Theme.of(context).colorScheme.onPrimary,
                          ),
                        ),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(
                  state.isSaving
                      ? 'Enregistrement…'
                      : completedCount == 0
                      ? 'Renseignez une mesure'
                      : 'Enregistrer les mesures',
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Map<String, double> _initialValues(AddEditMeasurement notifier) => {
    'tourCou': AppNumbers.tryParse(notifier.neckController.text) ?? 0,
    'tourEpaule':
        AppNumbers.tryParse(notifier.shoulderWidthController.text) ?? 0,
    'tourPoitrine': AppNumbers.tryParse(notifier.bustController.text) ?? 0,
    'tourTaille': AppNumbers.tryParse(notifier.waistController.text) ?? 0,
    'tourHanches': AppNumbers.tryParse(notifier.hipController.text) ?? 0,
    'longueurTotale':
        AppNumbers.tryParse(notifier.totalHeightController.text) ?? 0,
    'epauleGenou': AppNumbers.tryParse(notifier.backLengthController.text) ?? 0,
    'tailleSol': AppNumbers.tryParse(notifier.inseamLengthController.text) ?? 0,
  };

  void _updateController(
    String key,
    double value,
    AddEditMeasurement notifier,
  ) {
    final text = value.toStringAsFixed(1).replaceAll('.0', '');
    switch (key) {
      case 'tourCou':
        notifier.neckController.text = text;
        break;
      case 'tourEpaule':
        notifier.shoulderWidthController.text = text;
        break;
      case 'tourPoitrine':
        notifier.bustController.text = text;
        break;
      case 'tourTaille':
        notifier.waistController.text = text;
        break;
      case 'tourHanches':
        notifier.hipController.text = text;
        break;
      case 'longueurTotale':
        notifier.totalHeightController.text = text;
        break;
      case 'epauleGenou':
        notifier.backLengthController.text = text;
        break;
      case 'tailleSol':
        notifier.inseamLengthController.text = text;
        break;
    }
  }
}
