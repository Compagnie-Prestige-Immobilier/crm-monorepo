import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../operations/controllers/operations_providers.dart';
import '../../operations/widgets/atelier_marketplace_strip.dart';
import '../../operations/widgets/remote_dashboard_strip.dart';
import '../controllers/dashboard_provider.dart';
import '../controllers/dashboard_state.dart';
import 'widgets/cash_log_sheet.dart';
import 'widgets/dashboard_empty_panel.dart';
import 'widgets/dashboard_header.dart';
import 'widgets/dashboard_skeleton_view.dart';
import 'widgets/order_card.dart';
import 'widgets/runway_card.dart';
import 'widgets/studio_health_card.dart';

class DashboardView extends ConsumerWidget {
  const DashboardView({super.key});

  static const _gutter = EdgeInsets.symmetric(horizontal: AppSpacing.gutter);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(dashboardProvider);
    final controller = ref.read(dashboardProvider.notifier);

    if (state.isLoading) return const DashboardSkeletonView();

    // Without this the atelier renders as if it had no work at all.
    if (state.hasError) {
      return Scaffold(
        body: SafeArea(
          bottom: false,
          child: ErrorState(
            message: 'Impossible de charger les données de l’atelier.',
            onRetry: controller.loadDashboardData,
          ),
        ),
      );
    }

