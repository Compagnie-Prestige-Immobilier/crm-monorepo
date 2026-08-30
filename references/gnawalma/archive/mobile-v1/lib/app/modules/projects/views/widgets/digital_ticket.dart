import '../../../../shared/utils/amount_input_formatters.dart';
import '../../../../shared/utils/app_money.dart';
import '../../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/navigation/app_navigator.dart';
import '../../../../data/models/client_model.dart';
import '../../../../data/models/order_model.dart';
import '../../../../data/models/pattern_model.dart';
import '../../../../data/models/project_model.dart';
import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../operations/controllers/operations_providers.dart';

/// Compact order summary used inside project and order details. It deliberately
/// reads like an operational record rather than a decorative paper receipt.
class DigitalTicket extends ConsumerWidget {
  const DigitalTicket({
    super.key,
    required this.project,
    this.orderArticles = const [],
    this.order,
    this.client,
    this.pattern,
    required this.getStatusColor,
    required this.getStatusLabel,
    required this.onPayment,
    this.repaintBoundaryKey,
  });

  final ProjectModel project;
  final List<ProjectModel> orderArticles;
  final OrderModel? order;
  final ClientModel? client;
  final PatternModel? pattern;
  final Color Function(ProjectStatus) getStatusColor;
  final String Function(ProjectStatus) getStatusLabel;
  final ValueChanged<double> onPayment;
  final GlobalKey? repaintBoundaryKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final atelier = ref.watch(primaryRemoteAtelierProvider).value;
    final atelierAddress = atelier?.address?.trim();
    final atelierLocation = atelier == null
        ? null
        : [
            atelier.name,
            if (atelierAddress != null && atelierAddress.isNotEmpty)
              atelierAddress
            else if ((atelier.region ?? '').trim().isNotEmpty)
              atelier.region!.trim(),
          ].join(' · ');
    final money = ref.watch(moneyFormatterProvider);
    final articles = orderArticles.isEmpty ? [project] : orderArticles;
    final total = order?.totalAmount ?? project.estimatedPrice ?? 0;
    final paid = order?.depositPaid ?? project.advancePayment ?? 0;
    final remaining = (order?.remainingBalance ?? project.remainingAmount)
        .clamp(0, double.infinity);
    final fullyPaid = remaining <= 0;
    final date = order?.orderDate ?? project.createdAt;
    final clientName = client?.displayName.trim();
    final initial = clientName?.isNotEmpty == true
        ? clientName!.substring(0, 1).toUpperCase()
        : '?';

    return RepaintBoundary(
      key: repaintBoundaryKey,
      child: AppSectionSurface(
        bordered: true,
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: context.surfaceLightColor,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
                  ),
                  child: Text(
                    initial,
                    style: AppTextStyles.h4.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order?.orderNumber ?? 'Commande #${project.id}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.h4.copyWith(
                          color: context.textPrimaryColor,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${clientName?.isNotEmpty == true ? clientName : 'Client non renseigné'} · ${DateFormat('d MMM yyyy', 'fr').format(date)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
                if (order != null)
                  IconButton.filledTonal(
                    tooltip: 'Ouvrir la facture',
                    onPressed: () => AppNavigator.to(
                      AppRoutes.invoiceLive,
                      arguments: order!.id,
                    ),
                    icon: const Icon(Icons.receipt_long_outlined),
                  ),
              ],
            ),
            // Le lieu de retrait : un reçu qui ne dit pas où revenir oblige le
            // client à retrouver le couturier autrement.
            if (atelierLocation != null) ...[
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Icon(
                    Icons.place_outlined,
                    size: 16,
                    color: context.textSecondaryColor,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      atelierLocation,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                AppMetricPill(
                  label: 'articles',
                  value: '${articles.length}',
                  icon: Icons.checkroom_outlined,
                  accentColor: context.textSecondaryColor,
                ),
                AppMetricPill(
                  label: 'statut',
                  value: getStatusLabel(project.status),
                  icon: project.status.icon,
                  accentColor: context.textSecondaryColor,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Container(
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              decoration: BoxDecoration(
                color: context.surfaceLightColor,
                borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
              ),
              child: Column(
                children: [
                  _MoneyLine(label: 'Total', value: money.format(total)),
                  const SizedBox(height: AppSpacing.xs),
                  _MoneyLine(label: 'Déjà encaissé', value: money.format(paid)),
                  const SizedBox(height: AppSpacing.md),
                  Divider(height: 1, color: context.dividerColor),
                  const SizedBox(height: AppSpacing.md),
                  _MoneyLine(
                    label: fullyPaid ? 'Paiement soldé' : 'Reste à encaisser',
                    value: fullyPaid ? 'Réglé' : money.format(remaining),
                    emphasized: true,
                    icon: fullyPaid
                        ? Icons.check_circle_outline_rounded
                        : Icons.account_balance_wallet_outlined,
                  ),
                ],
              ),
            ),
            if (!fullyPaid) ...[
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                // Tonal, not filled: the status action in the bar below is the
                // screen's primary. Two filled buttons in one scroll left
                // neither reading as "the" action.
                child: FilledButton.tonalIcon(
                  onPressed: () =>
                      _recordPayment(context, remaining.toDouble(), money),
                  icon: const Icon(Icons.payments_outlined),
                  label: const Text('Encaisser un paiement'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Records a payment through an explicit, editable confirmation.
  ///
  /// The button used to write the entire remaining balance straight to the cash
  /// book on a single tap — no confirmation, no undo, and no way to enter the
  /// partial acompte that is the normal case here. A mis-tap silently booked a
  /// full settlement, and a double tap booked it twice.
  Future<void> _recordPayment(
    BuildContext context,
    double remaining,
    MoneyFormatter money,
  ) async {
    final controller = TextEditingController(
      text: remaining.toStringAsFixed(0),
    );
    try {
      final amount = await showModalBottomSheet<double>(
        context: context,
        useSafeArea: true,
        isScrollControlled: true,
        builder: (sheetContext) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            0,
            AppSpacing.gutter,
            MediaQuery.viewInsetsOf(sheetContext).bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AppSectionHeader(
                title: 'Encaisser un paiement',
                subtitle: 'Montant reçu du client maintenant.',
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: controller,
                autofocus: true,
                inputFormatters: amountInputFormatters,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: 'Montant',
                  suffixText: money.currency,
                  helperText: 'Solde restant : ${money.format(remaining)}',
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              FilledButton(
                onPressed: () {
                  final value = AppNumbers.tryParse(controller.text);
                  if (value == null || value <= 0) return;
                  Navigator.pop(sheetContext, value.clamp(0, remaining));
                },
                child: const Text('Confirmer l’encaissement'),
              ),
            ],
          ),
        ),
      );
      if (amount != null) onPayment(amount);
    } finally {
      controller.dispose();
    }
  }
}

class _MoneyLine extends StatelessWidget {
  const _MoneyLine({
    required this.label,
    required this.value,
    this.emphasized = false,
    this.icon,
  });

  final String label;
  final String value;
  final bool emphasized;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 17, color: context.textPrimaryColor),
          const SizedBox(width: AppSpacing.xs),
        ],
        Expanded(
          child: Text(
            label,
            style: (emphasized ? AppTextStyles.label : AppTextStyles.bodyMedium)
                .copyWith(
                  color: emphasized
                      ? context.textPrimaryColor
                      : context.textSecondaryColor,
                ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          value,
          style: (emphasized ? AppTextStyles.h4 : AppTextStyles.label).copyWith(
            color: context.textPrimaryColor,
          ),
        ),
      ],
    );
  }
}
