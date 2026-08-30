import '../../../../shared/utils/amount_input_formatters.dart';
import '../../../../shared/utils/app_money.dart';
import '../../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../data/models/project_model.dart';
import '../../../../core/navigation/app_navigator.dart';
import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/buttons/animated_primary_button.dart';
import '../../../../shared/widgets/forms/app_text_field.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../../operations/controllers/operations_providers.dart';
import '../../controllers/new_order_provider.dart';
import '../../../../shared/widgets/states/composed_empty_panel.dart';

/// Step 3 — the commitment.
///
/// Same reading order as the order detail screen: who it is for, what state it
/// is in, what is owed, what to do next. The step used to open with a status
/// banner restating the button's own disabled state; the total is now the first
/// thing read and the only large figure on the screen.
class PaymentStep extends ConsumerStatefulWidget {
  const PaymentStep({super.key});

  @override
  ConsumerState<PaymentStep> createState() => _PaymentStepState();
}

class _PaymentStepState extends ConsumerState<PaymentStep> {
  final _depositController = TextEditingController();
  final _depositFocus = FocusNode();
  final _formKey = GlobalKey<FormState>();
  bool _depositTouched = false;
  bool _depositOpen = false;

  @override
  void dispose() {
    _depositController.dispose();
    _depositFocus.dispose();
    super.dispose();
  }

  double get _deposit => AppNumbers.tryParse(_depositController.text) ?? 0;

