import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/buttons/animated_primary_button.dart';
import '../controllers/new_order_provider.dart';

class OrderBottomBar extends ConsumerWidget {
  const OrderBottomBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final hasCart = state.cartItems.isNotEmpty;
    final hasDraft = state.garmentType.trim().isNotEmpty || state.itemPrice > 0;
    final canAddDraft =
        state.garmentType.trim().isNotEmpty && state.itemPrice > 0;
    final canContinue = hasCart || canAddDraft;

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: context.surfaceColor,
        border: Border(
          top: BorderSide(color: context.borderColor.withValues(alpha: 0.72)),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (hasDraft) ...[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: canAddDraft ? notifier.addItemToCart : null,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Ajouter l’article'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            Expanded(
              child: AnimatedPrimaryButton(
                label: hasCart ? 'Vérifier la commande' : 'Continuer',
                icon: Icons.arrow_forward_rounded,
                enabled: canContinue,
                backgroundColor: Theme.of(context).colorScheme.primary,
                onPressed: notifier.confirmAndNext,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
