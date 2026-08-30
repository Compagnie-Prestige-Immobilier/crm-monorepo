import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../interaction/pressable_surface.dart';

/// Compact route header. It deliberately avoids decorative lines and oversized
/// copy so the useful content starts near the top of the screen.
class AppPageHeader extends StatelessWidget {
  const AppPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.eyebrow,
    this.leading,
    this.trailing,
    this.accentColor,
    this.compact = false,
    this.padding,
  });

  final String title;
  final String? subtitle;
  final String? eyebrow;
  final Widget? leading;
  final Widget? trailing;
  final Color? accentColor;
  final bool compact;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? Theme.of(context).colorScheme.primary;
    return Padding(
      padding:
          padding ??
          EdgeInsets.fromLTRB(
            AppSpacing.md,
            compact ? AppSpacing.sm : 18,
            AppSpacing.md,
            compact ? AppSpacing.sm : AppSpacing.md,
          ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (leading != null) ...[
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.sm),
              child: leading!,
            ),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
                  Text(
                    eyebrow!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.overline.copyWith(
                      color: accent,
                      letterSpacing: .25,
                    ),
                  ),
                  const SizedBox(height: 5),
                ],
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: (compact ? AppTextStyles.h3 : AppTextStyles.h2)
                      .copyWith(color: context.textPrimaryColor),
                ),
                if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    subtitle!,
                    maxLines: compact ? 1 : 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: context.textSecondaryColor,
                      height: 1.38,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: AppSpacing.sm),
            trailing!,
          ],
        ],
      ),
    );
  }
}

class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.icon,
    this.accentColor,
    this.padding = EdgeInsets.zero,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;
  final Color? accentColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (icon != null) ...[
            // Bare glyph, ink not accent — the tinted tile is gone here too.
            Icon(icon, size: 19, color: context.textPrimaryColor),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.h5.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(width: 8),
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

/// A neutral grouping surface.
///
/// Bordered by default: `background` and `surface` are the same white, so an
/// unbordered surface has no visible edge on the light page. Nested surfaces
/// and tinted (`showAccent`) blocks opt out to avoid a double rule.
class AppSectionSurface extends StatelessWidget {
  const AppSectionSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.cardPadding),
    this.margin = EdgeInsets.zero,
    this.accentColor,
    this.showAccent = false,
    this.elevated = false,
    this.bordered = true,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color? accentColor;
  final bool showAccent;
  final bool elevated;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? Theme.of(context).colorScheme.primary;
    final base = context.surfaceColor;
    final background = showAccent
        ? Color.alphaBlend(accent.withValues(alpha: .035), base)
        : base;
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        border: bordered
            ? Border.all(color: context.borderColor.withValues(alpha: .72))
            : null,
        // Only genuinely floating surfaces — overlays and sticky bars. A card
        // that merely wants emphasis uses the border above.
        boxShadow: elevated ? AppColors.floatingShadow : null,
      ),
      child: child,
    );
  }
}

class AppActionTile extends StatelessWidget {
  const AppActionTile({
    super.key,
    required this.title,
    required this.icon,
    this.subtitle,
    this.value,
    this.onTap,
    this.accentColor,
    this.danger = false,
    this.selected = false,
  });

  final String title;
  final String? subtitle;
  final String? value;
  final IconData icon;
  final VoidCallback? onTap;
  final Color? accentColor;
  final bool danger;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final accent = danger
        ? AppColors.error
        : accentColor ?? Theme.of(context).colorScheme.primary;
    return PressableSurface(
      onTap: onTap,
      accentColor: accent,
      selected: selected,
      showBorder: false,
      backgroundColor: Colors.transparent,
      borderRadius: AppSpacing.radiusMD,
      semanticLabel: [title, subtitle, value].whereType<String>().join('. '),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.listRowInset,
        vertical: 14,
      ),
      child: Row(
        children: [
          // Bare monochrome glyph, no tinted tile. A settings list where every
          // row wears a coloured icon-square is the most recognisable "generic
          // template" screen there is. The icon inherits ink (or error red for
          // destructive rows); only an explicitly-passed accent overrides it.
          Icon(
            icon,
            size: 22,
            color: danger
                ? AppColors.error
                : (accentColor ?? context.textPrimaryColor),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.label.copyWith(
                    color: danger ? AppColors.error : context.textPrimaryColor,
                  ),
                ),
                if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (value != null) ...[
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                value!,
                maxLines: 1,
                textAlign: TextAlign.end,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  color: context.textSecondaryColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
          if (onTap != null) ...[
            const SizedBox(width: 6),
            Icon(
              Icons.chevron_right_rounded,
              size: 21,
              color: context.textSecondaryColor.withValues(alpha: .65),
            ),
          ],
        ],
      ),
    );
  }
}

