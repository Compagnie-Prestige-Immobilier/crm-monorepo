import 'package:flutter/material.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../visuals/atelier_illustration.dart';

/// Compact, contextual empty state. It avoids the oversized illustration and
/// duplicate call-to-action pattern that made list pages feel unfinished.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    this.icon,
    this.imagePath,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onActionPressed,
    this.onAction,
    this.secondaryActionLabel,
    this.onSecondaryActionPressed,
    this.compact = false,
    this.accentColor,
    this.motif,
  });

  final IconData? icon;
  final String? imagePath;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onActionPressed;

  /// Backwards-compatible alias used by older screens.
  final VoidCallback? onAction;
  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryActionPressed;
  final bool compact;
  final Color? accentColor;

  /// Draws an [AtelierIllustration] instead of the line glyph.
  ///
  /// Worth it on a screen whose whole body is the empty state — a list page, a
  /// tab — where a lone 52pt icon leaves the rest of the viewport blank. Leave
  /// null inside a card or a section, where the illustration would outweigh the
  /// content it sits beside.
  final AtelierMotif? motif;

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? Theme.of(context).colorScheme.primary;
    final primaryAction = onActionPressed ?? onAction;
    return Align(
      alignment: Alignment.topCenter,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          compact ? AppSpacing.lg : AppSpacing.xl,
          AppSpacing.lg,
          AppSpacing.xl,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildVisual(context, accent),
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              Text(
                title,
                // Always the display face. The old code swapped to Inter when
                // compact, so the Orders empty state (Fraunces) and the Clients
                // empty state (Inter) disagreed on the same screen role.
                style: AppTextStyles.h3.copyWith(
                  fontSize: compact ? 20 : 24,
                  color: context.textPrimaryColor,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: context.textSecondaryColor,
                  height: 1.42,
                ),
                textAlign: TextAlign.center,
              ),
              if (actionLabel != null && primaryAction != null) ...[
                const SizedBox(height: AppSpacing.lg),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 300),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: primaryAction,
                      icon: const Icon(Icons.add_rounded, size: 19),
                      label: Text(actionLabel!),
                    ),
                  ),
                ),
              ],
              if (secondaryActionLabel != null &&
                  onSecondaryActionPressed != null) ...[
                const SizedBox(height: AppSpacing.xs),
                TextButton(
                  onPressed: onSecondaryActionPressed,
                  child: Text(secondaryActionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVisual(BuildContext context, Color accent) {
    if (motif != null) {
      return AtelierIllustration(motif: motif!, height: compact ? 132 : 168);
    }
    if (imagePath != null) {
      return Image.asset(
        imagePath!,
        width: compact ? 72 : 92,
        height: compact ? 72 : 92,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => _buildIcon(accent),
      );
    }
    return _buildIcon(accent);
  }

  Widget _buildIcon(Color accent) {
    // A bare line glyph, low emphasis, no tinted disc behind it. The
    // circle-with-tinted-icon was the single most template-looking element in
    // the product; a thin icon reads as "nothing here yet" without decoration.
    return Builder(
      builder: (context) => Icon(
        icon ?? Icons.inbox_outlined,
        size: compact ? 40 : 52,
        color: context.textSecondaryColor.withValues(alpha: 0.55),
      ),
    );
  }
}
