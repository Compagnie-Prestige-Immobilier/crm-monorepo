import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/data/services/app_space.dart';
import 'package:gnawalma/app/shared/theme/app_colors.dart';
import 'package:gnawalma/app/shared/theme/app_theme.dart';

/// Guards the one thing that distinguishes the two spaces.
///
/// The accent is the only token that differs between client and atelier. If it
/// ever resolves to the same value on both sides, or if a widget stops reading
/// it from the theme, the spaces silently re-converge — which is the state this
/// work started from.
void main() {
  group('space accents', () {
    test('the two spaces resolve to different primaries', () {
      for (final brightness in Brightness.values) {
        final client = AppTheme.forSpace(AppSpace.client, brightness);
        final atelier = AppTheme.forSpace(AppSpace.atelier, brightness);

        expect(
          client.colorScheme.primary,
          isNot(atelier.colorScheme.primary),
          reason: 'client and atelier share a primary in $brightness',
        );
      }
    });

    test('each space uses its own hue', () {
      expect(
        AppTheme.forSpace(
          AppSpace.client,
          Brightness.light,
        ).colorScheme.primary,
        AppColors.clientAccent,
      );
      expect(
        AppTheme.forSpace(
          AppSpace.atelier,
          Brightness.light,
        ).colorScheme.primary,
        AppColors.atelierAccent,
      );
    });

    test('status colours never borrow a space accent', () {
      // "In progress" wearing the atelier accent meant an in-progress row and
      // the selected tab were the same colour on one side of the product only.
      for (final accent in [AppColors.clientAccent, AppColors.atelierAccent]) {
        expect(AppColors.statusInProgress, isNot(accent));
        expect(AppColors.statusTodo, isNot(accent));
        expect(AppColors.statusCompleted, isNot(accent));
        expect(AppColors.statusDelivered, isNot(accent));
      }
    });

    test('the chip theme carries the space accent', () {
      // Note: Material 3's FilterChip does **not** read this value for its
      // selected container — it resolves that from its own defaults, which is
      // why the category chips rendered in the wrong space's hue on a
      // correctly themed screen. Call sites therefore pass
      // `selectedColor: colorScheme.primary` explicitly. This assertion keeps
      // the theme honest for the chips that do read it.
      expect(
        AppTheme.forSpace(
          AppSpace.client,
          Brightness.light,
        ).chipTheme.selectedColor,
        AppColors.clientAccent,
      );
      expect(
        AppTheme.forSpace(
          AppSpace.atelier,
          Brightness.light,
        ).chipTheme.selectedColor,
        AppColors.atelierAccent,
      );
    });

    test('accent contrast holds AA against its own surface', () {
      double luminance(Color c) => c.computeLuminance();
      double ratio(Color a, Color b) {
        final l1 = luminance(a), l2 = luminance(b);
        final hi = l1 > l2 ? l1 : l2, lo = l1 > l2 ? l2 : l1;
        return (hi + 0.05) / (lo + 0.05);
      }

      // Light: white text on the accent fill, and the accent as text on white.
      for (final space in AppSpace.values) {
        final accent = space.accent(isDark: false);
        expect(
          ratio(accent, const Color(0xFFFFFFFF)),
          greaterThanOrEqualTo(4.5),
          reason: '$space light accent fails AA on white',
        );
      }

      // Dark: the lifted accent against the dark page, under black text.
      for (final space in AppSpace.values) {
        final accent = space.accent(isDark: true);
        expect(
          ratio(accent, AppColors.darkBackground),
          greaterThanOrEqualTo(4.5),
          reason: '$space dark accent fails AA on the dark page',
        );
        expect(
          ratio(accent, const Color(0xFF000000)),
          greaterThanOrEqualTo(4.5),
          reason: '$space dark accent fails AA under black text',
        );
      }
    });
  });
}