/// The one inline status/notice block in the product.
///
/// Auth and the setup wizard each carried a private reimplementation of this —
/// same layout, different radius, different colours, one of them without the
/// error live region. Both now come here.
class AppStatusBanner extends StatelessWidget {
  const AppStatusBanner({
    super.key,
    this.title,
    required this.message,
    required this.icon,
    this.tone = AppStatusTone.info,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  /// Optional: a bare notice or an API error message is one sentence and does
  /// not need a heading above it.
  final String? title;
  final String message;
  final IconData icon;
  final AppStatusTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final base = switch (tone) {
      AppStatusTone.success => AppColors.success,
      AppStatusTone.warning => AppColors.warning,
      AppStatusTone.error => AppColors.error,
      AppStatusTone.info => AppColors.info,
      // Not `slate`: 4.83:1 on white is under 4.5 once it sits on this banner's
      // own tinted fill.
      AppStatusTone.neutral => AppColors.neutralInk,
    };
    // The raw status hues are tuned for ink-on-white; on the dark page they sit
    // within ~3:1 of the surface. `statusForeground`/`statusSurface` are the
    // brightness-aware pair the rest of the app already uses — this banner was
    // painting a 7% wash and the light-mode hue on both themes.
    final color = context.statusForeground(base);
    final title = this.title;
    return Semantics(
      liveRegion: tone == AppStatusTone.error,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 12 : 14,
          vertical: compact ? 10 : 12,
        ),
        decoration: BoxDecoration(
          color: context.statusSurface(base),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
        ),
        child: Row(
          crossAxisAlignment: compact
              ? CrossAxisAlignment.center
              : CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: compact ? 19 : 21),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title != null)
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.label.copyWith(color: color),
                    ),
                  if (message.isNotEmpty) ...[
                    if (title != null) const SizedBox(height: 2),
                    Text(
                      message,
                      // Errors used to be clipped at three lines with an
                      // ellipsis, which cut the half of the sentence that says
                      // what to do about it.
                      maxLines: compact ? 2 : null,
                      overflow: compact
                          ? TextOverflow.ellipsis
                          : TextOverflow.clip,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: title == null
                            ? color
                            : context.textSecondaryColor,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (actionLabel != null && onAction != null)
              TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(
                  foregroundColor: color,
                  minimumSize: const Size(44, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                child: Text(actionLabel!),
              ),
          ],
        ),
      ),
    );
  }
}

enum AppStatusTone { info, success, warning, error, neutral }

class AppStickyActionBar extends StatelessWidget {
  const AppStickyActionBar({
    super.key,
    required this.primary,
    this.secondary,
    this.padding = const EdgeInsets.fromLTRB(16, 12, 16, 16),
  });

  final Widget primary;
  final Widget? secondary;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: context.surfaceColor,
          border: Border(
            top: BorderSide(color: context.borderColor.withValues(alpha: .6)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: .035),
              blurRadius: 12,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Row(
          children: [
            if (secondary != null) ...[
              Expanded(child: secondary!),
              const SizedBox(width: AppSpacing.sm),
            ],
            Expanded(flex: secondary == null ? 1 : 2, child: primary),
          ],
        ),
      ),
    );
  }
}

class AppMetricPill extends StatelessWidget {
  const AppMetricPill({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.accentColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? Theme.of(context).colorScheme.primary;
    // Neutral chip; only the glyph carries the status colour. A tinted pill per
    // metric turned every detail header into a row of coloured washes.
    return Semantics(
      label: '$label: $value',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
        decoration: BoxDecoration(
          color: context.surfaceLightColor,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: accent),
            const SizedBox(width: 6),
            Flexible(
              // The label was accepted, used for the semantic string, and then
              // never painted — so a pill that meant "7 échanges" or "62 %"
              // rendered as a bare number next to a glyph.
              child: Text(
                label.trim().isEmpty ? value : '$value $label',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.caption.copyWith(
                  color: context.textPrimaryColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
