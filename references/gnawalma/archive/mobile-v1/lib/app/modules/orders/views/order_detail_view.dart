import '../../../shared/utils/amount_input_formatters.dart';
import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/order_model.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/app_feedback.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/states/composed_empty_panel.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../../../shared/widgets/states/skeleton.dart';
import '../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../projects/views/widgets/digital_ticket.dart';
import '../controllers/order_detail_provider.dart';
import '../widgets/order_actions_bar.dart';
import '../widgets/order_item_list.dart';
import '../widgets/order_timeline.dart';

class OrderDetailView extends ConsumerWidget {
  const OrderDetailView({super.key, required this.orderId});

  final int orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(orderDetailProvider(orderId));
    final notifier = ref.read(orderDetailProvider(orderId).notifier);
    final money = ref.watch(moneyFormatterProvider);
    final order = state.order;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: CustomAppBar(
        title: order?.orderNumber ?? 'Détail commande',
        actions: order == null
            ? null
            : [
                IconButton(
                  tooltip: 'Ouvrir la facture',
                  onPressed: () => AppNavigator.to(
                    AppRoutes.invoiceLive,
                    arguments: orderId,
                  ),
                  icon: const Icon(Icons.receipt_long_outlined),
                ),
                PopupMenuButton<_OrderMenuAction>(
                  tooltip: 'Plus d’actions',
                  onSelected: (action) =>
                      _handleMenuAction(context, notifier, order, action),
                  itemBuilder: (menuContext) => [
                    if (order.status != OrderStatus.delivered)
                      const PopupMenuItem(
                        value: _OrderMenuAction.edit,
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.edit_outlined),
                          title: Text('Modifier la commande'),
                        ),
                      ),
                    PopupMenuItem(
                      value: _OrderMenuAction.delete,
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          Icons.delete_outline,
                          color: Theme.of(menuContext).colorScheme.error,
                        ),
                        title: Text(
                          'Supprimer la commande',
                          style: Theme.of(menuContext).textTheme.bodyLarge
                              ?.copyWith(
                                color: Theme.of(menuContext).colorScheme.error,
                              ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
      ),
      body: state.isLoading && order == null
          ? const _OrderDetailSkeleton()
          : order == null
          ? ErrorState(
              message: 'Cette commande est introuvable ou a été supprimée.',
              onRetry: notifier.refresh,
            )
          : RefreshIndicator(
              onRefresh: notifier.refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  AppSpacing.md,
                  AppSpacing.gutter,
                  MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
                ),
                children: [
                  // Reading order on this screen: who it is for, what state
                  // it is in, what is owed, what to do next.
                  _OrderHeadline(
                    order: order,
                    clientName: state.client?.displayName,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  OrderActionsBar(
                    order: order,
                    onStatusChanged: (status) =>
                        _changeStatus(context, notifier, order, status, money),
                    onPaymentRequested: () => _showRecordPaymentSheet(
                      context,
                      notifier,
                      order.remainingBalance,
                      money,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  AppSectionHeader(
                    title: 'Articles',
                    subtitle:
                        '${state.orderProjects.length} article${state.orderProjects.length > 1 ? 's' : ''} rattaché${state.orderProjects.length > 1 ? 's' : ''}',
                    icon: Icons.checkroom_outlined,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (state.orderProjects.isEmpty)
                    ComposedEmptyPanel(
                      motif: AtelierMotif.garment,
                      title: 'Aucun article rattaché',
                      message:
                          'Cette commande ne porte que ses informations financières et de livraison.',
                      actionLabel: 'Ajouter un article',
                      actionIcon: Icons.add_rounded,
                      onAction: () =>
                          AppNavigator.toAddEditOrder(context, extra: order),
                    )
                  else ...[
                    DigitalTicket(
                      project: state.orderProjects.first,
                      orderArticles: state.orderProjects,
                      order: order,
                      client: state.client,
                      getStatusColor: (_) => order.status.color,
                      getStatusLabel: (_) => order.status.label,
                      onPayment: (amount) => notifier.recordPayment(amount),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    OrderItemList(projects: state.orderProjects),
                  ],
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  AppSectionHeader(
                    title: 'Encaissements',
                    subtitle: order.paymentHistory.isEmpty
                        ? 'Aucun règlement enregistré'
                        : '${order.paymentHistory.length} règlement${order.paymentHistory.length > 1 ? 's' : ''} enregistré${order.paymentHistory.length > 1 ? 's' : ''}',
                    icon: Icons.payments_outlined,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (order.paymentHistory.isEmpty)
                    ComposedEmptyPanel(
                      motif: AtelierMotif.payment,
                      title: 'Aucun paiement enregistré',
                      message:
                          'Chaque encaissement saisi ici met à jour le solde et le reçu du client.',
                      actionLabel: 'Enregistrer un paiement',
                      actionIcon: Icons.add_rounded,
                      onAction: () => _showRecordPaymentSheet(
                        context,
                        notifier,
                        order.remainingBalance,
                        money,
                      ),
                    )
                  else
                    _PaymentHistoryList(order: order),
                  const SizedBox(height: AppSpacing.sectionSpacing),
                  const AppSectionHeader(
                    title: 'Chronologie',
                    subtitle: 'Dates de création, livraison prévue et clôture',
                    icon: Icons.timeline_rounded,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppSectionSurface(
                    bordered: true,
                    child: OrderTimeline(order: order),
                  ),
                ],
              ),
            ),
    );
  }

  Future<void> _handleMenuAction(
    BuildContext context,
    OrderDetail notifier,
    OrderModel order,
    _OrderMenuAction action,
  ) async {
    switch (action) {
      case _OrderMenuAction.edit:
        AppNavigator.toAddEditOrder(context, extra: order);
        break;
      case _OrderMenuAction.delete:
        final confirmed = await AppDialogs.showConfirmation(
          title: 'Supprimer ${order.orderNumber} ?',
          message:
              'La commande et son historique de paiement seront supprimés. Cette action est irréversible.',
          confirmLabel: 'Supprimer définitivement',
          cancelLabel: 'Conserver',
          isDangerous: true,
          icon: Icons.delete_forever_rounded,
        );
        if (confirmed == true) {
          final deleted = await notifier.deleteOrder();
          if (deleted && context.mounted) AppNavigator.back();
        }
        break;
    }
  }

  Future<void> _changeStatus(
    BuildContext context,
    OrderDetail notifier,
    OrderModel order,
    OrderStatus status,
    MoneyFormatter money,
  ) async {
    if (status == OrderStatus.delivered &&
        order.paymentStatus != PaymentStatus.paid) {
      final choice = await showModalBottomSheet<String>(
        context: context,
        useSafeArea: true,
        showDragHandle: true,
        builder: (sheetContext) {
          final theme = Theme.of(sheetContext);
          return SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                0,
                AppSpacing.gutter,
                AppSpacing.md,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AppSectionHeader(
                    title: 'Paiement incomplet',
                    subtitle:
                        'Il reste ${money.format(order.remainingBalance)} à encaisser. Le solde restera dû après livraison.',
                    icon: Icons.warning_amber_rounded,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  ListTile(
                    onTap: () => Navigator.pop(sheetContext, 'pay'),
                    leading: Icon(
                      Icons.payments_outlined,
                      color: theme.colorScheme.primary,
                    ),
                    title: const Text('Encaisser d’abord'),
                    subtitle: const Text(
                      'Enregistrer le solde avant de livrer',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  ListTile(
                    onTap: () => Navigator.pop(sheetContext, 'deliver'),
                    leading: Icon(
                      Icons.local_shipping_outlined,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    title: const Text('Livrer avec solde dû'),
                    subtitle: const Text(
                      'Le solde restera à encaisser',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  TextButton(
                    onPressed: () => Navigator.pop(sheetContext, 'cancel'),
                    child: const Text('Annuler'),
                  ),
                ],
              ),
            ),
          );
        },
      );
      if (choice == 'pay' && context.mounted) {
        await _showRecordPaymentSheet(
          context,
          notifier,
          order.remainingBalance,
          money,
        );
        return;
      }
      if (choice != 'deliver') return;
    }
    await notifier.updateOrderStatus(status);
  }

  Future<void> _showRecordPaymentSheet(
    BuildContext context,
    OrderDetail notifier,
    double remainingAmount,
    MoneyFormatter money,
  ) async {
    final amountController = TextEditingController(
      text: remainingAmount.toStringAsFixed(0),
    );
    final noteController = TextEditingController();
    var method = 'Espèces';
    var submitting = false;

    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        showDragHandle: true,
        builder: (sheetContext) => StatefulBuilder(
          builder: (context, setSheetState) {
            final amount = AppNumbers.tryParse(amountController.text) ?? 0;
            final valid = amount > 0 && amount <= remainingAmount + .01;
            return Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.lg,
                0,
                AppSpacing.lg,
                MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const AppSectionHeader(
                      title: 'Enregistrer un paiement',
                      subtitle:
                          'Le reçu et le solde seront mis à jour immédiatement',
                      icon: Icons.payments_outlined,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppStatusBanner(
                      title: 'Solde actuel',
                      message:
                          '${money.format(remainingAmount)} restent à encaisser.',
                      icon: Icons.account_balance_wallet_outlined,
                      tone: AppStatusTone.info,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextField(
                      controller: amountController,
                      autofocus: true,
                      enabled: !submitting,
                      inputFormatters: amountInputFormatters,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      textInputAction: TextInputAction.next,
                      scrollPadding: const EdgeInsets.only(
                        bottom: AppSpacing.keyboardScrollPadding,
                      ),
                      onChanged: (_) => setSheetState(() {}),
                      decoration: InputDecoration(
                        labelText: 'Montant reçu',
                        suffixText: money.currency,
                        prefixIcon: const Icon(Icons.payments_outlined),
                        errorText: amountController.text.isNotEmpty && !valid
                            ? amount <= 0
                                  ? 'Saisissez un montant supérieur à zéro.'
                                  : 'Le montant dépasse le solde restant.'
                            : null,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<String>(
                      initialValue: method,
                      decoration: const InputDecoration(
                        labelText: 'Mode de paiement',
                        prefixIcon: Icon(Icons.wallet_outlined),
                      ),
                      items:
                          const [
                                'Espèces',
                                'Wave',
                                'Orange Money',
                                'Virement',
                                'Chèque',
                              ]
                              .map(
                                (value) => DropdownMenuItem(
                                  value: value,
                                  child: Text(value),
                                ),
                              )
                              .toList(growable: false),
                      onChanged: submitting
                          ? null
                          : (value) => setSheetState(() {
                              if (value != null) method = value;
                            }),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: noteController,
                      enabled: !submitting,
                      textCapitalization: TextCapitalization.sentences,
                      textInputAction: TextInputAction.done,
                      scrollPadding: const EdgeInsets.only(
                        bottom: AppSpacing.keyboardScrollPadding,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Note optionnelle',
                        prefixIcon: Icon(Icons.note_alt_outlined),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    FilledButton.icon(
                      onPressed: !valid || submitting
                          ? null
                          : () async {
                              setSheetState(() => submitting = true);
                              final parsed = AppNumbers.tryParse(
                                amountController.text,
                              );
                              if (parsed == null || parsed <= 0) {
                                AppFeedback.showError('Montant invalide');
                                setSheetState(() => submitting = false);
                                return;
                              }
                              await notifier.recordPayment(
                                parsed,
                                method: method,
                                notes: noteController.text.trim().isEmpty
                                    ? null
                                    : noteController.text.trim(),
                              );
                              if (sheetContext.mounted) {
                                Navigator.pop(sheetContext);
                              }
                            },
                      icon: submitting
                          ? SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator.adaptive(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Theme.of(context).colorScheme.onPrimary,
                                ),
                              ),
                            )
                          : const Icon(Icons.check_rounded),
                      label: Text(
                        submitting
                            ? 'Enregistrement…'
                            : 'Confirmer le paiement',
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      );
    } finally {
      amountController.dispose();
      noteController.dispose();
    }
  }
}

enum _OrderMenuAction { edit, delete }

/// The screen's lead block.
///
/// Ranked the way a tailor reads it: who it is for, what state it is in, what
/// is still owed. The balance is the one large number — the previous version
/// gave the status tile, the client name and three money figures equal weight,
/// so nothing answered "what do I need to know" at a glance.
class _OrderHeadline extends ConsumerWidget {
  const _OrderHeadline({required this.order, this.clientName});

  final OrderModel order;
  final String? clientName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);
    final settled = order.remainingBalance <= 0;

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                order.status.icon,
                size: 17,
                color: context.statusForeground(order.status.color),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  '${order.status.label} · ${order.orderNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.overline.copyWith(
                    color: context.statusForeground(order.status.color),
                  ),
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
            '${order.projectCount} article${order.projectCount > 1 ? 's' : ''}',
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.lg),
          Text(
            settled ? 'TOTAL ENCAISSÉ' : 'RESTE À ENCAISSER',
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              money.format(
                settled ? order.totalAmount : order.remainingBalance,
                compactSymbol: true,
              ),
              style: AppTextStyles.statValue.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            settled
                ? 'Commande soldée · total ${money.format(order.totalAmount, compactSymbol: true)}'
                : '${money.format(order.depositPaid, compactSymbol: true)} réglés sur ${money.format(order.totalAmount, compactSymbol: true)}',
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

/// Empty state for a section inside an already-scrolling page.
///
/// [EmptyState] cannot be used here: it wraps itself in a scroll view, which
/// would nest inside this page's own [ListView]. Same composition, no scroller.
class _PaymentHistoryList extends ConsumerWidget {
  const _PaymentHistoryList({required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);
    final dateFormat = DateFormat('d MMM y', 'fr_FR');
    final payments = order.paymentHistory;

    return AppSectionSurface(
      bordered: true,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.cardPadding,
        vertical: AppSpacing.xs,
      ),
      child: Column(
        children: [
          for (var i = 0; i < payments.length; i++) ...[
            if (i > 0) Divider(height: 1, color: scheme.outlineVariant),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          dateFormat.format(payments[i].paymentDate),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.label.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                        if (payments[i].paymentMethod?.trim().isNotEmpty ??
                            false) ...[
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            payments[i].paymentMethod!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.caption.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    money.format(payments[i].amount, compactSymbol: true),
                    style: AppTextStyles.label.copyWith(
                      color: context.textPrimaryColor,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
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

/// Mirrors the loaded screen: headline card, actions bar, then section blocks,
/// at the gutters the real body uses.
class _OrderDetailSkeleton extends StatelessWidget {
  const _OrderDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          AppSpacing.md,
          AppSpacing.gutter,
          MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
        ),
        children: const [
          SkeletonBox(height: 210, radius: AppSpacing.radiusLG),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(height: 104, radius: AppSpacing.radiusLG),
          SizedBox(height: AppSpacing.sectionSpacing),
          SkeletonBox(height: 150, radius: AppSpacing.radiusLG),
          SizedBox(height: AppSpacing.sectionSpacing),
          SkeletonBox(height: 150, radius: AppSpacing.radiusLG),
        ],
      ),
    );
  }
}
