import 'package:flutter/material.dart';

abstract final class CpiFonts {
  static const String display = 'Bricolage Grotesque';

  static const String body = 'Plus Jakarta Sans';
}

abstract final class CpiTypography {
  static const double leadingTight = 1.15;
  static const double leadingSnug = 1.35;
  static const double leadingNormal = 1.55;

  static const double minBodySize = 14;

  static const double minLabelSize = 12;

  static const TextStyle sectionLabel = TextStyle(
    fontFamily: CpiFonts.body,
    fontSize: 14,
    fontWeight: FontWeight.w700,
    height: leadingSnug,
    letterSpacing: 0.8,
  );

  static double _tracking(double fontSize) => fontSize * -0.02;

  static TextStyle _display(double size, FontWeight weight, double leading) {
    return TextStyle(
      fontFamily: CpiFonts.display,
      fontSize: size,
      fontWeight: weight,
      height: leading,
      letterSpacing: _tracking(size),
    );
  }

  static TextStyle _body(double size, FontWeight weight, double leading) {
    return TextStyle(
      fontFamily: CpiFonts.body,
      fontSize: size,
      fontWeight: weight,
      height: leading,
    );
  }

  static TextTheme textTheme(Color onSurface) {
    final TextTheme theme = TextTheme(
      displayLarge: _display(44, FontWeight.w800, leadingTight),
      displayMedium: _display(38, FontWeight.w800, leadingTight),
      displaySmall: _display(32, FontWeight.w700, leadingTight),
      headlineLarge: _display(32, FontWeight.w700, leadingTight),
      headlineMedium: _display(28, FontWeight.w700, leadingTight),
      headlineSmall: _display(26, FontWeight.w700, leadingTight),
      titleLarge: _display(24, FontWeight.w600, leadingSnug),
      titleMedium: _display(20, FontWeight.w600, leadingSnug),
      titleSmall: _display(18, FontWeight.w600, leadingSnug),
      bodyLarge: _body(18, FontWeight.w400, leadingNormal),
      bodyMedium: _body(16, FontWeight.w400, leadingNormal),
      bodySmall: _body(minBodySize, FontWeight.w400, leadingNormal),
      labelLarge: _body(16, FontWeight.w600, leadingSnug),
      labelMedium: _body(14, FontWeight.w600, leadingSnug),
      labelSmall: _body(minLabelSize, FontWeight.w600, leadingSnug),
    );
    return theme.apply(bodyColor: onSurface, displayColor: onSurface);
  }
}
