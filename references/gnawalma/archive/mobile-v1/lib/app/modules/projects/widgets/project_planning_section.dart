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

class ProjectPlanningSection extends ConsumerWidget {
  const ProjectPlanningSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(addEditProjectProvider());
    final notifier = ref.read(addEditProjectProvider().notifier);
    final money = ref.watch(moneyFormatterProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppSectionHeader(
          title: 'Planning et prix',
          icon: Icons.event_note_outlined,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppSectionSurface(
          child: Column(
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  final stack = constraints.maxWidth < 420;
                  final start = _DateField(
                    label: 'Début',
                    date: state.startDate,
                    icon: Icons.play_circle_outline_rounded,
                    onTap: () => notifier.selectStartDate(context),
                  );
                  final delivery = _DateField(
                    label: 'Livraison *',
                    date: state.expectedDeliveryDate,
                    icon: Icons.event_available_outlined,
                    onTap: () => notifier.selectDeliveryDate(context),
                  );
                  return stack
                      ? Column(
                          children: [
                            start,
                            const SizedBox(height: AppSpacing.sm),
                            delivery,
                          ],
                        )
                      : Row(
                          children: [
                            Expanded(child: start),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(child: delivery),
                          ],
                        );
                },
              ),
              const SizedBox(height: AppSpacing.md),
              TextFormField(
                controller: notifier.priceController,
                scrollPadding: const EdgeInsets.only(
                  bottom: AppSpacing.keyboardScrollPadding,
                ),
                keyboardType: TextInputType.number,
                inputFormatters: amountInputFormatters,
                validator: (value) {
                  final amount = AppNumbers.tryParse(value?.trim() ?? '');
                  if (amount == null || amount <= 0) {
                    return 'Saisissez un prix supérieur à zéro.';
                  }
                  return null;
                },
                decoration: InputDecoration(
                  labelText: 'Prix total *',
                  hintText: 'Ex. 45 000',
                  prefixIcon: const Icon(Icons.sell_outlined),
                  suffixText: money.currency,
                  suffixIcon: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: notifier.priceController,
                    builder: (_, value, _) {
                      final amount = AppNumbers.tryParse(value.text.trim());
                      return amount != null && amount > 0
                          ? Icon(
                              Icons.check_circle_rounded,
                              color: context.statusForeground(
                                AppColors.success,
                              ),
                            )
                          : const SizedBox.shrink();
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.date,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final DateTime? date;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final value = date;
    return PressableSurface(
      onTap: onTap,
      accentColor: Theme.of(context).colorScheme.primary,
      semanticLabel: value == null
          ? '$label, aucune date choisie. Appuyez pour choisir une date.'
          : '$label, ${_formatDate(value)}',
      child: Row(
        children: [
          Icon(icon, color: context.textSecondaryColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTextStyles.caption.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
                Text(
                  value == null ? 'À définir' : _formatDate(value),
                  style: AppTextStyles.label.copyWith(
                    color: value == null
                        ? context.textSecondaryColor
                        : context.textPrimaryColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime value) {
    return '${value.day.toString().padLeft(2, '0')}/'
        '${value.month.toString().padLeft(2, '0')}/'
        '${value.year}';
  }
}
