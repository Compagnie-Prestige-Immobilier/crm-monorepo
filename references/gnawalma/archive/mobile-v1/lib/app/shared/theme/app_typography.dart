import 'package:flutter/material.dart';

/// Typography for Gnawalma — system font only.
///
/// The app uses the platform's own typeface (San Francisco on iOS, Roboto on
/// Android) for everything. No bundled font files. Hierarchy is carried by
/// size, weight and tracking alone, which is what Uber, Airbnb and the rest of
/// the reference set actually do — they lean on one native sans across the
/// whole product rather than a display serif.
///
/// The three entry points ([display], [ui], [mono]) are kept so the type scale
/// and every screen that calls them stay unchanged; they now differ by weight
/// and figure style rather than by family.
class AppTypography {
  AppTypography._();

  // Null family => the platform default UI font. Named for documentation only.
  static const String? displayFamily = null;
  static const String? uiFamily = null;
  static const String? monoFamily = null;

  /// Headlines. System font, heavy, with negative tracking so large sizes read
  /// as a set headline rather than as enlarged body text.
  static TextStyle display({
    required double size,
    double weight = 700,
    double opsz = 144, // accepted for call-site compatibility; unused now
    double soft = 0,
    bool wonk = true,
    double? height,
    double? letterSpacing,
    Color? color,
  }) {
    return TextStyle(
      fontSize: size,
      height: height,
      letterSpacing: letterSpacing,
      color: color,
      fontWeight: _weight(weight),
    );
  }

  /// Interface text: labels, body, buttons, rows.
  static TextStyle ui({
    required double size,
    double weight = 400,
    double? height,
    double? letterSpacing,
    Color? color,
  }) {
    return TextStyle(
      fontSize: size,
      height: height,
      letterSpacing: letterSpacing,
      color: color,
      fontWeight: _weight(weight),
    );
  }

  /// Quantities — money, measurements, counts, dates.
  ///
  /// Still the system font, but with tabular (fixed-width) figures so a column
  /// of prices lines up on the digit. This keeps the alignment benefit of a
  /// monospace face without shipping one or looking like code.
  static TextStyle mono({
    required double size,
    double weight = 500,
    double? height,
    double? letterSpacing,
    Color? color,
  }) {
    return TextStyle(
      fontSize: size,
      height: height,
      letterSpacing: letterSpacing,
      color: color,
      fontWeight: _weight(weight),
      fontFeatures: const [FontFeature.tabularFigures()],
    );
  }

  static FontWeight _weight(double weight) {
    final bucket = (weight / 100).round().clamp(1, 9);
    return FontWeight.values[bucket - 1];
  }
}
