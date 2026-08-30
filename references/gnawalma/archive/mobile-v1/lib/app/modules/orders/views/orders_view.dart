import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/order_model.dart';
import '../../../shared/extensions/date_extensions.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/forms/premium_search_bar.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/states/empty_state.dart';
import '../../../shared/widgets/states/skeleton.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../operations/controllers/operations_providers.dart';
import '../../operations/domain/operations_models.dart';
import '../../operations/widgets/remote_collection_strip.dart';
import '../controllers/orders_provider.dart';
import '../controllers/orders_state.dart';

class OrdersView extends ConsumerStatefulWidget {
  const OrdersView({super.key});

  @override
  ConsumerState<OrdersView> createState() => _OrdersViewState();
}

class _OrdersViewState extends ConsumerState<OrdersView> {
  /// Ce que la liste montre : les commandes de cet atelier, ou celles de tous.
  ///
  /// Décision du commanditaire : les ateliers voient l'activité les uns des
  /// autres. Les deux listes ne sont pas mélangées — la seconde est amputée des
  /// données de ses clients, et les confondre laisserait croire qu'on peut agir
  /// sur une commande qui n'est pas la sienne.
  bool _showShared = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(ordersProvider);
    final notifier = ref.read(ordersProvider.notifier);
    final showShared = _showShared;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            AppPageHeader(
              title: 'Commandes',
              subtitle: showShared
                  ? 'Activité publiée par les autres ateliers'
                  : state.orders.isEmpty
                  ? 'Aucune commande enregistrée'
                  : '${state.filteredOrders.length} sur ${state.orders.length} commande${state.orders.length > 1 ? 's' : ''}',
              trailing: state.orders.isEmpty
                  ? null
                  : IconButton.filled(
                      tooltip: 'Nouvelle commande',
                      onPressed: () => AppNavigator.toNewOrder(context),
                      icon: const Icon(Icons.add_rounded),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter,
                0,
                AppSpacing.gutter,
                AppSpacing.sm,
              ),
              child: SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: false, label: Text('Mon atelier')),
                  ButtonSegment(value: true, label: Text('Tous les ateliers')),
                ],
                selected: {showShared},
                onSelectionChanged: (selection) =>
                    setState(() => _showShared = selection.first),
              ),
            ),
            if (!showShared) ...[
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutter,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: PremiumSearchBar(
                        hintText: 'Rechercher une commande',
                        onChanged: notifier.setSearchQuery,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _FilterButton(
                      activeCount: _activeFilterCount(state),
                      onPressed: () =>
                          _showFilterSheet(context, state, notifier),
                    ),
                  ],
                ),
              ),
              if (state.orders.isNotEmpty)
                _StatusFilters(state: state, notifier: notifier),
              const RemoteCollectionStrip(kind: RemoteCollectionKind.orders),
            ],
            Expanded(
              child: showShared
                  ? const _SharedOrdersBody()
                  : _OrdersBody(state: state, notifier: notifier),
            ),
          ],
        ),
      ),
    );
  }

  int _activeFilterCount(OrdersState state) {
    var count = 0;
    if (state.selectedOrderStatus != null) count++;
    if (state.selectedPaymentStatus != null) count++;
    return count;
  }

  void _showFilterSheet(
    BuildContext context,
    OrdersState state,
    Orders notifier,
  ) {
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            0,
            AppSpacing.gutter,
            MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppSectionHeader(
                title: 'Filtrer les commandes',
                subtitle: 'Affinez sans masquer le contexte de travail',
                icon: Icons.tune_rounded,
                actionLabel: 'Réinitialiser',
                onAction: () {
                  notifier.setOrderStatusFilter(null);
                  notifier.setPaymentStatusFilter(null);
                  setSheetState(() {});
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'AVANCEMENT',
                style: AppTextStyles.overline.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: OrderStatus.values
                    .map((status) {
                      return FilterChip(
                        label: Text(status.label),
                        selected: state.selectedOrderStatus == status,
                        onSelected: (_) {
                          notifier.setOrderStatusFilter(status);
                          setSheetState(() {});
                        },
                      );
                    })
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'PAIEMENT',
                style: AppTextStyles.overline.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: PaymentStatus.values
                    .map((status) {
                      return FilterChip(
                        label: Text(status.label),
                        selected: state.selectedPaymentStatus == status,
                        onSelected: (_) {
                          notifier.setPaymentStatusFilter(status);
                          setSheetState(() {});
                        },
                      );
                    })
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.xl),
              FilledButton.icon(
                onPressed: () => Navigator.pop(sheetContext),
                icon: const Icon(Icons.check_rounded),
                label: Text(
                  'Afficher ${refineResultCount(state)} résultat${refineResultCount(state) > 1 ? 's' : ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSpacing.buttonHeightLG),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int refineResultCount(OrdersState state) => state.filteredOrders.length;
}

class _OrdersBody extends StatelessWidget {
  const _OrdersBody({required this.state, required this.notifier});

  final OrdersState state;
  final Orders notifier;

  @override
  Widget build(BuildContext context) {
    if (state.isLoading && state.orders.isEmpty) {
      return const _OrdersSkeleton();
    }

    // A failed load must not borrow the empty state: "Aucune commande" plus a
    // create button tells a tailor their order book is gone.
    if (state.hasError && state.orders.isEmpty) {
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        child: ErrorState(
          message: 'Impossible de charger vos commandes.',
          onRetry: notifier.refresh,
        ),
      );
    }

    if (state.filteredOrders.isEmpty) {
      final filtered = state.orders.isNotEmpty;
      return Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
        child: EmptyState(
          motif: AtelierMotif.garment,
          icon: filtered
              ? Icons.filter_alt_off_rounded
              : Icons.receipt_long_rounded,
          title: filtered ? 'Aucune commande ne correspond' : 'Aucune commande',
          message: filtered
              ? 'Retirez un filtre ou recherchez un autre numéro.'
              : 'Créez votre première commande pour suivre production, livraison et paiement.',
          actionLabel: filtered ? 'Effacer les filtres' : 'Créer une commande',
          onActionPressed: filtered
              ? () {
                  notifier.setOrderStatusFilter(null);
                  notifier.setPaymentStatusFilter(null);
                  notifier.setSearchQuery('');
                }
              : () => AppNavigator.toNewOrder(context),
        ),
      );
    }

    final outstanding = state.orders.fold<double>(
      0,
      (sum, order) => sum + order.remainingBalance,
    );
    final unsettled = state.orders
        .where((order) => order.remainingBalance > 0)
        .length;
    final overdue = state.orders.where((order) => order.isOverdue).length;
    final inProduction = state.orders
        .where(
          (order) =>
              order.status == OrderStatus.pending ||
              order.status == OrderStatus.inProgress,
        )
        .length;

    // The ledger band scrolls with the list rather than sitting in the fixed
    // chrome. Four stacked bars above a list is what made this screen read as
    // mostly header; here the money is the first thing read, then it gets out
    // of the way.
    return RefreshIndicator(
      onRefresh: notifier.refresh,
      child: ListView.separated(
        key: const PageStorageKey('orders-list'),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          AppSpacing.md,
          AppSpacing.gutter,
          MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
        ),
        itemCount: state.filteredOrders.length + 1,
        separatorBuilder: (_, index) => SizedBox(
          height: index == 0 ? AppSpacing.sectionSpacing : AppSpacing.sm,
        ),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _LedgerBand(
              outstanding: outstanding,
              unsettled: unsettled,
              inProduction: inProduction,
              overdue: overdue,
            );
          }
          final order = state.filteredOrders[index - 1];
          return _OrderCard(
            order: order,
            onTap: () => AppNavigator.toOrderDetail(context, orderId: order.id),
          );
        },
      ),
    );
  }
}

