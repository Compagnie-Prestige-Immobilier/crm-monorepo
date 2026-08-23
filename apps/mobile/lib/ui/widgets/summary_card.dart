import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_pressable.dart';

class SummaryCard extends StatelessWidget {
  const SummaryCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    this.accentColor,
    this.surfaceColor,
    this.isLoading = false,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;
  final Color? accentColor;
  final Color? surfaceColor;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final Color accent = accentColor ?? theme.colorScheme.primary;
    final Color surface =
        surfaceColor ?? theme.colorScheme.surfaceContainerLowest;

    return CpiPressable(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: surface,
          borderRadius: CpiRadius.brLg,
          border: Border.all(color: cpi.borderSubtle),
        ),
        padding: const EdgeInsets.all(CpiSpacing.md),
        child: Row(
          children: <Widget>[
            Container(
              width: kCpiMinTouchTarget,
              height: kCpiMinTouchTarget,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.10),
                borderRadius: CpiRadius.brMd,
              ),
              child: Icon(icon, color: accent, size: CpiIconSize.lg),
            ),
            const SizedBox(width: CpiSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: CpiSpacing.xxs / 2),
                  if (isLoading)
                    const _CountPlaceholder()
                  else
                    AnimatedSwitcher(
                      duration: CpiMotion.of(context).micro,
                      switchInCurve: CpiMotion.of(context).easeOut,
                      child: Text(
                        value,
                        key: ValueKey<String>(value),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: accent,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Icon(
              PhosphorIconsRegular.caretRight,
              color: theme.colorScheme.onSurfaceVariant,
              size: CpiIconSize.md,
            ),
          ],
        ),
      ),
    );
  }
}

class _CountPlaceholder extends StatelessWidget {
  const _CountPlaceholder();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final double height =
        (theme.textTheme.headlineSmall?.fontSize ?? 26) * 1.15;
    return SizedBox(
      height: height,
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          width: 44,
          height: height * 0.6,
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerHigh,
            borderRadius: CpiRadius.brXs,
          ),
        ),
      ),
    );
  }
}
