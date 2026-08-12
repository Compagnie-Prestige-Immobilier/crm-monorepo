import 'package:flutter/material.dart';

/// Typographie CPI (docs/design.md §4).
///
/// Les deux familles sont **empaquetées dans l'APK** (`assets/fonts/`, déclarées
/// dans `pubspec.yaml`). Pas de `google_fonts` : ce paquet télécharge la police
/// au premier lancement, et sur un réseau sénégalais faible l'écran resterait
/// dix secondes en police de repli.
abstract final class CpiFonts {
  /// Titres et chiffres mis en avant.
  static const String display = 'Bricolage Grotesque';

  /// Corps de texte, libellés, boutons.
  static const String body = 'Plus Jakarta Sans';
}

abstract final class CpiTypography {
  /// Interlignes de docs/design.md §4.
  static const double leadingTight = 1.15;
  static const double leadingSnug = 1.35;
  static const double leadingNormal = 1.55;

  /// `letter-spacing: -0.02em` sur les titres. En Flutter `letterSpacing`
  /// s'exprime en pixels logiques, donc on le calcule à partir de la taille.
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

  /// Échelle de docs/design.md §4, racine 16 px, transposée sur les 15 rôles
  /// Material 3.
  static TextTheme textTheme(Color onSurface) {
    final TextTheme theme = TextTheme(
      // display — clamp(2rem, 4vw, 2.75rem)
      displayLarge: _display(44, FontWeight.w800, leadingTight),
      displayMedium: _display(38, FontWeight.w800, leadingTight),
      displaySmall: _display(32, FontWeight.w700, leadingTight),
      // h1 — clamp(1.625rem, 3vw, 2rem)
      headlineLarge: _display(32, FontWeight.w700, leadingTight),
      headlineMedium: _display(28, FontWeight.w700, leadingTight),
      headlineSmall: _display(26, FontWeight.w700, leadingTight),
      // h2 1.5rem · h3 1.25rem · h4 1.0625rem
      titleLarge: _display(24, FontWeight.w600, leadingSnug),
      titleMedium: _display(20, FontWeight.w600, leadingSnug),
      titleSmall: _display(17, FontWeight.w600, leadingSnug),
      // body-xl 1.125rem · body 0.9375rem · small 0.8125rem
      bodyLarge: _body(18, FontWeight.w400, leadingNormal),
      bodyMedium: _body(15, FontWeight.w400, leadingNormal),
      bodySmall: _body(13, FontWeight.w400, leadingNormal),
      // labelLarge sert aux boutons · caption 0.75rem · label 0.6875rem
      labelLarge: _body(15, FontWeight.w600, leadingSnug),
      labelMedium: _body(12, FontWeight.w500, leadingSnug),
      labelSmall: _body(11, FontWeight.w500, leadingSnug),
    );
    return theme.apply(bodyColor: onSurface, displayColor: onSurface);
  }
}