class _StatusFilters extends StatelessWidget {
  const _StatusFilters({required this.state, required this.notifier});

  final OrdersState state;
  final Orders notifier;

  @override
  Widget build(BuildContext context) {
    // Bare word chips. The old row carried a coloured glyph per status, so five
    // hues competed for attention before a single order had been read.
    return SizedBox(
      // Grows with the system text size — a fixed 54 clipped the chip labels
      // from the first step above the default text scale.
      height: MediaQuery.textScalerOf(
        context,
      ).clamp(maxScaleFactor: 1.6).scale(54),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          AppSpacing.xs,
          AppSpacing.gutter,
          AppSpacing.xs,
        ),
        children: [
          ChoiceChip(
            label: const Text('Toutes'),
            selected: state.selectedOrderStatus == null,
            onSelected: (_) => notifier.setOrderStatusFilter(null),
          ),
          const SizedBox(width: 8),
          ...OrderStatus.values.expand(
            (status) => [
              ChoiceChip(
                label: Text(status.label),
                selected: state.selectedOrderStatus == status,
                onSelected: (_) => notifier.setOrderStatusFilter(status),
              ),
              const SizedBox(width: 8),
            ],
          ),
        ],
      ),
    );
  }
}

/// The one big number on the list: what the atelier is still owed.
///
/// Replaces the pair of equal-weight tiles that used to sit here, each with its
/// own tinted icon disc. Two metrics of identical size give the eye no entry
/// point; a single display figure with the counts demoted underneath does.

