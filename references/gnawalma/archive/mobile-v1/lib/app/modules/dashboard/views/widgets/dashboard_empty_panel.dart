import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_motion.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';

/// What the dashboard shows when there is no work in the queue.
///
/// The previous version was a single short card with a green tick, which left
/// two thirds of the viewport blank — the screen read as broken rather than as
/// clear. This fills the same region with the drawn garment, one sentence of
/// explanation and the action the user is here to take, so an empty atelier
/// still looks composed.
class DashboardEmptyPanel extends StatelessWidget {
  const DashboardEmptyPanel({
    super.key,
    required this.onCreateOrder,
    required this.onBrowseOrders,
  });

  final VoidCallback onCreateOrder;
  final VoidCallback onBrowseOrders;

  @override
  Widget build(BuildContext context) {
    final panel = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AtelierIllustration(
              motif: AtelierMotif.garment,
              height: 172,
              semanticLabel: 'Atelier sans commande en cours',
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Aucune commande en cours',
              textAlign: TextAlign.center,
              style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Dès qu’une commande est ouverte, son échéance, son avancement et son solde s’affichent ici.',
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodyMedium.copyWith(
                color: context.textSecondaryColor,
                height: 1.42,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onCreateOrder,
                icon: const Icon(Icons.add_rounded, size: 19),
                label: const Text(
                  'Créer une commande',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(AppSpacing.buttonHeightLG),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            TextButton(
              onPressed: onBrowseOrders,
              child: const Text(
                'Voir toutes les commandes',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );

    if (AppMotion.reduced(context)) return panel;
    return panel
        .animate()
        .fadeIn(duration: AppMotion.standard, curve: AppMotion.enter)
        .slideY(
          begin: 0.04,
          end: 0,
          duration: AppMotion.standard,
          curve: AppMotion.enter,
        );
  }
}
