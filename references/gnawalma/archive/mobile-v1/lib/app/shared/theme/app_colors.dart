import 'package:flutter/material.dart';

import '../../data/services/app_space.dart';

/// Gnawalma visual palette — "Atelier Ink".
///
/// White page, ink type, one accent. Primary actions are near-black rather than
/// a brand hue, which is what the whole reference set does — Uber, Wise,
/// Airbnb, Shop all ship a black CTA on white. Saturated colour is spent only
/// on status and on the single blue accent.
///
/// Every name in this class predates the redesign and is still honoured, so
/// screens that were written against the old palette shift automatically.
class AppColors {
  AppColors._();

  // ===== Brand =====
  // Primary is ink, not a hue. Filled buttons, focus rings and progress all
  // resolve to near-black, which is what gives the product its editorial feel.
  static const Color primary = Color(0xFF0A0A0A);
  static const Color primaryLight = Color(0xFFF4F4F5);
  static const Color primaryDark = Color(0xFF000000);
  static const Color brandInk = Color(0xFF0A0A0A);

  // ===== Accent — the only saturated colour, and the only thing that differs
  // between the two spaces =====
  //
  // The neutral base above is identical on both sides; it is what occupies the
  // page. The accent is the 10%, and it is the sole carrier of space identity:
  // orange for client discovery, blue for atelier action. If it appears more
  // than twice on a screen, something is wrong.
  //
  // Screens must not read these constants directly — use
  // `context.accentColor`, which resolves through the shell's own theme. A
  // literal here is how the client space ends up wearing the atelier's blue.

  /// Client discovery accent.
  ///
  /// Darkened from the LIC brand orange `#E64922`, which is 3.93:1 on white —
  /// it fails AA both as a button fill under white text and as text on white.
  /// This holds 4.84:1 in both directions.
  static const Color clientAccent = Color(0xFFCF3D19);
  static const Color clientAccentPressed = Color(0xFFA82F12);
  static const Color clientAccentSoft = Color(0xFFFCEEEA);

  /// Lifted for the dark page, where [clientAccent] falls to 4.34:1 on #0A0A0A.
  /// 7.69:1 there, and 8.16:1 under black text when used as a fill.
  static const Color clientAccentOnDark = Color(0xFFFF7A52);

  /// Atelier action accent. LIC blue. 5.15:1 on white, both directions.
  static const Color atelierAccent = Color(0xFF1171B8);
  static const Color atelierAccentPressed = Color(0xFF0D5A94);
  static const Color atelierAccentSoft = Color(0xFFEAF2F9);

  /// Lifted for the dark page. 7.63:1 on #0A0A0A.
  static const Color atelierAccentOnDark = Color(0xFF5AA7E5);

  /// The LIC brand orange.
  ///
  /// Brand assets only — splash, logo, communication. 3.93:1 on white, so it
  /// can be neither a button fill nor a text colour. [clientAccent] is the
  /// interface-safe form.
  static const Color brandOrange = Color(0xFFE64922);

  /// Space-neutral fallback, used before a shell has established its theme
  /// (splash, space selector, auth). Resolves to the atelier blue.
  static const Color accent = atelierAccent;
  static const Color accentLight = atelierAccentSoft;
  static const Color accentDark = atelierAccentPressed;

