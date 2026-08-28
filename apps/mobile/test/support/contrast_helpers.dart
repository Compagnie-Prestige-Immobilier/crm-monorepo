import 'dart:math' as math;
import 'dart:ui' show Color;

/// Luminance relative WCAG 2.1, §Relative luminance.
/// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
double relativeLuminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/// Ratio de contraste entre deux couleurs opaques (WCAG 2.2, 1.4.3 et 1.4.11).
/// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
double contrastRatio(Color a, Color b) {
  final double la = relativeLuminance(a);
  final double lb = relativeLuminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}
