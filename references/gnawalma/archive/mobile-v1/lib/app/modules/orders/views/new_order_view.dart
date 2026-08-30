import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_motion.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/visuals/reference_history_overlay.dart';
import '../controllers/new_order_provider.dart';
import '../controllers/new_order_state.dart';
import 'steps/client_selection_step.dart';
import 'steps/item_builder_step.dart';
import 'steps/payment_step.dart';

class NewOrderView extends ConsumerStatefulWidget {
  const NewOrderView({super.key, this.preSelectedClient});

  final ClientModel? preSelectedClient;

  @override
  ConsumerState<NewOrderView> createState() => _NewOrderViewState();
}

class _NewOrderViewState extends ConsumerState<NewOrderView> {
  bool _bypassGuard = false;

  @override
  void initState() {
    super.initState();
    if (widget.preSelectedClient != null) {
      Future.microtask(() {
        final notifier = ref.read(newOrderProvider.notifier);
        notifier.reset();
        notifier.init(widget.preSelectedClient);
      });
    }
  }

  bool _hasUnsavedData(NewOrderState state) =>
      state.selectedClient != null || state.cartItems.isNotEmpty;

  Future<bool> _confirmExit(NewOrderState state) async {
    if (!_hasUnsavedData(state)) return true;

    final confirmed = await AppDialogs.showConfirmation(
      title: 'Quitter la commande ?',
      message:
          'Les informations non enregistrées seront perdues. La commande ne sera pas créée.',
      confirmLabel: 'Quitter sans enregistrer',
      cancelLabel: 'Continuer la saisie',
      isDangerous: true,
      icon: Icons.warning_amber_rounded,
    );
    return confirmed ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);

    Future<void> goBack() async {
      if (state.currentStep > 0) {
        HapticFeedback.selectionClick();
        notifier.prevStep();
        return;
      }
      if (await _confirmExit(state) && mounted) {
        setState(() => _bypassGuard = true);
        AppNavigator.back();
      }
    }

