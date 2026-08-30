import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_typography.dart';

/// The type scale.
///
/// The previous scale ran 32 / 26 / 21 / 18 / 16 — five sizes inside one
/// octave, all in the system sans. Steps that close read as "slightly
/// different" rather than as hierarchy, which is the mechanical reason every
/// screen in the app looked like every other screen.
///
/// This scale opens the top end (36pt display) and holds the bottom (12–15pt
/// UI). The wide headline-to-body ratio is what lets a screen be read at arm's
/// length before it is read at all — carried by weight and tracking on the
/// platform font, not by a display typeface.
///
/// Every name here existed before the redesign and still resolves, so screens
/// written against the old scale inherit the new one without being touched.
class AppTextStyles {
  AppTextStyles._();

  // ===== Display (system, heavy) =====
  // Reserved for the one thing a screen is about. If two of these appear on the
  // same screen, the screen is doing two jobs and should be split.

  /// Screen-defining statement. One per screen, at most.
  static TextStyle get h1 => AppTypography.display(
    size: 36,
    weight: 800,
    height: 1.02,
    letterSpacing: -1.4,
    color: AppColors.textPrimary,
  );

  /// Section opener on scrolling surfaces.
  static TextStyle get h2 => AppTypography.display(
    size: 28,
    weight: 800,
    height: 1.08,
    letterSpacing: -1.0,
    color: AppColors.textPrimary,
  );

  /// Card and sheet titles.
  static TextStyle get h3 => AppTypography.display(
    size: 22,
    weight: 700,
    height: 1.16,
    letterSpacing: -0.6,
    color: AppColors.textPrimary,
  );

  // ===== Structural headings =====

  /// App bar titles, sub-section headers.
  static TextStyle get h4 => AppTypography.ui(
    size: 18,
    weight: 700,
    height: 1.26,
    letterSpacing: -0.34,
    color: AppColors.textPrimary,
  );

  /// List group headers, dense card titles.
  static TextStyle get h5 => AppTypography.ui(
    size: 16,
    weight: 650,
    height: 1.3,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
  );

  // ===== Body =====

  static TextStyle get bodyLarge => AppTypography.ui(
    size: 15.5,
    weight: 400,
    height: 1.5,
    letterSpacing: -0.1,
    color: AppColors.textPrimary,
  );

  static TextStyle get bodyMedium => AppTypography.ui(
    size: 14,
    weight: 400,
    height: 1.5,
    letterSpacing: -0.05,
    color: AppColors.textPrimary,
  );

  static TextStyle get bodySmall => AppTypography.ui(
    size: 13,
    weight: 400,
    height: 1.45,
    color: AppColors.textSecondary,
  );

  static TextStyle get caption => AppTypography.ui(
    size: 12,
    weight: 500,
    height: 1.35,
    color: AppColors.textSecondary,
  );

  /// Eyebrow labels above sections. Set in caps at the call site — the wide
  /// tracking here only makes sense uppercase.
  static TextStyle get overline => AppTypography.ui(
    size: 11,
    weight: 700,
    height: 1.25,
    letterSpacing: 0.9,
    color: AppColors.textSecondary,
  );

  static TextStyle get label => AppTypography.ui(
    size: 14.5,
    weight: 600,
    height: 1.2,
    letterSpacing: -0.1,
    color: AppColors.textPrimary,
  );

  static TextStyle get input => AppTypography.ui(
    size: 15.5,
    weight: 450,
    height: 1.3,
    letterSpacing: -0.1,
    color: AppColors.textPrimary,
  );

  // ===== Quantities (system, tabular figures) =====
  // Money, measurements and counts are set in mono so that a column of prices
  // aligns on the digit. This is the detail that separates a tool from a form.

  /// Prices and totals inline in cards and rows.
  static TextStyle get price => AppTypography.mono(
    size: 21,
    weight: 700,
    height: 1.1,
    letterSpacing: -0.9,
    color: AppColors.textPrimary,
  );

  /// The headline number on a stat tile.
  static TextStyle get statValue => AppTypography.mono(
    size: 32,
    weight: 700,
    height: 1.0,
    letterSpacing: -1.6,
    color: AppColors.textPrimary,
  );

  /// Inline quantities inside a sentence or a dense row: "2,5 m", "J-3", "×4".
  static TextStyle get numeric => AppTypography.mono(
    size: 13,
    weight: 500,
    height: 1.3,
    letterSpacing: -0.3,
    color: AppColors.textPrimary,
  );

  /// Uppercase status and metadata tags: "EN COURS", "LIVRÉ", "REF-4471".
  static TextStyle get tag => AppTypography.mono(
    size: 10.5,
    weight: 600,
    height: 1.1,
    letterSpacing: 0.7,
    color: AppColors.textSecondary,
  );
}
