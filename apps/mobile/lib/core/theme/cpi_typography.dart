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

/// Échelle typographique du mobile.
///
/// ## Pourquoi elle ne recopie pas §4 à l'identique
///
/// docs/design.md §4 exprime une échelle **web**, en `rem`, sur une racine de
/// 16 px : `body 0.9375rem` (15 px), `small 0.8125rem` (13 px),
/// `caption 0.75rem` (12 px), `label 0.6875rem` (11 px). Transposée telle
/// quelle en `sp`, elle passe sous les planchers de Material 3 — **14 sp pour
/// du corps de texte, 12 sp pour un libellé** — et c'est exactement ce que les
/// utilisateurs ont signalé : libellés de section, sous-titres et libellés de
/// navigation illisibles sur un vrai téléphone.
///
/// Les rôles sont donc **relevés au plancher**, jamais abaissés :
///
/// | Rôle          | §4 (web) | Ici (sp) | Raison                       |
/// | ------------- | -------- | -------- | ---------------------------- |
/// | `bodyMedium`  | 15       | 16       | corps courant                |
/// | `bodySmall`   | 13       | 14       | plancher M3 du corps         |
/// | `labelLarge`  | 15       | 16       | texte de bouton              |
/// | `labelMedium` | 12       | 14       | libellés de navigation       |
/// | `labelSmall`  | 11       | 12       | plancher M3 du libellé       |
/// | `titleSmall`  | 17       | 18       | titres de carte et de ligne  |
///
/// Les rôles déjà au-dessus du plancher (`display`, `headline`, `titleLarge`,
/// `titleMedium`, `bodyLarge`) gardent les valeurs de §4.
abstract final class CpiTypography {
  /// Interlignes de docs/design.md §4.
  static const double leadingTight = 1.15;
  static const double leadingSnug = 1.35;
  static const double leadingNormal = 1.55;

  /// Plancher Material 3 pour du corps de texte.
  static const double minBodySize = 14;

  /// Plancher Material 3 pour un libellé.
  static const double minLabelSize = 12;

  /// En-tête de section (« PROFIL », « SYNCHRONISATION »).
  ///
  /// Un rôle à part et non `labelSmall` : capitalisé et espacé, un libellé perd
  /// en lisibilité à taille égale. Il lui faut plus de graisse et plus de corps
  /// qu'à du texte courant, pas moins.
  static const TextStyle sectionLabel = TextStyle(
    fontFamily: CpiFonts.body,
    fontSize: 14,
    fontWeight: FontWeight.w700,
    height: leadingSnug,
    letterSpacing: 0.8,
  );

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
      titleSmall: _display(18, FontWeight.w600, leadingSnug),
      // body-xl 1.125rem · body relevé à 16 · small relevé au plancher 14
      bodyLarge: _body(18, FontWeight.w400, leadingNormal),
      bodyMedium: _body(16, FontWeight.w400, leadingNormal),
      bodySmall: _body(minBodySize, FontWeight.w400, leadingNormal),
      // labelLarge sert aux boutons · labelMedium à la barre de navigation
      labelLarge: _body(16, FontWeight.w600, leadingSnug),
      labelMedium: _body(14, FontWeight.w600, leadingSnug),
      labelSmall: _body(minLabelSize, FontWeight.w600, leadingSnug),
    );
    return theme.apply(bodyColor: onSurface, displayColor: onSurface);
  }
}
