import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/sheets/add_beneficiary_sheet.dart';
import '../controllers/new_order_provider.dart';

class BeneficiaryList extends ConsumerWidget {
  const BeneficiaryList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final selfLabel = state.selectedClient?.firstName ?? 'Client';

    return SizedBox(
      height: 92,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: AppSpacing.xs),
        children: [
          _BeneficiaryOption(
            label: selfLabel,
            icon: Icons.person_outline_rounded,
            selected: state.selectedBeneficiary == null,
            onTap: () => notifier.setForWhom(selfLabel, null),
          ),
          ...state.clientBeneficiaries.map(
            (beneficiary) => _BeneficiaryOption(
              label: beneficiary.label,
              icon: beneficiary.gender.name == 'child'
                  ? Icons.child_care_rounded
                  : Icons.person_outline_rounded,
              selected: state.selectedBeneficiary?.id == beneficiary.id,
              onTap: () => notifier.setForWhom(beneficiary.label, beneficiary),
            ),
          ),
          _BeneficiaryOption(
            label: 'Ajouter',
            icon: Icons.person_add_alt_1_rounded,
            selected: false,
            dashedIntent: true,
            onTap: state.selectedClient == null
                ? null
                : () => _showAddBeneficiarySheet(context, state, notifier),
          ),
        ],
      ),
    );
  }

  void _showAddBeneficiarySheet(
    BuildContext context,
    dynamic state,
    dynamic notifier,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => AddBeneficiarySheet(
        clientId: state.selectedClient!.id,
        onSave: (beneficiary, save) async {
          if (save) await notifier.createBeneficiary(beneficiary);
          notifier.setForWhom(beneficiary.label, beneficiary);
        },
      ),
    );
  }
}

class _BeneficiaryOption extends StatelessWidget {
  const _BeneficiaryOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.dashedIntent = false,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback? onTap;
  final bool dashedIntent;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 92,
      child: Padding(
        padding: const EdgeInsets.only(right: AppSpacing.sm),
        child: PressableSurface(
          selected: selected,
          enabled: onTap != null,
          onTap: onTap,
          semanticLabel: label,
          accentColor: Theme.of(context).colorScheme.primary,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: selected
                          ? Theme.of(
                              context,
                            ).colorScheme.primary.withValues(alpha: 0.12)
                          : dashedIntent
                          ? context.backgroundColor
                          : context.surfaceColor,
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusControl,
                      ),
                    ),
                    child: Icon(
                      icon,
                      size: 21,
                      color: selected
                          ? Theme.of(context).colorScheme.primary
                          : context.textSecondaryColor,
                    ),
                  ),
                  if (selected)
                    Positioned(
                      right: -5,
                      top: -5,
                      child: SelectionIndicator(
                        selected: true,
                        accent: Theme.of(context).colorScheme.primary,
                        size: 20,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  color: selected
                      ? Theme.of(context).colorScheme.primary
                      : context.textPrimaryColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