    final urgentCount = state.waitingOrders
        .where((order) => order.isOverdue)
        .length;
    final hasOrders =
        state.waitingOrders.isNotEmpty ||
        state.readyOrders.isNotEmpty ||
        state.deliveredUnpaidOrders.isNotEmpty;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            await controller.loadDashboardData();
            ref.invalidate(remoteAteliersProvider);
            ref.invalidate(primaryRemoteAtelierProvider);
          },
          child: CustomScrollView(
            key: const PageStorageKey('atelier-dashboard-scroll'),
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: DashboardHeader(profile: state.businessProfile),
              ),
              SliverPadding(
                padding: _gutter,
                sliver: SliverToBoxAdapter(
                  child: StudioHealthCard(
                    dailyCash: state.dailyCash,
                    transactionCount: state.dailyTransactions.length,
                    urgentCount: urgentCount,
                    waitingCount: state.waitingOrders.length,
                    onCashTap: () => _showCashLog(context, state),
                    onUrgentTap: () => AppNavigator.toOrders(context),
                    onWaitingTap: () => AppNavigator.toOrders(context),
                    onCreateOrder: controller.navigateToAddProject,
                  ),
                ),
              ),
              if (!hasOrders)
                SliverPadding(
                  // The queue is empty, so this panel is the body of the
                  // screen: it gets the section gap above it and the drawn
                  // motif, not a one-line card wedged under the numbers.
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter,
                    AppSpacing.sectionSpacing,
                    AppSpacing.gutter,
                    0,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: DashboardEmptyPanel(
                      onCreateOrder: controller.navigateToAddProject,
                      onBrowseOrders: () => AppNavigator.toOrders(context),
                    ),
                  ),
                )
              else ...[
                if (state.readyOrders.isNotEmpty) ...[
                  const _SectionGap(),
                  SliverToBoxAdapter(
                    child: AppSectionHeader(
                      title: 'Prêtes à livrer',
                      subtitle:
                          '${state.readyOrders.length} à remettre au client',
                      icon: Icons.task_alt_rounded,
                      actionLabel: 'Tout voir',
                      onAction: () => AppNavigator.toOrders(context),
                      padding: _gutter,
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: SizedBox(height: AppSpacing.sm),
                  ),
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: MediaQuery.textScalerOf(
                        context,
                      ).scale(170).clamp(170.0, 230.0),
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: _gutter,
                        itemCount: state.readyOrders.length,
                        separatorBuilder: (_, _) =>
                            const SizedBox(width: AppSpacing.sm),
                        itemBuilder: (context, index) {
                          final orderVM = state.readyOrders[index];
                          final project = orderVM.articles.first;
                          return SizedBox(
                            width: 146,
                            child: RunwayCard(
                              project: project,
                              onTap: () => controller.navigateToOrderDetails(
                                orderVM.order,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
                if (state.waitingOrders.isNotEmpty) ...[
                  const _SectionGap(),
                  SliverToBoxAdapter(
                    child: AppSectionHeader(
                      title: 'En production',
                      subtitle:
                          '${state.waitingOrders.length} commande${state.waitingOrders.length > 1 ? 's' : ''} à faire avancer',
                      icon: Icons.content_cut_rounded,
                      actionLabel: 'Tout voir',
                      onAction: () => AppNavigator.toOrders(context),
                      padding: _gutter,
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: SizedBox(height: AppSpacing.sm),
                  ),
                  SliverPadding(
                    padding: _gutter,
                    sliver: SliverList.separated(
                      itemCount: state.waitingOrders.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.sm),
                      itemBuilder: (context, index) {
                        final orderVM = state.waitingOrders[index];
                        return OrderCard(
                          vm: orderVM,
                          onTap: () =>
                              controller.navigateToOrderDetails(orderVM.order),
                          onEdit: () =>
                              controller.navigateToEditOrder(orderVM.order),
                          onDelete: () =>
                              controller.deleteOrder(orderVM.order.id),
                          onInvoice: () =>
                              controller.handleOrderInvoice(orderVM.order),
                          onArticleTap: controller.navigateToProjectDetails,
                          onStatusChange: (status) => controller
                              .updateOrderStatus(orderVM.order.id, status),
                          onArticleStatusChange: (project, status) => controller
                              .updateProjectStatus(project.id, status),
                        );
                      },
                    ),
                  ),
                ],
                if (state.deliveredUnpaidOrders.isNotEmpty) ...[
                  const _SectionGap(),
                  SliverToBoxAdapter(
                    child: AppSectionHeader(
                      title: 'Paiements à encaisser',
                      subtitle:
                          '${state.deliveredUnpaidOrders.length} solde${state.deliveredUnpaidOrders.length > 1 ? 's' : ''} à suivre',
                      icon: Icons.payments_outlined,
                      actionLabel: 'Tout voir',
                      onAction: () => AppNavigator.toOrders(context),
                      padding: _gutter,
                    ),
                  ),
                  const SliverToBoxAdapter(
                    child: SizedBox(height: AppSpacing.sm),
                  ),
                  SliverPadding(
                    padding: _gutter,
                    sliver: SliverList.separated(
                      itemCount: state.deliveredUnpaidOrders.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.sm),
                      itemBuilder: (context, index) {
                        final orderVM = state.deliveredUnpaidOrders[index];
                        return OrderCard(
                          vm: orderVM,
                          onTap: () =>
                              controller.navigateToOrderDetails(orderVM.order),
                          onEdit: () =>
                              controller.navigateToEditOrder(orderVM.order),
                          onDelete: () =>
                              controller.deleteOrder(orderVM.order.id),
                          onInvoice: () =>
                              controller.handleOrderInvoice(orderVM.order),
                          onArticleTap: controller.navigateToProjectDetails,
                          onStatusChange: (status) => controller
                              .updateOrderStatus(orderVM.order.id, status),
                          onArticleStatusChange: (project, status) => controller
                              .updateProjectStatus(project.id, status),
                        );
                      },
                    ),
                  ),
                ],
              ],
              // Server sync sits last on purpose. It repeats counts the queue
              // above already shows, so it belongs under the work rather than
              // between the greeting and the day's takings.
              const _SectionGap(),
              // Whether the atelier is actually published, and who has asked
              // for it. Both were invisible from the app: an unpublished
              // atelier looked identical to a listed one, and client requests
              // arrived in a table the atelier could not read.
              const SliverPadding(
                padding: _gutter,
                sliver: SliverToBoxAdapter(child: AtelierMarketplaceStrip()),
              ),
              const _SectionGap(),
              const SliverPadding(
                padding: _gutter,
                sliver: SliverToBoxAdapter(child: RemoteDashboardStrip()),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: MediaQuery.paddingOf(context).bottom + AppSpacing.lg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCashLog(BuildContext context, DashboardState state) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => CashLogSheet(
        transactions: state.dailyTransactions,
        total: state.dailyCash,
      ),
    );
  }
}

/// The gap between two unrelated groups. Named so the rhythm is visible in the
/// sliver list itself: generous here, tight inside each section.
class _SectionGap extends StatelessWidget {
  const _SectionGap();

  @override
  Widget build(BuildContext context) {
    return const SliverToBoxAdapter(
      child: SizedBox(height: AppSpacing.sectionSpacing),
    );
  }
}