    return PopScope(
      canPop:
          _bypassGuard || (state.currentStep == 0 && !_hasUnsavedData(state)),
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop) await goBack();
      },
      child: Scaffold(
        backgroundColor: context.backgroundColor,
        appBar: CustomAppBar(
          title: 'Nouvelle commande',
          onBackPressed: goBack,
          actions: [
            if (state.selectedClient != null && state.currentStep == 1)
              IconButton(
                tooltip: state.showHistory
                    ? 'Masquer les anciennes mesures'
                    : 'Afficher les anciennes mesures',
                onPressed: notifier.toggleHistory,
                icon: Badge(
                  isLabelVisible:
                      state.selectedClient?.latestMeasurement != null,
                  smallSize: 7,
                  child: Icon(
                    state.showHistory
                        ? Icons.history_toggle_off_rounded
                        : Icons.history_rounded,
                    color: state.showHistory
                        ? Theme.of(context).colorScheme.primary
                        : null,
                  ),
                ),
              ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Stack(
            children: [
              Column(
                children: [
                  _WizardHeadline(
                    stepLabels: state.steps,
                    currentStep: state.currentStep,
                    description: _stepDescription(state.currentStep),
                  ),
                  Expanded(
                    child: AnimatedSwitcher(
                      duration: AppMotion.duration(context, AppMotion.quick),
                      switchInCurve: Curves.easeOutCubic,
                      switchOutCurve: Curves.easeInCubic,
                      child: KeyedSubtree(
                        key: ValueKey(state.currentStep),
                        child: _buildStepContent(state.currentStep),
                      ),
                    ),
                  ),
                ],
              ),
              if (state.showHistory && state.selectedClient != null)
                Positioned.fill(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: notifier.toggleHistory,
                  ),
                ),
              Positioned(
                top: 0,
                right: 0,
                child: IgnorePointer(
                  ignoring: !state.showHistory,
                  child: AnimatedSlide(
                    duration: AppMotion.duration(context, AppMotion.quick),
                    curve: Curves.easeOutCubic,
                    offset: state.showHistory
                        ? Offset.zero
                        : const Offset(1.08, 0),
                    child: AnimatedOpacity(
                      duration: AppMotion.duration(context, AppMotion.exit),
                      opacity: state.showHistory ? 1 : 0,
                      child: state.selectedClient == null
                          ? const SizedBox.shrink()
                          : ConstrainedBox(
                              constraints: BoxConstraints(
                                maxHeight:
                                    MediaQuery.sizeOf(context).height * .7,
                              ),
                              child: SingleChildScrollView(
                                padding: EdgeInsets.only(
                                  bottom:
                                      MediaQuery.paddingOf(context).bottom +
                                      AppSpacing.md,
                                ),
                                child: ReferenceHistoryOverlay(
                                  label: state.selectedForWhom,
                                  measurements:
                                      state
                                          .selectedBeneficiary
                                          ?.measurementsMap ??
                                      state
                                          .selectedClient
                                          ?.latestMeasurement
                                          ?.standardMeasurements ??
                                      {},
                                  lastUpdate:
                                      state
                                          .selectedBeneficiary
                                          ?.measurementsUpdatedAt ??
                                      state
                                          .selectedClient
                                          ?.latestMeasurement
                                          ?.recordedDate,
                                  onClose: notifier.toggleHistory,
                                ),
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _stepDescription(int step) {
    switch (step) {
      case 0:
        return 'Choisissez la personne qui passe la commande.';
      case 1:
        return 'Ajoutez chaque vêtement, son tissu, ses mesures et son prix.';
      case 2:
        return 'Vérifiez le total, l’acompte et la date de livraison.';
      default:
        return '';
    }
  }

  Widget _buildStepContent(int currentStep) {
    switch (currentStep) {
      case 0:
        return const ClientSelectionStep();
      case 1:
        return const ItemBuilderStep();
      case 2:
        return const PaymentStep();
      default:
        return const SizedBox.shrink();
    }
  }
}

/// The wizard's fixed head.
///
/// Reads as progress rather than chrome: the position is stated in words first
/// ("ÉTAPE 2 SUR 3"), the step names itself at display weight, and a rail of
/// hairline segments carries the only accent on the screen — the segment the
/// user is standing on. The previous header gave the step name, a counter pill
/// and a full-width progress bar equal visual weight, so none of them answered
/// "where am I" faster than the others.
class _WizardHeadline extends StatelessWidget {
  const _WizardHeadline({
    required this.stepLabels,
    required this.currentStep,
    required this.description,
  });

  final List<String> stepLabels;
  final int currentStep;
  final String description;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final total = stepLabels.length;
    final safeStep = currentStep.clamp(0, total - 1);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: context.surfaceColor,
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ÉTAPE ${safeStep + 1} SUR $total',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            stepLabels[safeStep],
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
          ),
          if (description.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodySmall.copyWith(
                color: context.textSecondaryColor,
                height: 1.42,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _StepRail(currentStep: safeStep, totalSteps: total),
        ],
      ),
    );
  }
}

/// Segmented progress rail. One segment per step: ink behind, accent on the
/// segment in hand, hairline for what is still ahead.
class _StepRail extends StatelessWidget {
  const _StepRail({required this.currentStep, required this.totalSteps});

  final int currentStep;
  final int totalSteps;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final duration = AppMotion.duration(context, AppMotion.quick);

    return Semantics(
      label: 'Progression du formulaire',
      value: 'Étape ${currentStep + 1} sur $totalSteps',
      child: ExcludeSemantics(
        child: Row(
          children: [
            for (var index = 0; index < totalSteps; index++) ...[
              if (index > 0) const SizedBox(width: 6),
              Expanded(
                child: AnimatedContainer(
                  duration: duration,
                  curve: AppMotion.curve(context, AppMotion.enter),
                  height: 4,
                  decoration: BoxDecoration(
                    color: index < currentStep
                        ? scheme.primary
                        : index == currentStep
                        ? scheme.secondary
                        : scheme.outlineVariant,
                    borderRadius: BorderRadius.circular(
                      AppSpacing.radiusCircle,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
