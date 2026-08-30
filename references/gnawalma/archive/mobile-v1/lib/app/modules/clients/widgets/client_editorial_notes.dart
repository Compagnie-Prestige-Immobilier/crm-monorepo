import 'package:flutter/material.dart';

import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

class ClientEditorialNotes extends StatelessWidget {
  const ClientEditorialNotes({super.key, required this.client});

  final ClientModel client;

  @override
  Widget build(BuildContext context) {
    final note = client.notes?.trim();
    final hasContent =
        (note?.isNotEmpty ?? false) ||
        client.favoriteColors.isNotEmpty ||
        client.preferredStyles.isNotEmpty;
    if (!hasContent) return const SizedBox.shrink();

    return Semantics(
      container: true,
      label: 'Notes et préférences du client',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Préférences',
            icon: Icons.auto_awesome_outlined,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppSectionSurface(
            showAccent: true,
            accentColor: Theme.of(context).colorScheme.primary,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (note != null && note.isNotEmpty)
                  _PreferenceBlock(
                    icon: Icons.notes_rounded,
                    title: 'Note atelier',
                    child: Text(
                      note,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: context.textPrimaryColor,
                        height: 1.5,
                      ),
                    ),
                  ),
                if (client.favoriteColors.isNotEmpty) ...[
                  if (note != null && note.isNotEmpty)
                    const SizedBox(height: AppSpacing.md),
                  _PreferenceBlock(
                    icon: Icons.palette_outlined,
                    title: 'Couleurs préférées',
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: client.favoriteColors
                          .map(
                            (value) => _PreferenceChip(
                              label: value,
                              icon: Icons.circle,
                              accent: Theme.of(context).colorScheme.primary,
                            ),
                          )
                          .toList(growable: false),
                    ),
                  ),
                ],
                if (client.preferredStyles.isNotEmpty) ...[
                  if ((note != null && note.isNotEmpty) ||
                      client.favoriteColors.isNotEmpty)
                    const SizedBox(height: AppSpacing.md),
                  _PreferenceBlock(
                    icon: Icons.style_outlined,
                    title: 'Styles préférés',
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: client.preferredStyles
                          .map((value) => _PreferenceChip(label: value))
                          .toList(growable: false),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreferenceBlock extends StatelessWidget {
  const _PreferenceBlock({
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: context.textSecondaryColor),
            const SizedBox(width: 8),
            Text(
              title,
              style: AppTextStyles.bodySmall.copyWith(
                color: context.textSecondaryColor,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: 9),
        child,
      ],
    );
  }
}

class _PreferenceChip extends StatelessWidget {
  const _PreferenceChip({required this.label, this.icon, this.accent});

  final String label;
  final IconData? icon;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final color = accent ?? context.textSecondaryColor;
    return Container(
      constraints: const BoxConstraints(minHeight: 38),
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: context.backgroundColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
        border: Border.all(color: context.borderColor.withValues(alpha: .75)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: color),
            const SizedBox(width: 7),
          ],
          Text(
            label,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textPrimaryColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
