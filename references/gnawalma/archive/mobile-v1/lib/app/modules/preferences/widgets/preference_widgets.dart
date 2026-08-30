import 'package:flutter/material.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../shared/widgets/layouts/polished_page.dart';

/// Building blocks shared between the atelier's [PreferencesView] and the
/// client's preferences screen — one implementation of the settings-row
/// chrome instead of two copies that drift apart (repeated widgets are an
/// app-wide bug class, not a per-screen one).

/// Appearance options. Kept in one place so the segmented control and the
/// stored value can never drift apart.
const List<String> themeOptions = ['Clair', 'Sombre', 'Système'];

/// One preferences group. Same chrome as the Réglages screen: a real header,
/// a rule that brackets the group, hairline-separated rows aligned to the
/// glyph.
class PreferenceGroup extends StatelessWidget {
  const PreferenceGroup({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
    this.footer,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(
          title: title,
          subtitle: subtitle,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.listRowInset,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Divider(height: 1, color: context.dividerColor),
        const SizedBox(height: 2),
        for (var index = 0; index < children.length; index++) ...[
          children[index],
          if (index < children.length - 1)
            Divider(
              height: 1,
              indent: AppSpacing.listDividerIndent,
              color: context.dividerColor,
            ),
        ],
        if (footer != null) ...[const SizedBox(height: AppSpacing.sm), footer!],
      ],
    );
  }
}

/// A settings row whose current value is part of the reading, not a grey note.
///
/// Geometry is deliberately identical to `AppActionTile` — same inset, glyph
/// size and gap — so the two read as one family and share
/// [AppSpacing.listDividerIndent]. Only the value's weight differs.
class PreferenceRow extends StatelessWidget {
  const PreferenceRow({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String value;

  /// Null for rows that state a fact rather than open a picker; the row then
  /// renders without a chevron and without a press state.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      showBorder: false,
      backgroundColor: Colors.transparent,
      borderRadius: AppSpacing.radiusMD,
      semanticLabel: '$title. $subtitle. Valeur actuelle : $value',
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.listRowInset,
        vertical: 14,
      ),
      child: Row(
        children: [
          Icon(icon, size: 22, color: context.textPrimaryColor),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ),
          if (onTap != null) ...[
            const SizedBox(width: AppSpacing.xxs),
            Icon(
              Icons.chevron_right_rounded,
              size: 21,
              // Full secondary ink: at 65% this sat near 2.6:1, under the 3:1
              // floor for a graphic that carries meaning.
              color: context.textSecondaryColor,
            ),
          ],
        ],
      ),
    );
  }
}

class ThemeChooser extends StatelessWidget {
  const ThemeChooser({super.key, required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final current = themeOptions.contains(value) ? value : themeOptions.last;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.listRowInset,
        vertical: 14,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.brightness_6_outlined,
                size: 22,
                color: context.textPrimaryColor,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Apparence',
                      style: AppTextStyles.label.copyWith(
                        color: context.textPrimaryColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Clair, sombre ou réglage du téléphone',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Sunken track, ink-filled selection: the active mode is readable
          // without opening anything.
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: context.surfaceLightColor,
              borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
            ),
            child: SegmentedButton<String>(
              showSelectedIcon: false,
              selected: {current},
              onSelectionChanged: (selection) => onChanged(selection.first),
              segments: [
                for (final option in themeOptions)
                  ButtonSegment<String>(
                    value: option,
                    label: Text(
                      option,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PreferenceSwitchTile extends StatelessWidget {
  const PreferenceSwitchTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final iconColor = enabled
        ? context.textPrimaryColor
        : context.textSecondaryColor;
    return Semantics(
      toggled: value,
      enabled: enabled,
      label: '$title. $subtitle',
      child: SwitchListTile.adaptive(
        value: value,
        onChanged: enabled ? onChanged : null,
        // Bare glyph, no tinted tile.
        secondary: Icon(icon, color: iconColor, size: 22),
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          // The token bakes in the light-mode ink; without this the row title
          // was black-on-black under the dark theme.
          style: AppTextStyles.label.copyWith(
            color: enabled
                ? context.textPrimaryColor
                : context.textSecondaryColor,
          ),
        ),
        subtitle: Text(
          subtitle,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.bodySmall.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.listRowInset,
          vertical: 6,
        ),
      ),
    );
  }
}
