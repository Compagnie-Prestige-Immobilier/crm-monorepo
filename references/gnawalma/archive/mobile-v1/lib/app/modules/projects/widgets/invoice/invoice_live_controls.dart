import 'package:flutter/material.dart';

import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';

class InvoiceLiveControls extends StatelessWidget {
  const InvoiceLiveControls({
    super.key,
    required this.showTaxId,
    required this.showNote,
    required this.onToggleTaxId,
    required this.onToggleNote,
    required this.onShare,
  });

  final bool showTaxId;
  final bool showNote;
  final VoidCallback onToggleTaxId;
  final VoidCallback onToggleNote;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: context.surfaceColor,
          border: Border(
            top: BorderSide(color: context.borderColor.withValues(alpha: 0.7)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.045),
              blurRadius: 14,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Informations visibles',
              style: AppTextStyles.label.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                // `ChipThemeData.iconTheme` is not state-resolved, so the avatar
                // colour is set here — otherwise the glyph stays grey on the ink
                // fill of a selected chip.
                FilterChip(
                  selected: showTaxId,
                  avatar: Icon(
                    showTaxId
                        ? Icons.visibility_rounded
                        : Icons.visibility_off_outlined,
                    size: 18,
                    color: showTaxId
                        ? Theme.of(context).colorScheme.onPrimary
                        : context.textSecondaryColor,
                  ),
                  label: const Text('Identifiant fiscal'),
                  onSelected: (_) => onToggleTaxId(),
                ),
                FilterChip(
                  selected: showNote,
                  avatar: Icon(
                    showNote ? Icons.notes_rounded : Icons.note_alt_outlined,
                    size: 18,
                    color: showNote
                        ? Theme.of(context).colorScheme.onPrimary
                        : context.textSecondaryColor,
                  ),
                  label: const Text('Note de bas de page'),
                  onSelected: (_) => onToggleNote(),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            FilledButton.icon(
              onPressed: onShare,
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: const Text('Partager la facture en PDF'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: Theme.of(context).colorScheme.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
