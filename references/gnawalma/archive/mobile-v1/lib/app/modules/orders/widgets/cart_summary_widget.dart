import '../../../shared/utils/app_money.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../controllers/new_order_provider.dart';

class CartSummaryWidget extends ConsumerWidget {
  const CartSummaryWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);
    final total = state.cartItems.fold<double>(
      0,
      (sum, item) => sum + (item.estimatedPrice ?? 0),
    );

    return PressableSurface(
      onTap: () => _showCartReview(context, notifier, money),
      accentColor: Theme.of(context).colorScheme.primary,
      semanticLabel:
          '${state.cartItems.length} articles, total ${money.format(total)}. Ouvrir le récapitulatif.',
      padding: const EdgeInsets.all(13),
      child: Row(
        children: [
          // Bare glyph, no tinted tile — same fix already applied to the
          // stock selector row this widget sits next to in the wizard.
          Icon(
            Icons.shopping_bag_outlined,
            color: Theme.of(context).colorScheme.primary,
            size: 24,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${state.cartItems.length} article${state.cartItems.length > 1 ? 's' : ''}',
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Touchez pour vérifier ou retirer un article',
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
            money.format(total, compactSymbol: true),
            style: AppTextStyles.h5.copyWith(
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: 4),
          const Icon(Icons.expand_more_rounded),
        ],
      ),
    );
  }

  void _showCartReview(
    BuildContext context,
    NewOrder notifier,
    MoneyFormatter money,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Consumer(
        builder: (context, ref, _) {
          final state = ref.watch(newOrderProvider);
          return FractionallySizedBox(
            heightFactor: 0.72,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppSectionHeader(
                    title: 'Articles de la commande',
                    subtitle:
                        '${state.cartItems.length} article${state.cartItems.length > 1 ? 's' : ''}',
                    icon: Icons.shopping_bag_outlined,
                    accentColor: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Expanded(
                    child: state.cartItems.isEmpty
                        ? Center(
                            child: Text(
                              'La commande ne contient plus aucun article.',
                              textAlign: TextAlign.center,
                              style: AppTextStyles.bodyMedium.copyWith(
                                color: context.textSecondaryColor,
                              ),
                            ),
                          )
                        : ListView.separated(
                            itemCount: state.cartItems.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(height: AppSpacing.sm),
                            itemBuilder: (context, index) {
                              final item = state.cartItems[index];
                              return AppActionTile(
                                title: item.garmentType,
                                subtitle: 'Pour ${item.forWhom ?? 'le client'}',
                                value: money.format(
                                  item.estimatedPrice ?? 0,
                                  compactSymbol: true,
                                ),
                                icon: Icons.checkroom_rounded,
                                accentColor: Theme.of(
                                  context,
                                ).colorScheme.primary,
                                onTap: () {
                                  Navigator.of(sheetContext).pop();
                                  notifier.loadItemForEdit(index);
                                },
                              );
                            },
                          ),
                  ),
                  if (state.cartItems.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Pour supprimer un article, ouvrez l’étape de vérification finale.',
                      style: AppTextStyles.caption.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