  void _openDeposit() {
    setState(() => _depositOpen = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _depositFocus.requestFocus();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final total = notifier.totalAmount;
    final depositValid = _deposit >= 0 && _deposit <= total;
    final canSubmit =
        state.cartItems.isNotEmpty &&
        state.deliveryDate != null &&
        depositValid &&
        !state.isCreatingOrder;
    final showDepositField = _depositOpen || _deposit > 0;
    final money = ref.watch(moneyFormatterProvider);

    return Form(
      key: _formKey,
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              key: const PageStorageKey('new-order-payment-step'),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                AppSpacing.md,
                AppSpacing.gutter,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _OrderRecapHeadline(
                    clientName: state.selectedClient?.displayName,
                    itemCount: state.cartItems.length,
                    total: total,
                    deposit: _deposit.clamp(0, total),
                    ready: canSubmit,
                  ),
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  AppSectionHeader(
                    title: 'Articles',
                    subtitle: state.cartItems.isEmpty
                        ? 'Aucun article dans la commande'
                        : '${state.cartItems.length} article${state.cartItems.length > 1 ? 's' : ''} à produire',
                    icon: Icons.checkroom_outlined,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (state.cartItems.isEmpty)
                    ComposedEmptyPanel(
                      motif: AtelierMotif.garment,
                      title: 'Aucun article à facturer',
                      message:
                          'Une commande doit porter au moins un vêtement avant d’être enregistrée.',
                      actionLabel: 'Revenir aux articles',
                      actionIcon: Icons.arrow_back_rounded,
                      onAction: notifier.prevStep,
                    )
                  else
                    _ItemLedger(
                      items: state.cartItems,
                      onEdit: notifier.loadItemForEdit,
                      onRemove: notifier.removeItem,
                    ),
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  AppSectionHeader(
                    title: 'Acompte',
                    subtitle: showDepositField
                        ? 'Montant déjà encaissé, en ${money.currency}'
                        : 'Aucun montant encaissé pour l’instant',
                    icon: Icons.payments_outlined,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (!showDepositField)
                    ComposedEmptyPanel(
                      motif: AtelierMotif.payment,
                      title: 'Aucun acompte enregistré',
                      message:
                          'La commande sera créée avec la totalité du montant à encaisser à la livraison.',
                      actionLabel: 'Saisir un acompte',
                      actionIcon: Icons.add_rounded,
                      onAction: _openDeposit,
                    )
                  else
                    _DepositCard(
                      controller: _depositController,
                      focusNode: _depositFocus,
                      total: total,
                      remaining: notifier.remainingAmount.clamp(0, total),
                      valid: depositValid,
                      touched: _depositTouched,
                      onChanged: (value) {
                        notifier.setDepositAmount(
                          AppNumbers.tryParse(value) ?? 0,
                        );
                        setState(() => _depositTouched = true);
                      },
                    ),
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  const AppSectionHeader(
                    title: 'Livraison prévue',
                    subtitle:
                        'Cette date alimente les priorités du tableau de bord',
                    icon: Icons.event_available_outlined,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DeliveryDateCard(
                    date: state.deliveryDate,
                    showError:
                        state.orderCreationAttempted &&
                        state.deliveryDate == null,
                    onPick: () => notifier.pickDeliveryDate(context),
                  ),
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  const AppSectionHeader(
                    title: 'Lieu de retrait',
                    subtitle: 'L’adresse que le client verra sur son reçu',
                    icon: Icons.storefront_outlined,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  const _AtelierLocationCard(),
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.gutter,
              AppSpacing.sm,
              AppSpacing.gutter,
              AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: context.surfaceColor,
              border: Border(
                top: BorderSide(
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              ),
            ),
            child: SafeArea(
              top: false,
              child: AnimatedPrimaryButton(
                label: 'Enregistrer la commande',
                icon: Icons.check_rounded,
                enabled: canSubmit,
                loading: state.isCreatingOrder,
                onPressed: () => _create(context, notifier),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _create(BuildContext context, NewOrder notifier) async {
    if (!_formKey.currentState!.validate()) return;
    final orderId = await notifier.createOrder();
    if (orderId == null || !context.mounted) return;
    // Land on the order that was just created, not on the dashboard. This is
    // the peak moment of the flow: the tailor can show the client the receipt,
    // record a deposit, or check the articles without hunting for the order.
    context.go(AppRoutes.shell);
    AppNavigator.toOrderDetail(context, orderId: orderId);
  }
}

/// The one big number on the step: what the whole order comes to.
class _OrderRecapHeadline extends ConsumerWidget {
  const _OrderRecapHeadline({
    required this.clientName,
    required this.itemCount,
    required this.total,
    required this.deposit,
    required this.ready,
  });

  final String? clientName;
  final int itemCount;
  final double total;
  final num deposit;
  final bool ready;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);
    final tone = context.statusForeground(
      ready ? AppColors.success : AppColors.warning,
    );
    final remaining = (total - deposit).clamp(0, total);

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                ready ? Icons.verified_outlined : Icons.fact_check_outlined,
                size: 17,
                color: tone,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  ready ? 'PRÊTE À ENREGISTRER' : 'VÉRIFICATION FINALE',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.overline.copyWith(color: tone),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            clientName ?? 'Client non renseigné',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            '$itemCount article${itemCount > 1 ? 's' : ''}',
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'TOTAL DE LA COMMANDE',
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              money.format(total, compactSymbol: true),
              maxLines: 1,
              style: AppTextStyles.statValue.copyWith(
                color: context.textPrimaryColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            deposit <= 0
                ? 'Aucun acompte · ${money.format(total, compactSymbol: true)} à encaisser'
                : '${money.format(deposit, compactSymbol: true)} d’acompte · ${money.format(remaining, compactSymbol: true)} à encaisser',
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

/// The cart as a ledger: garment left, price right-aligned in mono, hairline
/// between rows. A card per article made three short lines look like three
/// separate records worth reading one by one.
class _ItemLedger extends ConsumerWidget {
  const _ItemLedger({
    required this.items,
    required this.onEdit,
    required this.onRemove,
  });

  final List<ProjectModel> items;
  final ValueChanged<int> onEdit;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);

    return AppSectionSurface(
      bordered: true,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.cardPadding,
        vertical: AppSpacing.xxs,
      ),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0) Divider(height: 1, color: scheme.outlineVariant),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          items[index].garmentType,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.label.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxs),
                        Text(
                          items[index].forWhom ?? 'Destinataire non renseigné',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.caption.copyWith(
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    money.format(
                      items[index].estimatedPrice ?? 0,
                      compactSymbol: true,
                    ),
                    maxLines: 1,
                    style: AppTextStyles.label.copyWith(
                      color: context.textPrimaryColor,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xxs),
                  IconButton(
                    tooltip: 'Modifier l’article',
                    onPressed: () => onEdit(index),
                    constraints: const BoxConstraints(
                      minWidth: 44,
                      minHeight: 44,
                    ),
                    icon: const Icon(Icons.edit_outlined, size: 19),
                  ),
                  IconButton(
                    tooltip: 'Retirer l’article',
                    onPressed: () => onRemove(index),
                    constraints: const BoxConstraints(
                      minWidth: 44,
                      minHeight: 44,
                    ),
                    color: Theme.of(context).colorScheme.error,
                    icon: const Icon(Icons.delete_outline_rounded, size: 19),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _DepositCard extends ConsumerWidget {
  const _DepositCard({
    required this.controller,
    required this.focusNode,
    required this.total,
    required this.remaining,
    required this.valid,
    required this.touched,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final double total;
  final num remaining;
  final bool valid;
  final bool touched;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppTextField(
            label: 'Acompte reçu',
            hint: '0',
            controller: controller,
            focusNode: focusNode,
            keyboardType: TextInputType.number,
            inputFormatters: amountInputFormatters,
            suffix: money.currency,
            isValid: touched && valid,
            errorText: touched && !valid
                ? 'L’acompte doit être compris entre 0 et ${money.format(total)}.'
                : null,
            onChanged: onChanged,
            validator: (_) =>
                valid ? null : 'L’acompte dépasse le total de la commande.',
          ),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: Text(
                  remaining > 0 ? 'Reste à encaisser' : 'Commande soldée',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                money.format(remaining, compactSymbol: true),
                maxLines: 1,
                style: AppTextStyles.price.copyWith(
                  color: context.textPrimaryColor,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DeliveryDateCard extends StatelessWidget {
  const _DeliveryDateCard({
    required this.date,
    required this.showError,
    required this.onPick,
  });

  final DateTime? date;
  final bool showError;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    if (date == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppSectionSurface(
            bordered: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Aucune date promise',
                  style: AppTextStyles.h5.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'La date est obligatoire : elle place la commande dans le planning de l’atelier.',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                    height: 1.42,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton.icon(
                  onPressed: onPick,
                  icon: const Icon(Icons.calendar_month_outlined, size: 19),
                  label: const Text('Choisir la date de livraison'),
                ),
              ],
            ),
          ),
          if (showError) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'La date de livraison est obligatoire.',
              style: AppTextStyles.bodySmall.copyWith(
                color: context.statusForeground(AppColors.error),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      );
    }

    final formatted = DateFormat('EEEE d MMMM yyyy', 'fr').format(date!);
    return PressableSurface(
      onTap: onPick,
      showBorder: true,
      semanticLabel: 'Date de livraison $formatted. Toucher pour modifier.',
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.cardPadding,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Icon(
            Icons.event_available_outlined,
            size: 21,
            color: context.textPrimaryColor,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LIVRAISON PROMISE',
                  style: AppTextStyles.overline.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  formatted,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Icon(
            Icons.chevron_right_rounded,
            size: 21,
            color: context.textSecondaryColor.withValues(alpha: .65),
          ),
        ],
      ),
    );
  }
}

/// Où le client vient chercher sa commande.
///
/// Le flux ne disait nulle part de quel atelier il s'agit ; sur un reçu, un
/// client qui a commandé une fois n'a que le nom du couturier pour retrouver
/// l'adresse.
class _AtelierLocationCard extends ConsumerWidget {
  const _AtelierLocationCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final atelier = ref.watch(primaryRemoteAtelierProvider).value;
    final address = atelier?.address?.trim();
    final region = atelier?.region?.trim();
    final lines = <String>[
      if (atelier != null) atelier.name,
      if (address != null && address.isNotEmpty)
        address
      else if (region != null && region.isNotEmpty)
        region,
    ];

    if (lines.isEmpty) {
      return const AppStatusBanner(
        title: 'Adresse de l’atelier inconnue',
        message:
            'Renseignez votre région et votre adresse dans le profil de l’atelier pour qu’elles figurent sur les reçus.',
        icon: Icons.info_outline_rounded,
        tone: AppStatusTone.info,
      );
    }

    return AppSectionSurface(
      bordered: true,
      child: Row(
        children: [
          Icon(Icons.place_outlined, color: context.textSecondaryColor),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final line in lines)
                  Text(
                    line,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
