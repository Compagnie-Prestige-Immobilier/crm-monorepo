import '../../../shared/utils/app_money.dart';
import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/add_edit_project_provider.dart';
import '../../../shared/utils/amount_input_formatters.dart';

class ProjectContractStep extends ConsumerWidget {
  const ProjectContractStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);
    final money = ref.watch(moneyFormatterProvider);
    final deliveryDate = state.expectedDeliveryDate;

    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      children: [
        const AppSectionHeader(
          title: 'Prix, acompte et livraison',
          subtitle:
              'Le bouton de création reste désactivé tant que les montants et la date ne sont pas renseignés.',
          icon: Icons.receipt_long_outlined,
        ),
        const SizedBox(height: AppSpacing.md),
        AppSectionSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Accord financier',
                style: AppTextStyles.h5.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Les montants sont enregistrés en ${money.currency}, sans décimales.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.priceController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                inputFormatters: amountInputFormatters,
                decoration: InputDecoration(
                  labelText: 'Prix total *',
                  hintText: 'Ex. 45 000',
                  prefixIcon: const Icon(Icons.sell_outlined),
                  suffixText: money.currency,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.advancePaymentController,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                inputFormatters: amountInputFormatters,
                decoration: InputDecoration(
                  labelText: 'Acompte reçu',
                  hintText: '0 si aucun acompte',
                  prefixIcon: const Icon(Icons.payments_outlined),
                  suffixText: money.currency,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _PaymentSummary(
                priceController: notifier.priceController,
                advanceController: notifier.advancePaymentController,
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppSectionSurface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Date promise au client *',
                style: AppTextStyles.h5.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Choisissez une date réaliste selon la charge actuelle de l’atelier.',
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              PressableSurface(
                onTap: () => notifier.selectDeliveryDate(context),
                accentColor: Theme.of(context).colorScheme.primary,
                semanticLabel: deliveryDate == null
                    ? 'Choisir la date de livraison, obligatoire, aucune date choisie'
                    : 'Modifier la date de livraison, actuellement ${_formatDate(deliveryDate)}',
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: context.surfaceLightColor,
                        borderRadius: BorderRadius.circular(
                          AppSpacing.radiusControl,
                        ),
                      ),
                      child: Icon(
                        Icons.event_available_outlined,
                        color: context.textSecondaryColor,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Livraison prévue',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            deliveryDate == null
                                ? 'À définir'
                                : _formatDate(deliveryDate),
                            style: AppTextStyles.h5.copyWith(
                              color: deliveryDate == null
                                  ? context.textSecondaryColor
                                  : context.textPrimaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
              if (deliveryDate == null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Sans date de livraison, l’article ne peut pas être créé.',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        const AppStatusBanner(
          title: 'Avant de confirmer',
          message:
              'Relisez le vêtement, le tissu, les mesures, le prix et la date avec le client.',
          icon: Icons.fact_check_outlined,
          tone: AppStatusTone.info,
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }

  static String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year}';
  }
}

class _PaymentSummary extends ConsumerWidget {
  const _PaymentSummary({
    required this.priceController,
    required this.advanceController,
  });

  final TextEditingController priceController;
  final TextEditingController advanceController;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    return ListenableBuilder(
      listenable: Listenable.merge([priceController, advanceController]),
      builder: (context, _) {
        final total = AppNumbers.tryParse(priceController.text.trim()) ?? 0;
        final advance = AppNumbers.tryParse(advanceController.text.trim()) ?? 0;
        final remaining = total - advance;
        final invalid = total <= 0 || advance < 0 || advance > total;
        final errorColor = context.statusForeground(AppColors.error);
        final frameColor = invalid
            ? errorColor
            : Theme.of(context).colorScheme.primary;

        return AnimatedContainer(
          duration: MediaQuery.disableAnimationsOf(context)
              ? Duration.zero
              : const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(AppSpacing.cardPadding),
          decoration: BoxDecoration(
            color: frameColor.withValues(alpha: 0.065),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
            border: Border.all(color: frameColor.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              _SummaryLine(label: 'Prix convenu', value: money.format(total)),
              const SizedBox(height: 8),
              _SummaryLine(label: 'Acompte reçu', value: money.format(advance)),
              const Divider(height: AppSpacing.lg),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      invalid ? 'Montants à corriger' : 'Reste à payer',
                      style: AppTextStyles.label.copyWith(
                        color: invalid ? errorColor : context.textPrimaryColor,
                      ),
                    ),
                  ),
                  Text(
                    money.format(remaining.clamp(0, double.infinity)),
                    style: AppTextStyles.h4.copyWith(
                      color: frameColor,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
              if (invalid) ...[
                const SizedBox(height: 8),
                Text(
                  total <= 0
                      ? 'Saisissez un prix supérieur à zéro.'
                      : 'L’acompte ne peut pas dépasser le prix total.',
                  style: AppTextStyles.bodySmall.copyWith(color: errorColor),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ),
        Text(
          value,
          style: AppTextStyles.label.copyWith(color: context.textPrimaryColor),
        ),
      ],
    );
  }
}
