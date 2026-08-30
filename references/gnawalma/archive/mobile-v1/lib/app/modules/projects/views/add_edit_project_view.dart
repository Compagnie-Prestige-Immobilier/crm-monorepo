import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/models/project_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/bottom_action_bar_widget.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/navigation/step_indicator_widget.dart';
import '../controllers/add_edit_project_provider.dart';
import '../controllers/add_edit_project_state.dart';
import '../widgets/project_client_step.dart';
import '../widgets/project_contract_step.dart';
import '../widgets/project_fabric_step.dart';
import '../widgets/project_info_section.dart';
import '../widgets/project_measurement_step.dart';
import '../widgets/project_model_step.dart';
import '../widgets/project_planning_section.dart';
import '../widgets/project_technique_section.dart';

class AddEditProjectView extends ConsumerStatefulWidget {
  const AddEditProjectView({super.key, this.project});

  final ProjectModel? project;

  @override
  ConsumerState<AddEditProjectView> createState() => _AddEditProjectViewState();
}

class _AddEditProjectViewState extends ConsumerState<AddEditProjectView> {
  AddEditProject? _notifier;
  bool _listenersAttached = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _attachListeners());
  }

  void _attachListeners() {
    if (!mounted || _listenersAttached) return;
    final notifier = ref.read(
      addEditProjectProvider(project: widget.project).notifier,
    );
    _notifier = notifier;
    for (final controller in _controllers(notifier)) {
      controller.addListener(_refreshValidation);
    }
    _listenersAttached = true;
    if (mounted) setState(() {});
  }

  List<TextEditingController> _controllers(AddEditProject notifier) => [
    notifier.nameController,
    notifier.garmentTypeController,
    notifier.priceController,
    notifier.advancePaymentController,
    notifier.clientNameController,
    notifier.clientFabricDescription,
  ];

  void _refreshValidation() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    final notifier = _notifier;
    if (notifier != null && _listenersAttached) {
      for (final controller in _controllers(notifier)) {
        controller.removeListener(_refreshValidation);
      }
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = addEditProjectProvider(project: widget.project);
    final state = ref.watch(provider);
    final notifier = ref.read(provider.notifier);
    final canContinue = _canContinue(state, notifier);

    final isMidWizard = !state.isEditMode && state.currentStep > 0;

    return PopScope(
      canPop: !isMidWizard && !_hasPendingChanges(state, notifier),
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await _handleBack(state, notifier);
      },
      child: Scaffold(
        backgroundColor: context.backgroundColor,
        appBar: CustomAppBar(
          title: state.isEditMode ? 'Modifier l’article' : 'Nouvel article',
          showBackButton: true,
          onBackPressed: () => _handleBack(state, notifier),
        ),
        body: SafeArea(
          top: false,
          bottom: false,
          child: state.isEditMode
              ? _buildEditMode(context, state, notifier, canContinue)
              : _buildWizard(context, state, notifier, canContinue),
        ),
      ),
    );
  }

  Future<void> _handleBack(
    AddEditProjectState state,
    AddEditProject notifier,
  ) async {
    if (!state.isEditMode && state.currentStep > 0) {
      notifier.previousStep();
      return;
    }

    final navigator = Navigator.of(context);
    if (!_hasPendingChanges(state, notifier)) {
      navigator.pop();
      return;
    }

    final confirmed = await AppDialogs.showConfirmation(
      title: 'Abandonner la saisie ?',
      message:
          'Les informations saisies pour cet article ne seront pas enregistrées.',
      confirmLabel: 'Abandonner',
      cancelLabel: 'Continuer la saisie',
      isDangerous: true,
      icon: Icons.warning_amber_rounded,
    );
    if (confirmed == true && mounted) {
      navigator.pop();
    }
  }

  bool _hasPendingChanges(AddEditProjectState state, AddEditProject notifier) {
    if (state.isSaving) return false;

    if (state.isEditMode) {
      final project = state.existingProject;
      if (project == null) return false;
      return notifier.nameController.text.trim() != project.name.trim() ||
          notifier.garmentTypeController.text.trim() !=
              project.garmentType.trim() ||
          !AppNumbers.sameNumber(
            notifier.priceController.text,
            project.estimatedPrice?.toString() ?? '0',
          ) ||
          !AppNumbers.sameNumber(
            notifier.advancePaymentController.text,
            project.advancePayment?.toString() ?? '0',
          );
    }

    return state.currentStep > 0 ||
        state.selectedClient != null ||
        state.clientFabricPhotoUrl != null ||
        _controllers(
          notifier,
        ).any((controller) => controller.text.trim().isNotEmpty);
  }

  Widget _buildWizard(
    BuildContext context,
    AddEditProjectState state,
    AddEditProject notifier,
    bool canContinue,
  ) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final title = state.steps[state.currentStep];
    final guidance = _stepGuidance(state.currentStep);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            AppSpacing.sm,
            AppSpacing.gutter,
            0,
          ),
          child: Column(
            children: [
              StepIndicator(
                currentStep: state.currentStep,
                totalSteps: state.steps.length,
              ),
              const SizedBox(height: AppSpacing.sm),
              AppStatusBanner(
                title: 'Étape ${state.currentStep + 1} · $title',
                message: canContinue
                    ? 'Cette étape est complète. Vous pouvez poursuivre.'
                    : guidance,
                icon: canContinue
                    ? Icons.check_circle_outline_rounded
                    : Icons.info_outline_rounded,
                tone: canContinue ? AppStatusTone.success : AppStatusTone.info,
              ),
            ],
          ),
        ),
        Expanded(
          child: AnimatedSwitcher(
            duration: reduceMotion
                ? Duration.zero
                : const Duration(milliseconds: 220),
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.025, 0),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            ),
            child: KeyedSubtree(
              key: ValueKey<int>(state.currentStep),
              child: _currentStep(state),
            ),
          ),
        ),
        BottomActionBar(
          showBackButton: state.currentStep > 0,
          onBack: notifier.previousStep,
          onNext: notifier.nextStep,
          nextLabel: state.currentStep == state.steps.length - 1
              ? 'Créer l’article'
              : 'Continuer',
          nextIcon: state.currentStep == state.steps.length - 1
              ? Icons.check_rounded
              : Icons.arrow_forward_rounded,
          isLoading: state.isSaving,
          isNextEnabled: canContinue,
        ),
      ],
    );
  }

  Widget _currentStep(AddEditProjectState state) {
    return switch (state.currentStep) {
      0 => const ProjectClientStep(),
      1 => const ProjectFabricStep(),
      2 => ProjectModelStep(onPickImage: _pickImage),
      3 => const ProjectMeasurementStep(),
      4 => const ProjectContractStep(),
      _ => const SizedBox.shrink(),
    };
  }

  void _pickImage(ImageSource source) {
    ref
        .read(addEditProjectProvider(project: widget.project).notifier)
        .pickPhoto(source);
  }

  Widget _buildEditMode(
    BuildContext context,
    AddEditProjectState state,
    AddEditProject notifier,
    bool canSave,
  ) {
    return Column(
      children: [
        Expanded(
          child: Form(
            key: notifier.formKey,
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                0,
                AppSpacing.gutter,
                AppSpacing.xl,
              ),
              children: [
                AppPageHeader(
                  eyebrow: 'DOSSIER DE PRODUCTION',
                  title: 'Mettre l’article à jour',
                  subtitle:
                      'Corrigez les informations sans perdre l’historique de la commande.',
                  accentColor: Theme.of(context).colorScheme.primary,
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                ),
                AppStatusBanner(
                  title: canSave
                      ? 'Prêt à enregistrer'
                      : 'Informations requises',
                  message: canSave
                      ? 'Les informations essentielles sont valides.'
                      : 'Renseignez au minimum la désignation, le type de vêtement et un prix valide.',
                  icon: canSave
                      ? Icons.check_circle_outline_rounded
                      : Icons.edit_note_rounded,
                  tone: canSave ? AppStatusTone.success : AppStatusTone.warning,
                ),
                const SizedBox(height: AppSpacing.lg),
                const ProjectInfoSection(),
                const SizedBox(height: AppSpacing.md),
                const ProjectTechniqueSection(),
                const SizedBox(height: AppSpacing.md),
                const ProjectPlanningSection(),
              ],
            ),
          ),
        ),
        AppStickyActionBar(
          secondary: OutlinedButton.icon(
            onPressed: state.isSaving
                ? null
                : () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.close_rounded),
            label: const Text('Annuler'),
          ),
          primary: FilledButton.icon(
            onPressed: !canSave || state.isSaving ? null : notifier.saveProject,
            icon: state.isSaving
                ? SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator.adaptive(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Theme.of(context).colorScheme.onPrimary,
                      ),
                    ),
                  )
                : const Icon(Icons.save_rounded),
            label: Text(state.isSaving ? 'Enregistrement…' : 'Enregistrer'),
          ),
        ),
      ],
    );
  }

  bool _canContinue(AddEditProjectState state, AddEditProject notifier) {
    if (state.isSaving) return false;

    if (state.isEditMode) {
      final price = AppNumbers.tryParse(notifier.priceController.text.trim());
      return notifier.nameController.text.trim().isNotEmpty &&
          notifier.garmentTypeController.text.trim().isNotEmpty &&
          price != null &&
          price > 0;
    }

    return switch (state.currentStep) {
      0 =>
        state.selectedClient != null ||
            notifier.clientNameController.text.trim().length >= 2,
      // Photo ou description : l'étape ne bloque plus sur un tissu du stock,
      // qui n'existe plus.
      1 =>
        state.clientFabricPhotoUrl != null ||
            notifier.clientFabricDescription.text.trim().isNotEmpty,
      2 => notifier.garmentTypeController.text.trim().isNotEmpty,
      3 => true,
      4 => _contractIsValid(state, notifier),
      _ => false,
    };
  }

  bool _contractIsValid(AddEditProjectState state, AddEditProject notifier) {
    final total = AppNumbers.tryParse(notifier.priceController.text.trim());
    final advance =
        AppNumbers.tryParse(notifier.advancePaymentController.text.trim()) ?? 0;
    return total != null &&
        total > 0 &&
        advance >= 0 &&
        advance <= total &&
        state.expectedDeliveryDate != null;
  }

  String _stepGuidance(int step) => switch (step) {
    0 => 'Choisissez un client existant ou saisissez son nom.',
    1 =>
      'Sélectionnez un tissu du stock ou décrivez celui apporté par le client.',
    2 => 'Ajoutez au minimum le type de vêtement.',
    3 =>
      'Vérifiez les mesures utiles. Cette étape peut être complétée plus tard.',
    4 =>
      'Saisissez un prix positif, un acompte cohérent et une date de livraison.',
    _ => 'Complétez les informations demandées.',
  };
}
