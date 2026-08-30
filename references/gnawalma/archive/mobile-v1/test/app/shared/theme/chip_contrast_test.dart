import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gnawalma/app/shared/theme/app_theme.dart';

/// WCAG 2.1 relative luminance.
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
  final lighter = math.max(la, lb);
  final darker = math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/// The rendered colour of a chip's label, after `RawChip` has resolved the
/// theme's `labelStyle.color` against the chip's own states.
Color _renderedLabelColor(WidgetTester tester, String label) {
  final text = tester.widget<Text>(find.text(label));
  final style = DefaultTextStyle.of(tester.element(find.text(label))).style;
  return (text.style?.color ?? style.color)!;
}

Future<void> _pumpChips(WidgetTester tester, ThemeData theme) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: theme,
      home: Scaffold(
        body: Wrap(
          children: [
            FilterChip(
              label: const Text('Sélectionné'),
              selected: true,
              onSelected: (_) {},
            ),
            FilterChip(
              label: const Text('Non sélectionné'),
              selected: false,
              onSelected: (_) {},
            ),
          ],
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  // The bug this guards: `chipTheme.labelStyle` carried a fixed ink colour while
  // `selectedColor` was also ink, so every selected chip in the app rendered as
  // a black pill with an invisible label.
  group('chip label contrast', () {
    testWidgets('a selected chip label is readable on the light theme', (
      tester,
    ) async {
      final theme = AppTheme.lightTheme;
      await _pumpChips(tester, theme);

      final selectedFill = theme.chipTheme.selectedColor!;
      final selectedLabel = _renderedLabelColor(tester, 'Sélectionné');

      expect(
        _contrast(selectedLabel, selectedFill),
        greaterThanOrEqualTo(4.5),
        reason: 'selected chip label on $selectedFill',
      );
    });

    testWidgets('an unselected chip label is readable on the light theme', (
      tester,
    ) async {
      final theme = AppTheme.lightTheme;
      await _pumpChips(tester, theme);

      expect(
        _contrast(
          _renderedLabelColor(tester, 'Non sélectionné'),
          theme.chipTheme.backgroundColor!,
        ),
        greaterThanOrEqualTo(4.5),
      );
    });

    testWidgets('both chip states stay readable on the dark theme', (
      tester,
    ) async {
      final theme = AppTheme.darkTheme;
      await _pumpChips(tester, theme);

      expect(
        _contrast(
          _renderedLabelColor(tester, 'Sélectionné'),
          theme.chipTheme.selectedColor!,
        ),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        _contrast(
          _renderedLabelColor(tester, 'Non sélectionné'),
          theme.chipTheme.backgroundColor!,
        ),
        greaterThanOrEqualTo(4.5),
      );
    });
  });
}
