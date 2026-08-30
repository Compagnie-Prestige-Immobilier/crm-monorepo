import '../../../../shared/utils/app_money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/models/order_model.dart';
import '../../../../data/models/project_model.dart';
import '../../../../shared/extensions/date_extensions.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_motion.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../models/dashboard_order_card_vm.dart';

/// One order in the work queue.
///
/// Reading order inside the card is fixed: the deadline (as an uppercase
/// dateline), then the client, then the money. The old layout led with a
/// tinted icon square and gave the client name the same weight as the order
/// number underneath it, so a column of these read as a texture rather than as
/// a list of names.
class OrderCard extends StatefulWidget {
  const OrderCard({
    super.key,
    required this.vm,
    required this.onTap,
    required this.onInvoice,
    required this.onEdit,
    required this.onDelete,
    required this.onArticleTap,
    required this.onStatusChange,
    required this.onArticleStatusChange,
  });

  final DashboardOrderCardVM vm;
  final VoidCallback onTap;
  final VoidCallback onInvoice;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final ValueChanged<ProjectModel> onArticleTap;
  final ValueChanged<OrderStatus> onStatusChange;
  final void Function(ProjectModel, ProjectStatus) onArticleStatusChange;

  @override
  State<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<OrderCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final order = widget.vm.order;
    final status = _deliveryStatus(context, order);
    final progress = (widget.vm.aggregateProgress / 100).clamp(0.0, 1.0);
    final complete = progress >= 1;
    final progressColor = complete
        ? context.statusForeground(AppColors.success)
        : Theme.of(context).colorScheme.primary;
    final rule = context.borderColor.withValues(alpha: 0.72);
    final articleCount = widget.vm.articles.length;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: context.surfaceColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        // Overdue work is marked by the rule going red, not by a shadow or a
        // tinted card body. The card stays flat either way.
        border: Border.all(
          color: order.isOverdue ? status.color.withValues(alpha: 0.45) : rule,
          width: order.isOverdue ? 1.3 : 1,
        ),
      ),
      child: Column(
        children: [
          PressableSurface(
            onTap: widget.onTap,
            onLongPress: () => _showQuickActions(context),
            backgroundColor: Colors.transparent,
            showBorder: false,
            borderRadius: 0,
            semanticLabel:
                '${widget.vm.payer?.displayName ?? 'Client inconnu'}, commande ${order.orderNumber}, ${status.label}',
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.cardPadding,
              AppSpacing.cardPadding,
              AppSpacing.cardPadding,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(status.icon, color: status.color, size: 15),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        status.label.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.tag.copyWith(color: status.color),
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
                            widget.vm.payer?.displayName ?? 'Client inconnu',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.h4.copyWith(
                              color: context.textPrimaryColor,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${order.orderNumber} · $articleCount article${articleCount > 1 ? 's' : ''}',
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
                    _PaymentSummary(order: order),
                  ],
                ),
                if (widget.vm.beneficiaries.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: widget.vm.beneficiaries
                        .take(3)
                        .map(
                          (beneficiary) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: context.surfaceLightColor,
                              borderRadius: BorderRadius.circular(
                                AppSpacing.pillRadius,
                              ),
                            ),
                            child: Text(
                              beneficiary,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.caption.copyWith(
                                color: context.textSecondaryColor,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Avancement',
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
                        color: progressColor,
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
          Divider(height: 1, thickness: 1, color: context.dividerColor),
          IntrinsicHeight(
            child: Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: () => setState(() => _expanded = !_expanded),
                    icon: Icon(
                      _expanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                    ),
                    label: Text(
                      _expanded ? 'Masquer les articles' : 'Voir les articles',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                if (order.status != OrderStatus.delivered) ...[
                  VerticalDivider(
                    width: 1,
                    indent: AppSpacing.xs,
                    endIndent: AppSpacing.xs,
                    color: context.dividerColor,
                  ),
                  Expanded(
                    child: TextButton.icon(
                      onPressed: () =>
                          widget.onStatusChange(_nextOrderStatus(order.status)),
                      icon: const Icon(Icons.arrow_forward_rounded),
                      label: Text(
                        _nextOrderLabel(order.status),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          AnimatedSize(
            duration: AppMotion.duration(context, AppMotion.quick),
            curve: AppMotion.curve(context, AppMotion.enter),
            child: _expanded
                ? Column(
                    children: [
                      Divider(
                        height: 1,
                        thickness: 1,
                        color: context.dividerColor,
                      ),
                      for (
                        var index = 0;
                        index < widget.vm.articles.length;
                        index++
                      )
                        _ArticleRow(
                          article: widget.vm.articles[index],
                          onTap: () =>
                              widget.onArticleTap(widget.vm.articles[index]),
                          onAdvance:
                              widget.vm.articles[index].status ==
                                  ProjectStatus.delivered
                              ? null
                              : () => widget.onArticleStatusChange(
                                  widget.vm.articles[index],
                                  _nextProjectStatus(
                                    widget.vm.articles[index].status,
                                  ),
                                ),
                        ),
                      const SizedBox(height: AppSpacing.xs),
                    ],
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  _DeliveryStatus _deliveryStatus(BuildContext context, OrderModel order) {
    final date = order.expectedDeliveryDate;
    if (order.status == OrderStatus.delivered) {
      return _DeliveryStatus(
        'Livrée',
        context.statusForeground(AppColors.info),
        Icons.local_shipping_outlined,
      );
    }
    if (order.status == OrderStatus.completed) {
      return _DeliveryStatus(
        'Prête à livrer',
        context.statusForeground(AppColors.success),
        Icons.check_circle_outline_rounded,
      );
    }
    if (order.isOverdue) {
      final days = date?.difference(DateTime.now()).inDays.abs() ?? 0;
      return _DeliveryStatus(
        'En retard de $days jour${days > 1 ? 's' : ''}',
        context.statusForeground(AppColors.error),
        Icons.warning_amber_rounded,
      );
    }
    if (date?.isToday == true) {
      return _DeliveryStatus(
        'Livraison aujourd’hui',
        context.statusForeground(AppColors.warning),
        Icons.today_rounded,
      );
    }
    if (date != null) {
      final days = date.difference(DateTime.now()).inDays;
      return _DeliveryStatus(
        days <= 1 ? 'Livraison demain' : 'Livraison dans $days jours',
        context.textSecondaryColor,
        Icons.event_outlined,
      );
    }
    return _DeliveryStatus(
      'Date non définie',
      context.textSecondaryColor,
      Icons.event_busy_outlined,
    );
  }

  OrderStatus _nextOrderStatus(OrderStatus current) {
    switch (current) {
      case OrderStatus.pending:
        return OrderStatus.inProgress;
      case OrderStatus.inProgress:
        return OrderStatus.completed;
      case OrderStatus.completed:
        return OrderStatus.delivered;
      case OrderStatus.delivered:
      case OrderStatus.cancelled:
        return current;
    }
  }

  String _nextOrderLabel(OrderStatus current) {
    switch (current) {
      case OrderStatus.pending:
        return 'Démarrer';
      case OrderStatus.inProgress:
        return 'Terminer';
      case OrderStatus.completed:
        return 'Livrer';
      case OrderStatus.delivered:
        return 'Livrée';
      case OrderStatus.cancelled:
        return 'Annulée';
    }
  }

  ProjectStatus _nextProjectStatus(ProjectStatus current) {
    switch (current) {
      case ProjectStatus.todo:
        return ProjectStatus.inProgress;
      case ProjectStatus.inProgress:
        return ProjectStatus.completed;
      case ProjectStatus.completed:
        return ProjectStatus.delivered;
      case ProjectStatus.delivered:
        return current;
    }
  }

  void _showQuickActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          0,
          AppSpacing.gutter,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppSectionHeader(
              title: widget.vm.order.orderNumber,
              subtitle: widget.vm.payer?.displayName ?? 'Client inconnu',
              icon: Icons.receipt_long_outlined,
            ),
            const SizedBox(height: AppSpacing.md),
            AppActionTile(
              title: 'Ouvrir la commande',
              icon: Icons.open_in_new_rounded,
              onTap: () {
                Navigator.of(sheetContext).pop();
                widget.onTap();
              },
            ),
            AppActionTile(
              title: 'Modifier',
              icon: Icons.edit_outlined,
              onTap: () {
                Navigator.of(sheetContext).pop();
                widget.onEdit();
              },
            ),
            if (!widget.vm.isFullyPaid)
              AppActionTile(
                title: 'Encaisser le solde',
                icon: Icons.payments_outlined,
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  widget.onInvoice();
                },
              ),
            AppActionTile(
              title: 'Supprimer la commande',
              icon: Icons.delete_outline_rounded,
              danger: true,
              onTap: () {
                Navigator.of(sheetContext).pop();
                widget.onDelete();
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// The balance, set in ink. Only the small label underneath carries status
/// colour — a money column stays readable when the figures all share one hue.
class _PaymentSummary extends ConsumerWidget {
  const _PaymentSummary({required this.order});

  final OrderModel order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final paid = order.remainingBalance <= 0;
    if (paid) {
      return Text(
        'SOLDÉE',
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

class _ArticleRow extends StatelessWidget {
  const _ArticleRow({
    required this.article,
    required this.onTap,
    this.onAdvance,
  });

  final ProjectModel article;
  final VoidCallback onTap;
  final VoidCallback? onAdvance;

  @override
  Widget build(BuildContext context) {
    // A 7pt dot instead of a tinted rounded square: the status is a mark in the
    // margin, not a second icon system competing with the card's own glyph.
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.fromLTRB(
        AppSpacing.cardPadding,
        0,
        8,
        0,
      ),
      horizontalTitleGap: 14,
      minLeadingWidth: 0,
      leading: SizedBox(
        width: 8,
        height: 40,
        child: Center(
          child: Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: context.statusForeground(article.status.color),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
      title: Text(
        article.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.label.copyWith(color: context.textPrimaryColor),
      ),
      subtitle: Text(
        '${article.forWhom ?? 'Client'} · ${article.status.label}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.caption.copyWith(
          color: context.textSecondaryColor,
        ),
      ),
      trailing: onAdvance == null
          ? null
          : IconButton(
              tooltip: 'Faire avancer l’article',
              onPressed: onAdvance,
              icon: const Icon(Icons.arrow_forward_rounded),
            ),
    );
  }
}

class _DeliveryStatus {
  const _DeliveryStatus(this.label, this.color, this.icon);

  final String label;
  final Color color;
  final IconData icon;
}
