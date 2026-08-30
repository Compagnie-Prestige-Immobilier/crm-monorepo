import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Theme-aware color extensions
///
/// Provides context-aware colors that adapt to light/dark theme
extension ThemeColors on BuildContext {
  /// Get current theme brightness
  bool get isDarkTheme => Theme.of(this).brightness == Brightness.dark;

  /// Background color (theme-aware)
  Color get backgroundColor =>
      isDarkTheme ? AppColors.darkBackground : AppColors.background;

  /// Surface color (theme-aware)
  Color get surfaceColor =>
      isDarkTheme ? AppColors.darkSurface : AppColors.surface;

  /// Surface light variant (theme-aware)
  Color get surfaceLightColor =>
      isDarkTheme ? AppColors.darkSurfaceLight : AppColors.surfaceDark;

  /// Primary text color (theme-aware)
  Color get textPrimaryColor =>
      isDarkTheme ? AppColors.darkTextPrimary : AppColors.textPrimary;

  /// Secondary text color (theme-aware)
  Color get textSecondaryColor =>
      isDarkTheme ? AppColors.darkTextSecondary : AppColors.textSecondary;

  /// Border color (theme-aware)
  Color get borderColor =>
      isDarkTheme ? AppColors.darkBorder : AppColors.border;

  /// Border light variant (theme-aware)
  Color get borderLightColor =>
      isDarkTheme ? AppColors.darkSurfaceLight : AppColors.borderLight;

  /// Divider color (theme-aware)
  Color get dividerColor =>
      isDarkTheme ? AppColors.darkBorder : AppColors.divider;

  /// The accent of the space this widget is rendering inside.
  ///
  /// Resolves through the shell's own theme, so the same widget is orange in
  /// the client space and blue in the atelier without knowing which it is in.
  /// Screens must use this rather than `AppColors.clientAccent` /
  /// `AppColors.atelierAccent` — a literal is how one space ends up wearing
  /// the other's hue.
  Color get accentColor => Theme.of(this).colorScheme.primary;

  /// Text and icons sitting directly on [accentColor].
  Color get onAccentColor => Theme.of(this).colorScheme.onPrimary;

  /// Wash behind a selected chip or an accent-tinted row.
  Color get accentSoftColor => Theme.of(this).colorScheme.primaryContainer;

  /// Readable ink for text on [accentSoftColor]. Never [accentColor] — the
  /// accent on its own wash is roughly 1.3:1.
  Color get onAccentSoftColor => Theme.of(this).colorScheme.onPrimaryContainer;

  /// Foreground for a status (success / warning / error / info).
  ///
  /// The base status hues are tuned for ink-on-white. On the dark page they
  /// sit too close to the surface to read, so they are lifted toward the light.
  Color statusForeground(Color status) => isDarkTheme
      ? Color.alphaBlend(Colors.white.withValues(alpha: 0.42), status)
      : status;

  /// Fill behind a status label or icon.
  ///
  /// Replaces the `*Soft` constants, which are light-only washes and read as a
  /// bright rectangle on the dark page.
  Color statusSurface(Color status) =>
      status.withValues(alpha: isDarkTheme ? 0.22 : 0.09);
}
