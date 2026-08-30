import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../controllers/new_order_provider.dart';

class SmartTemplatesList extends ConsumerWidget {
  const SmartTemplatesList({super.key});

  static const _templates = [
    ('Boubou', Icons.checkroom_outlined),
    ('Robe', Icons.dry_cleaning_outlined),
    ('Taille basse', Icons.straighten_outlined),
    ('Ensemble', Icons.layers_outlined),
    ('Chemise', Icons.checkroom_outlined),
    ('Pantalon', Icons.style_outlined),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newOrderProvider);
    final notifier = ref.read(newOrderProvider.notifier);

    return SizedBox(
      // The row has to grow with the system text size; at a fixed 52 the pill
      // labels were clipped from the first step above the default scale.
      height: MediaQuery.textScalerOf(
        context,
      ).clamp(maxScaleFactor: 1.6).scale(52),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _templates.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
        itemBuilder: (context, index) {
          final template = _templates[index];
          final selected =
              state.garmentType.trim().toLowerCase() ==
              template.$1.toLowerCase();
          return PressableSurface(
            selected: selected,
            accentColor: Theme.of(context).colorScheme.primary,
            onTap: () => notifier.setGarmentType(template.$1),
            semanticLabel: 'Utiliser le modèle ${template.$1}',
            borderRadius: 999,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(template.$2, size: 18, color: context.textSecondaryColor),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  template.$1,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  // The token's own colour is the light-mode ink, which is
                  // invisible on the dark surface this row sits on.
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