/// Mirrors the loaded list exactly: same gutters, the ledger band, the same
/// section gap before the first card, then card-height rows. The screen used to
/// show a centred spinner and then re-flow the whole viewport.
class _OrdersSkeleton extends StatelessWidget {
  const _OrdersSkeleton();

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
        children: [
          const SkeletonBox(height: 96, radius: AppSpacing.radiusLG),
          const SizedBox(height: AppSpacing.sectionSpacing),
          for (var index = 0; index < 5; index++) ...[
            if (index > 0) const SizedBox(height: AppSpacing.sm),
            const SkeletonBox(height: 128, radius: AppSpacing.radiusCard),
          ],
        ],
      ),
    );
  }
}

class _LedgerBand extends ConsumerWidget {
  const _LedgerBand({
    required this.outstanding,
    required this.unsettled,
    required this.inProduction,
    required this.overdue,
  });

  final double outstanding;
  final int unsettled;
  final int inProduction;
  final int overdue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final amount = money.formatAmount(outstanding);
    final rule = context.borderColor.withValues(alpha: 0.72);
    final ledger = unsettled == 0
        ? 'Toutes les commandes sont soldées'
        : '$unsettled commande${unsettled > 1 ? 's' : ''} avec un solde ouvert';

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.surfaceColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        border: Border.all(color: rule),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.cardPadding,
              AppSpacing.cardPadding,
              AppSpacing.cardPadding,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'RESTE À ENCAISSER',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.overline.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
                const SizedBox(height: 12),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(text: amount),
                        TextSpan(
                          text: '  ${money.currency}',
                          style: AppTextStyles.numeric.copyWith(
                            fontSize: 14,
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ],
                    ),
                    maxLines: 1,
                    style: AppTextStyles.statValue.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  ledger,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 1, color: rule),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: _LedgerCount(
                    icon: Icons.content_cut_rounded,
                    value: inProduction,
                    label: 'en production',
                    tone: context.textSecondaryColor,
                  ),
                ),
                VerticalDivider(width: 1, thickness: 1, color: rule),
                Expanded(
                  child: _LedgerCount(
                    icon: Icons.priority_high_rounded,
                    value: overdue,
                    label: 'en retard',
                    tone: overdue > 0
                        ? context.statusForeground(AppColors.error)
                        : context.textSecondaryColor,
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

class _LedgerCount extends StatelessWidget {
  const _LedgerCount({
    required this.icon,
    required this.value,
    required this.label,
    required this.tone,
  });

  final IconData icon;
  final int value;
  final String label;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$value $label',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 14,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 24),
            child: Row(
              children: [
                Icon(icon, size: 17, color: tone),
                const SizedBox(width: 9),
                Text(
                  '$value',
                  style: AppTextStyles.numeric.copyWith(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.activeCount, required this.onPressed});

  final int activeCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: activeCount > 0,
      label: Text('$activeCount'),
      child: IconButton.filledTonal(
        tooltip: 'Filtrer les commandes',
        onPressed: onPressed,
        icon: const Icon(Icons.tune_rounded),
      ),
    );
  }
}

/// One order in the list.
///
/// Reading order is fixed: the deadline as an uppercase dateline, then the
/// order's identity, then the money. The previous card stacked two coloured
/// progress bars, a status dot, a status word, a payment glyph and a payment
/// label — six colour events per row, so a column of them read as texture.
class _OrderCard extends ConsumerWidget {
  const _OrderCard({required this.order, required this.onTap});

  final OrderModel order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final dateline = _dateline(context, order);
    final rule = context.borderColor.withValues(alpha: 0.72);
    final progress = (order.paymentProgress / 100).clamp(0.0, 1.0);
    final settled = order.remainingBalance <= 0;
    final progressColor = settled
        ? context.statusForeground(AppColors.success)
        : Theme.of(context).colorScheme.primary;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.surfaceColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        // Overdue work turns the hairline red. No shadow, no tinted body.
        border: Border.all(
          color: order.isOverdue
              ? context.statusForeground(AppColors.error).withValues(alpha: .45)
              : rule,
          width: order.isOverdue ? 1.3 : 1,
        ),
      ),
      child: PressableSurface(
        onTap: onTap,
        backgroundColor: Colors.transparent,
        showBorder: false,
        borderRadius: 0,
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        semanticLabel:
            'Commande ${order.orderNumber}. ${order.status.label}. ${dateline.label}. '
            '${settled ? 'Paiement soldé' : '${money.format(order.remainingBalance)} à encaisser'}.',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(dateline.icon, size: 15, color: dateline.color),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    dateline.label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.tag.copyWith(color: dateline.color),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.orderNumber,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.h4.copyWith(
                          color: context.textPrimaryColor,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${order.projectCount} article${order.projectCount > 1 ? 's' : ''} · ${order.status.label} · ${DateFormat('d MMM yyyy', 'fr').format(order.orderDate)}',
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
                _BalanceBlock(order: order),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Encaissement',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ),
                Text(
                  '${(progress * 100).round()} %',
                  style: AppTextStyles.numeric.copyWith(
                    fontWeight: FontWeight.w700,
                    color: context.textPrimaryColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 6,
                backgroundColor: context.borderColor.withValues(alpha: 0.5),
                color: progressColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  _Dateline _dateline(BuildContext context, OrderModel order) {
    final date = order.expectedDeliveryDate;
    if (order.status == OrderStatus.cancelled) {
      return _Dateline(
        'Annulée',
        context.textSecondaryColor,
        Icons.block_rounded,
      );
    }
    if (order.status == OrderStatus.delivered) {
      return _Dateline(
        'Livrée',
        context.statusForeground(AppColors.info),
        Icons.local_shipping_outlined,
      );
    }
    if (order.isOverdue) {
      final days = date?.difference(DateTime.now()).inDays.abs() ?? 0;
      return _Dateline(
        'En retard de $days jour${days > 1 ? 's' : ''}',
        context.statusForeground(AppColors.error),
        Icons.warning_amber_rounded,
      );
    }
    if (date?.isToday == true) {
      return _Dateline(
        'Livraison aujourd’hui',
        context.statusForeground(AppColors.warning),
        Icons.today_rounded,
      );
    }
    if (date != null) {
      final days = date.difference(DateTime.now()).inDays;
      return _Dateline(
        days <= 1
            ? 'Livraison demain'
            : 'Livraison ${DateFormat('d MMM', 'fr').format(date)}',
        context.textSecondaryColor,
        Icons.event_outlined,
      );
    }
    return _Dateline(
      'Livraison non planifiée',
      context.textSecondaryColor,
      Icons.event_busy_outlined,
    );
  }
}

/// The balance, set in ink. Only the small tag underneath carries status
/// colour — a money column stays scannable when every figure shares one hue.
class _BalanceBlock extends ConsumerWidget {
  const _BalanceBlock({required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    if (order.remainingBalance <= 0) {
      return Text(
        'SOLDÉE',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.tag.copyWith(
          color: context.statusForeground(AppColors.success),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          money.format(order.remainingBalance, compactSymbol: true),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.numeric.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: context.textPrimaryColor,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          'À ENCAISSER',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.tag.copyWith(
            color: context.statusForeground(AppColors.warning),
          ),
        ),
      ],
    );
  }
}

class _Dateline {
  const _Dateline(this.label, this.color, this.icon);

  final String label;
  final Color color;
  final IconData icon;
}

/// Les commandes des autres ateliers.
///
/// Volontairement sans montant, sans client et sans action : ce sont les
/// commandes de quelqu'un d'autre. Ce que le serveur envoie s'arrête au
/// vêtement, à l'état et à l'échéance.
class _SharedOrdersBody extends ConsumerWidget {
  const _SharedOrdersBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shared = ref.watch(sharedOrdersProvider);

    return shared.when(
      loading: () => const Skeleton(child: SizedBox.expand()),
      error: (_, _) => ErrorState(
        message: 'Activité des autres ateliers indisponible.',
        onRetry: () => ref.invalidate(sharedOrdersProvider),
      ),
      data: (page) => page.items.isEmpty
          ? const EmptyState(
              motif: AtelierMotif.garment,
              title: 'Aucune commande publiée',
              message:
                  'Les commandes des autres ateliers apparaîtront ici dès qu’ils en enregistreront.',
            )
          : RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(sharedOrdersProvider);
                await ref.read(sharedOrdersProvider.future);
              },
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  AppSpacing.sm,
                  AppSpacing.gutter,
                  AppSpacing.xl,
                ),
                itemCount: page.items.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
                itemBuilder: (_, index) =>
                    _SharedOrderCard(order: page.items[index]),
              ),
            ),
    );
  }
}

class _SharedOrderCard extends StatelessWidget {
  const _SharedOrderCard({required this.order});

  final SharedOrder order;

  @override
  Widget build(BuildContext context) {
    final due = order.dueAt;
    final subtitle = [
      if (order.atelierRegion?.trim().isNotEmpty == true)
        order.atelierRegion!.trim(),
      if (order.garmentTypes.isNotEmpty)
        order.garmentTypes.join(', ')
      else
        '${order.itemCount} article${order.itemCount > 1 ? 's' : ''}',
      if (due != null) 'Pour le ${DateFormat('d MMM', 'fr').format(due)}',
    ].join(' · ');

    return AppSectionSurface(
      bordered: true,
      child: Row(
        children: [
          Icon(Icons.storefront_outlined, color: context.textSecondaryColor),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.atelierName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
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
