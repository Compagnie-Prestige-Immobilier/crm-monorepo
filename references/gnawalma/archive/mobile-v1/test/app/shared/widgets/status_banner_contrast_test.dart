import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/shared/theme/app_theme.dart';
import 'package:gnawalma/app/shared/widgets/layouts/polished_page.dart';

double _luminance(Color color) {
  double channel(double value) {
    return value <= 0.03928
        ? value / 12.92
        : math.pow((value + 0.055) / 1.055, 2.4).toDouble();
  }

  return 0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
}

double _contrast(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// The banner fill is semi-transparent, so the effective background is the fill
/// composited over the page behind it.
Color _effectiveBackground(Color fill, Color page) =>
    Color.alphaBlend(fill, page);

void main() {
  // The banner used to paint `status.withValues(alpha: 0.07)` behind the raw
  // light-mode hue on both themes, which on the near-black page left the label
  // around 3:1. It is used on a dozen screens, so it is worth pinning.
  group('AppStatusBanner contrast', () {
    for (final (themeName, theme) in [
      ('light', AppTheme.lightTheme),
      ('dark', AppTheme.darkTheme),
    ]) {
      for (final tone in AppStatusTone.values) {
        testWidgets('$tone message is readable on the $themeName theme', (
          tester,
        ) async {
          await tester.pumpWidget(
            MaterialApp(
              theme: theme,
              home: Scaffold(
                body: AppStatusBanner(
                  message: 'Un message de statut.',
                  icon: Icons.info_outline_rounded,
                  tone: tone,
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();

          final text = tester.widget<Text>(find.text('Un message de statut.'));
          final container = tester.widget<Container>(
            find
                .ancestor(
                  of: find.text('Un message de statut.'),
                  matching: find.byType(Container),
                )
                .first,
          );
          final fill = (container.decoration! as BoxDecoration).color!;

          expect(
            _contrast(
              text.style!.color!,
              _effectiveBackground(fill, theme.scaffoldBackgroundColor),
            ),
            greaterThanOrEqualTo(4.5),
            reason: '$tone on $themeName',
          );
        });
      }
    }

    testWidgets('a long error message is not clipped', (tester) async {
      const long =
          'Impossible de créer l’atelier pour le moment. Vérifiez votre '
          'connexion et réessayez, puis contactez le support si le problème '
          'persiste après plusieurs tentatives sur le réseau mobile.';
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: AppStatusBanner(
              message: long,
              icon: Icons.error_outline_rounded,
              tone: AppStatusTone.error,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final text = tester.widget<Text>(find.text(long));
      expect(text.maxLines, isNull);
      expect(text.overflow, isNot(TextOverflow.ellipsis));
    });
  });
}
