import 'package:flutter/material.dart';

abstract final class CpiFonts {
  /// Une seule famille, comme gnawalma : les titres se distinguent par la
  /// graisse et le crénage serré, pas par une deuxième police.
  static const String display = 'Plus Jakarta Sans';

  static const String body = 'Plus Jakarta Sans';
}

abstract final class CpiTypography {
  static const double leadingTight = 1.15;
  static const double leadingSnug = 1.35;
  static const double leadingNormal = 1.55;

  /// Planchers hauts à dessein : l'app se lit d'un coup d'œil, en plein
  /// soleil, par des agents de terrain — jamais sous 16 pour le corps.
  static const double minBodySize = 18;

  static const double minLabelSize = 15;

  static const TextStyle sectionLabel = TextStyle(
    fontFamily: CpiFonts.body,
    fontSize: 15,
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

  /// Chiffres à chasse fixe. Un compteur qui passe de 9 à 10 ne doit pas
  /// décaler la ligne entière : les `headline*` portent les chiffres de
  /// tableau de bord, et eux seuls défilent.
  static const List<FontFeature> _tabular = <FontFeature>[
    FontFeature.tabularFigures(),
  ];

  static TextTheme textTheme(Color onSurface) {
    final TextTheme theme = TextTheme(
      displayLarge: _display(38, FontWeight.w700, leadingTight),
      displayMedium: _display(34, FontWeight.w700, leadingTight),
      displaySmall: _display(29, FontWeight.w700, leadingTight),
      headlineLarge: _display(
        30,
        FontWeight.w700,
        leadingTight,
      ).copyWith(fontFeatures: _tabular),
      headlineMedium: _display(
        27,
        FontWeight.w700,
        leadingTight,
      ).copyWith(fontFeatures: _tabular),
      headlineSmall: _display(
        26,
        FontWeight.w700,
        leadingTight,
      ).copyWith(fontFeatures: _tabular),
      titleLarge: _display(22, FontWeight.w600, leadingSnug),
      titleMedium: _display(19, FontWeight.w600, leadingSnug),
      titleSmall: _display(18, FontWeight.w600, leadingSnug),
      bodyLarge: _body(19, FontWeight.w400, leadingNormal),
      bodyMedium: _body(minBodySize, FontWeight.w400, leadingNormal),
      bodySmall: _body(minBodySize, FontWeight.w400, leadingNormal),
      labelLarge: _body(18, FontWeight.w600, leadingSnug),
      labelMedium: _body(16, FontWeight.w600, leadingSnug),
      labelSmall: _body(minLabelSize, FontWeight.w600, leadingSnug),
    );
    return theme.apply(bodyColor: onSurface, displayColor: onSurface);
  }
}