  // ===== Neutral work surfaces =====
  // Pure white page, pure white cards. Separation comes from hairline rules and
  // spacing, not from floating a lighter box on a grey field — that grey-behind-
  // white-card pattern is the default every admin template ships with.
  //
  // Only sunken elements (input fields, inactive segments) take a fill, and it
  // is a true neutral. Tinted "warm" greys read as a rendering fault next to
  // white far more often than they read as a choice.
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFFF4F4F5);
  static const Color surfaceRaised = Color(0xFFFAFAFA);

  static const Color midnight = Color(0xFF0A0A0A);
  static const Color slate = Color(0xFF71717A);
  static const Color textPrimary = midnight;
  static const Color textSecondary = slate;
  static const Color textHint = Color(0xFFA1A1AA);
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // ===== Status =====
  static const Color success = Color(0xFF1F7A5C);
  static const Color successSoft = Color(0xFFE4F2EC);

  /// Darkened from #B0730A, which was 3.96:1 on white and therefore failed as
  /// the small caption text it is actually used for ("À ENCAISSER", "Stock
  /// faible"). Now 5.93:1.
  static const Color warning = Color(0xFF8A5A00);
  static const Color warningSoft = Color(0xFFFBF0DC);
  static const Color error = Color(0xFFB3372B);
  static const Color errorSoft = Color(0xFFF9E9E6);
  static const Color info = Color(0xFF3F4A6B);
  static const Color infoSoft = Color(0xFFEBEDF3);

  /// The neutral status ink.
  ///
  /// [slate] is 4.83:1 on pure white, which falls under 4.5 the moment it sits
  /// on a status banner's own tinted fill — the one place a neutral label is
  /// always used. This holds 4.85:1 there and 5.27:1 on white.
  static const Color neutralInk = Color(0xFF6B6B75);

  // ===== Project status =====
  //
  // Status hues are shared by both spaces and must not reuse either space
  // accent. A status that borrows the accent means "in progress" and "this tab
  // is selected" render identically, and the same list reads differently
  // depending on which space you opened it from.
  /// Darkened from #A1A1AA, which was 2.56:1 on white — barely visible as the
  /// status label it carries. Now 5.27:1.
  static const Color statusTodo = neutralInk;

  /// Teal, not the accent this replaced. It was `accent`, so on the atelier
  /// side every in-progress row wore the exact blue of the active tab. 6.05:1
  /// on white.
  static const Color statusInProgress = Color(0xFF0E6E6E);
  static const Color statusCompleted = success;
  static const Color statusDelivered = Color(0xFF4C4779);

  /// Fill behind a table header or a total block on a printed document.
  ///
  /// Documents are the one surface that is not theme-aware: an invoice is
  /// rendered to PDF and printed on white paper, so it keeps light values in
  /// both themes. This replaces two near-identical greys (`#F4F6F8`,
  /// `#F8F9FB`) that were written inline in two invoice widgets.
  static const Color documentSurface = Color(0xFFF4F6F8);

  /// Scrim laid over a photograph so white text stays legible on it.
  ///
  /// Fixed black rather than a theme colour: it sits on the image, not on the
  /// page, and the image does not change with the theme.
  static const Color photoScrim = Color(0x8C000000);
  static const Color photoScrimTransparent = Color(0x00000000);

  // ===== Structure =====
  // On a white page the rule *is* the structure, so it has to be visible enough
  // to read as a deliberate line rather than a rendering artefact.
  static const Color divider = Color(0xFFF0F0F1);
  static const Color border = Color(0xFFE4E4E7);
  static const Color borderLight = Color(0xFFF4F4F5);

  // ===== Dark theme =====
  // True black, not charcoal. On the OLED panels most of these phones ship with,
  // #000 switches pixels off — the page edge disappears and content floats.
  // Charcoal is what you pick when you are afraid of committing.
  static const Color darkBackground = Color(0xFF000000);
  static const Color darkSurface = Color(0xFF0F0F10);
  static const Color darkSurfaceLight = Color(0xFF1C1C1F);
  static const Color darkTextPrimary = Color(0xFFFAFAFA);
  static const Color darkTextSecondary = Color(0xFFA1A1AA);
  static const Color darkBorder = Color(0xFF27272A);

  // ===== Elevation =====
  //
  // One shadow, and only for things that genuinely float above the page:
  // sheets, overlays, sticky action bars. A standard card gets a hairline
  // border and nothing else — `knowledge-base/DESIGN.md`.
  //
  // `cardShadow` and `cardShadowDark` used to live here, which meant any card
  // could opt into looking raised. Big soft drop shadows under static content
  // are the fastest way to make a mobile app look like a 2016 web dashboard.
  static List<BoxShadow> get floatingShadow => [
    BoxShadow(
      color: const Color(0xFF000000).withValues(alpha: 0.14),
      blurRadius: 24,
      offset: const Offset(0, 10),
      spreadRadius: -6,
    ),
  ];
}

/// How a space resolves to colour.
///
/// The only thing that differs between the two spaces: which hue the primary
/// action, the active tab, the focus ring and the selected state wear.
extension AppSpaceColors on AppSpace {
  /// Accent for this space at the given brightness.
  Color accent({required bool isDark}) => switch (this) {
    AppSpace.client =>
      isDark ? AppColors.clientAccentOnDark : AppColors.clientAccent,
    AppSpace.atelier =>
      isDark ? AppColors.atelierAccentOnDark : AppColors.atelierAccent,
  };

  /// Pressed state, and the readable ink for text sitting on [accentSoft].
  Color accentPressed({required bool isDark}) => switch (this) {
    AppSpace.client =>
      isDark ? AppColors.clientAccent : AppColors.clientAccentPressed,
    AppSpace.atelier =>
      isDark ? AppColors.atelierAccent : AppColors.atelierAccentPressed,
  };

  /// Wash behind a selected chip or an accent-tinted row.
  ///
  /// On the dark page the light washes read as a bright rectangle, so the
  /// accent is dropped to a low alpha over the surface instead.
  Color accentSoft({required bool isDark}) {
    if (isDark) return accent(isDark: true).withValues(alpha: 0.20);
    return switch (this) {
      AppSpace.client => AppColors.clientAccentSoft,
      AppSpace.atelier => AppColors.atelierAccentSoft,
    };
  }

  /// Text and icons sitting directly on [accent].
  ///
  /// White on the light page, black on the dark one — the dark-mode accents
  /// are lifted far enough that white on them falls below AA.
  Color onAccent({required bool isDark}) =>
      isDark ? AppColors.darkBackground : AppColors.textOnPrimary;
}
