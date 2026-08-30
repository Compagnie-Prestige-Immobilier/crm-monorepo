import '../../../../shared/utils/app_money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_motion.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/inputs/voice_note_recorder.dart';
import '../../../../shared/widgets/layouts/collapsible_section.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../controllers/new_order_provider.dart';
import '../../controllers/new_order_state.dart';
import '../../widgets/beneficiary_list.dart';
import '../../widgets/cart_summary_widget.dart';
import '../../widgets/order_bottom_bar.dart';
import '../../widgets/order_measurement_section.dart';
import '../../widgets/project_details_card.dart';
import '../../widgets/smart_templates_list.dart';
import '../../../../shared/widgets/states/composed_empty_panel.dart';

/// Step 2 — building the article.
///
/// The step opens with the thing being made rather than with advice about it:
/// the draft's own headline, one price set large. When there is no draft and
/// nothing in the cart the whole step would otherwise be a stack of empty
/// form sections, so it leads with a composed panel that names the situation
/// and offers the shortest way out of it.
class ItemBuilderStep extends ConsumerStatefulWidget {
  const ItemBuilderStep({super.key});

  @override
  ConsumerState<ItemBuilderStep> createState() => _ItemBuilderStepState();
}

class _ItemBuilderStepState extends ConsumerState<ItemBuilderStep> {
  final _scrollController = ScrollController();
  final _templatesKey = GlobalKey();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _jumpToTemplates() async {
    final target = _templatesKey.currentContext;
    if (target == null) return;
    await Scrollable.ensureVisible(
      target,
      duration: AppMotion.duration(context, AppMotion.standard),
      curve: AppMotion.curve(context, AppMotion.move),
      alignment: 0.05,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final hasDraft =
        state.garmentType.trim().isNotEmpty ||
        state.itemPrice > 0 ||
        state.itemPhotos.isNotEmpty ||
        state.fabricPhoto != null;

    return Column(
      children: [
        AnimatedSize(
          duration: AppMotion.duration(context, AppMotion.quick),
          curve: AppMotion.curve(context, AppMotion.enter),
          child: state.cartItems.isEmpty
              ? const SizedBox.shrink()
              : Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter,
                    AppSpacing.xs,
                    AppSpacing.gutter,
                    AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: context.surfaceColor,
                    border: Border(
                      bottom: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant,
                      ),
                    ),
                  ),
                  child: const CartSummaryWidget(),
                ),
        ),
        Expanded(
          child: SingleChildScrollView(
            key: const PageStorageKey('new-order-item-builder'),
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.gutter,
              AppSpacing.md,
              AppSpacing.gutter,
              AppSpacing.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!hasDraft && state.cartItems.isEmpty)
                  ComposedEmptyPanel(
                    motif: AtelierMotif.garment,
                    title: 'Aucun article dans cette commande',
                    message:
                        'Décrivez le premier vêtement : destinataire, modèle, tissu et prix.',
                    actionLabel: 'Partir d’un modèle',
                    actionIcon: Icons.auto_awesome_outlined,
                    onAction: _jumpToTemplates,
                  )
                else
                  _DraftHeadline(state: state),
                const SizedBox(height: AppSpacing.sectionSpacing),
                const AppSectionHeader(
                  title: 'Destinataire',
                  subtitle: 'La personne qui portera ce vêtement',
                  icon: Icons.person_pin_circle_outlined,
                ),
                const SizedBox(height: AppSpacing.md),
                const AppSectionSurface(
                  bordered: true,
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: BeneficiaryList(),
                ),
                const SizedBox(height: AppSpacing.sectionSpacing),
                AppSectionHeader(
                  key: _templatesKey,
                  title: 'Modèle rapide',
                  subtitle: 'Préremplissez le type de vêtement puis ajustez-le',
                  icon: Icons.auto_awesome_outlined,
                ),
                const SizedBox(height: AppSpacing.md),
                const SmartTemplatesList(),
                const SizedBox(height: AppSpacing.sectionSpacing),
                const AppSectionHeader(
                  title: 'Article et tissu',
                  subtitle:
                      'Informations nécessaires pour la production et le prix',
                  icon: Icons.content_cut_rounded,
                ),
                const SizedBox(height: AppSpacing.md),
                const ProjectDetailsCard(),
                const SizedBox(height: AppSpacing.sectionSpacing),
                const AppSectionHeader(
                  title: 'Consigne vocale',
                  subtitle:
                      'Ajoutez une précision difficile à résumer par écrit',
                  icon: Icons.mic_none_rounded,
                ),
                const SizedBox(height: AppSpacing.md),
                AppSectionSurface(
                  bordered: true,
                  child: VoiceNoteRecorder(
                    existingAudioPath: state.audioNotePath,
                    onRecordingComplete: notifier.setAudioNotePath,
                    onDelete: () => notifier.setAudioNotePath(null),
                  ),
                ),
                const SizedBox(height: AppSpacing.sectionSpacing),
                const AppSectionHeader(
                  title: 'Mesures',
                  subtitle:
                      'Recopiez ce que le client vous donne, puis affinez au besoin',
                  icon: Icons.straighten_rounded,
                ),
                const SizedBox(height: AppSpacing.md),
                AppSectionSurface(
                  bordered: true,
                  child: TextField(
                    controller: notifier.measurementNotesController,
                    onChanged: notifier.setMeasurementNotes,
                    minLines: 5,
                    maxLines: 12,
                    textCapitalization: TextCapitalization.sentences,
                    scrollPadding: const EdgeInsets.only(
                      bottom: AppSpacing.keyboardScrollPadding,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Mesures écrites',
                      hintText:
                          'Ex. épaule 42, poitrine 96, longueur 145, manche 58…',
                      alignLabelWithHint: true,
                      border: InputBorder.none,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                // Les huit champs chiffrés restent disponibles, repliés : ils
                // servent l'historique par mesure, pas la saisie courante.
                const CollapsibleSection(
                  title: 'Mesures chiffrées',
                  initiallyExpanded: false,
                  child: OrderMeasurementSection(),
                ),
              ],
            ),
          ),
        ),
        const OrderBottomBar(),
      ],
    );
  }
}

/// The draft, stated the way the workshop states it: who it is for, what it is,
/// what it costs. One large mono figure instead of a status banner that said
/// what the user was already looking at.
class _DraftHeadline extends ConsumerWidget {
  const _DraftHeadline({required this.state});

  final NewOrderState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);
    final garment = state.garmentType.trim();
    final cartTotal = state.cartItems.fold<double>(
      0,
      (sum, item) => sum + (item.estimatedPrice ?? 0),
    );
    final added = state.cartItems.length;

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            added == 0
                ? 'ARTICLE EN PRÉPARATION'
                : '$added ARTICLE${added > 1 ? 'S' : ''} AJOUTÉ${added > 1 ? 'S' : ''}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            garment.isEmpty ? 'Nouvel article' : garment,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            'Pour ${state.selectedForWhom}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'PRIX DE CET ARTICLE',
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              money.format(state.itemPrice, compactSymbol: true),
              maxLines: 1,
              style: AppTextStyles.statValue.copyWith(
                color: context.textPrimaryColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            added == 0
                ? 'Le prix sera ajouté au total de la commande.'
                : 'Déjà dans la commande · ${money.format(cartTotal, compactSymbol: true)}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}
