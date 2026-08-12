import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'cpi_colors.dart';
import 'cpi_tokens.dart';
import 'cpi_typography.dart';

/// Thème Material 3 de CPI GO.
///
/// **Un seul thème.** L'app est verrouillée en clair (docs/design.md §3) : elle
/// s'utilise dehors, en plein soleil, où le mode sombre réduit la lisibilité.
/// `MaterialApp.darkTheme` n'est pas fourni et `themeMode` reste
/// [ThemeMode.light] — suivre le thème système serait une régression.
abstract final class AppTheme {
  /// Graine de la palette. Elle ne sert que de **point de départ** : l'algorithme
  /// Material dérive des rôles qui ne correspondent pas aux valeurs auditées, et
  /// tous les rôles critiques sont écrasés juste après (docs/design.md §10).
  static const Color seed = Color(0xFF630210);

  static const Color _primary = Color(0xFF630210);
  static const Color _onPrimary = Color(0xFFFFFFFF);
  static const Color _primaryContainer = Color(0xFFF5ECEE);
  static const Color _onPrimaryContainer = Color(0xFF630210);

  static const Color _muted = Color(0xFFEDE4E6);
  static const Color _mutedForeground = Color(0xFF6B4A52);

  static const Color _background = Color(0xFFFAF7F7);
  static const Color _foreground = Color(0xFF1C0810);
  static const Color _card = Color(0xFFFFFFFF);

  static const Color _destructive = Color(0xFFB91C1C);
  static const Color _destructiveSurface = Color(0xFFF8E8E8);

  /// `border: rgba(99,2,16,0.12)` aplati sur blanc. Material a besoin d'une
  /// couleur opaque pour `outlineVariant`, l'alpha ne survit pas aux bordures
  /// composées.
  static const Color _borderFlattened = Color(0xFFECE1E2);

  static ColorScheme get colorScheme {
    // `fromSeed` d'abord — il remplit correctement les rôles secondaires et les
    // niveaux `surfaceDim`/`surfaceBright` qu'on ne veut pas écrire à la main —
    // puis on écrase tout ce que docs/design.md fixe explicitement.
    return ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.light,
    ).copyWith(
      primary: _primary,
      onPrimary: _onPrimary,
      primaryContainer: _primaryContainer,
      onPrimaryContainer: _onPrimaryContainer,

      // `secondary` Material = composants de moindre emphase. C'est exactement
      // le rôle des tokens `muted` / `muted-foreground`.
      secondary: _mutedForeground,
      onSecondary: const Color(0xFFFFFFFF),
      secondaryContainer: _muted,
      onSecondaryContainer: _mutedForeground,

      // `tertiary` = l'or. On y met `accent-text` (#856011, 5,71:1) et JAMAIS
      // #C8921A : Material se sert de `tertiary` comme couleur de texte dans
      // plusieurs composants, et #C8921A y échouerait AA (2,77:1).
      tertiary: const Color(0xFF856011),
      onTertiary: const Color(0xFFFFFFFF),
      tertiaryContainer: const Color(0xFFFAF4E8),
      onTertiaryContainer: const Color(0xFF856011),

      error: _destructive,
      onError: const Color(0xFFFFFFFF),
      errorContainer: _destructiveSurface,
      onErrorContainer: _destructive,

      surface: _background,
      onSurface: _foreground,
      onSurfaceVariant: _mutedForeground,
      surfaceContainerLowest: _card,
      surfaceContainerLow: _background,
      surfaceContainer: const Color(0xFFF5ECEE),
      surfaceContainerHigh: _muted,
      surfaceContainerHighest: _muted,
      surfaceDim: _muted,
      surfaceBright: _card,
      surfaceTint: _primary,

      outline: _mutedForeground,
      outlineVariant: _borderFlattened,

      inverseSurface: const Color(0xFF3A010A),
      onInverseSurface: const Color(0xFFDFC0C8),
      inversePrimary: const Color(0xFFC4566B),

      shadow: _foreground,
      scrim: _foreground,
    );
  }

  /// Style de la barre système au-dessus de l'AppBar bordeaux.
  static const SystemUiOverlayStyle systemOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: _background,
    systemNavigationBarIconBrightness: Brightness.dark,
  );

  static ThemeData get light {
    final ColorScheme scheme = colorScheme;
    final TextTheme text = CpiTypography.textTheme(scheme.onSurface);
    const CpiColors cpi = CpiColors.light;

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: Brightness.light,
      scaffoldBackgroundColor: scheme.surface,
      canvasColor: scheme.surface,
      textTheme: text,
      fontFamily: CpiFonts.body,
      splashFactory: InkSparkle.splashFactory,
      visualDensity: VisualDensity.standard,
      extensions: const <ThemeExtension<dynamic>>[cpi, CpiMotion.standard],

      appBarTheme: AppBarTheme(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: systemOverlay,
        titleTextStyle: text.titleMedium?.copyWith(color: scheme.onPrimary),
      ),

      cardTheme: CardThemeData(
        color: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        // Aucune élévation Material : l'ombre est portée par le conteneur, ce
        // qui laisse le contrôle du budget de rendu dans les listes.
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: CpiRadius.brLg,
          side: BorderSide(color: cpi.borderSubtle),
        ),
      ),

      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size(double.infinity, kCpiMinTouchTarget + 8),
          padding: const EdgeInsets.symmetric(
            horizontal: CpiSpacing.xl,
            vertical: CpiSpacing.md,
          ),
          textStyle: text.labelLarge,
          shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brMd),
          elevation: 0,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.primary,
          minimumSize: const Size(0, kCpiMinTouchTarget),
          side: BorderSide(color: cpi.borderSubtle),
          textStyle: text.labelLarge,
          shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brMd),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: scheme.primary,
          minimumSize: const Size(0, kCpiMinTouchTarget),
          textStyle: text.labelLarge,
          shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brSm),
        ),
      ),

      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size.square(kCpiMinTouchTarget),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cpi.inputBackground,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: CpiSpacing.md,
          vertical: CpiSpacing.md,
        ),
        hintStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        labelStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        border: const OutlineInputBorder(
          borderRadius: CpiRadius.brMd,
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: CpiRadius.brMd,
          borderSide: BorderSide(color: cpi.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: CpiRadius.brMd,
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: CpiRadius.brMd,
          borderSide: BorderSide(color: scheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: CpiRadius.brMd,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
      ),

      checkboxTheme: CheckboxThemeData(
        shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brXs),
        side: BorderSide(color: cpi.borderSubtle, width: 2),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: text.bodyMedium?.copyWith(color: scheme.onInverseSurface),
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brMd),
      ),

      listTileTheme: ListTileThemeData(
        minVerticalPadding: CpiSpacing.sm,
        iconColor: scheme.onSurfaceVariant,
        titleTextStyle: text.bodyLarge,
        subtitleTextStyle: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
        shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brMd),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainer,
        side: BorderSide(color: cpi.borderSubtle),
        labelStyle: text.labelMedium,
        shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brFull),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHigh,
      ),

      pageTransitionsTheme: const PageTransitionsTheme(
        builders: <TargetPlatform, PageTransitionsBuilder>{
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        },
      ),
    );
  }
}
