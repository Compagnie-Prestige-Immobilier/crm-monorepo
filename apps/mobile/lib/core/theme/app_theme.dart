import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'cpi_colors.dart';
import 'cpi_tokens.dart';
import 'cpi_typography.dart';

abstract final class AppTheme {
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

  static const Color _borderFlattened = Color(0xFFECE1E2);

  static ColorScheme get colorScheme {
    return ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.light).copyWith(
      primary: _primary,
      onPrimary: _onPrimary,
      primaryContainer: _primaryContainer,
      onPrimaryContainer: _onPrimaryContainer,

      secondary: _mutedForeground,
      onSecondary: const Color(0xFFFFFFFF),
      secondaryContainer: _muted,
      onSecondaryContainer: _mutedForeground,

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

  static const SystemUiOverlayStyle systemOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: _background,
    systemNavigationBarIconBrightness: Brightness.dark,
  );

  static const Color chuesSeed = Color(0xFF0B2E6F);

  static const Color _chuesBlue = Color(0xFF0B2E6F);
  static const Color _chuesBlack = Color(0xFF0B0D12);
  static const Color _chuesBackground = Color(0xFFF6F7FA);
  static const Color _chuesMuted = Color(0xFFE4E8F0);
  static const Color _chuesMutedForeground = Color(0xFF44506A);
  static const Color _chuesBorderFlattened = Color(0xFFDDE2EC);

  /// Union des Enseignants du Sénégal : le bleu porte les aplats, le noir le
  /// texte et la barre de navigation.
  static ColorScheme get chuesColorScheme {
    return ColorScheme.fromSeed(
      seedColor: chuesSeed,
      brightness: Brightness.light,
    ).copyWith(
      primary: _chuesBlue,
      onPrimary: _onPrimary,
      primaryContainer: const Color(0xFFE8ECF5),
      onPrimaryContainer: _chuesBlue,

      secondary: _chuesMutedForeground,
      onSecondary: const Color(0xFFFFFFFF),
      secondaryContainer: _chuesMuted,
      onSecondaryContainer: _chuesMutedForeground,

      tertiary: const Color(0xFF1D4ED8),
      onTertiary: const Color(0xFFFFFFFF),
      tertiaryContainer: const Color(0xFFE8EEFB),
      onTertiaryContainer: const Color(0xFF1D4ED8),

      error: _destructive,
      onError: const Color(0xFFFFFFFF),
      errorContainer: _destructiveSurface,
      onErrorContainer: _destructive,

      surface: _chuesBackground,
      onSurface: _chuesBlack,
      onSurfaceVariant: _chuesMutedForeground,
      surfaceContainerLowest: _card,
      surfaceContainerLow: _chuesBackground,
      surfaceContainer: const Color(0xFFEEF1F7),
      surfaceContainerHigh: _chuesMuted,
      surfaceContainerHighest: _chuesMuted,
      surfaceDim: _chuesMuted,
      surfaceBright: _card,
      surfaceTint: _chuesBlue,

      outline: _chuesMutedForeground,
      outlineVariant: _chuesBorderFlattened,

      inverseSurface: _chuesBlack,
      onInverseSurface: const Color(0xFFC3CFE6),
      inversePrimary: const Color(0xFF8FB8FF),

      shadow: _chuesBlack,
      scrim: _chuesBlack,
    );
  }

  static final ThemeData light = _build(colorScheme, CpiColors.light, systemOverlay);

  static final ThemeData chues = _build(
    chuesColorScheme,
    CpiColors.chues,
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: _chuesBackground,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  static ThemeData _build(
    ColorScheme scheme,
    CpiColors cpi,
    SystemUiOverlayStyle overlay,
  ) {
    final TextTheme text = CpiTypography.textTheme(scheme.onSurface);

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
      extensions: <ThemeExtension<dynamic>>[cpi, CpiMotion.standard],

      appBarTheme: AppBarTheme(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: overlay,
        titleTextStyle: text.titleMedium?.copyWith(color: scheme.onPrimary),
      ),

      cardTheme: CardThemeData(
        color: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
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
        style: IconButton.styleFrom(minimumSize: const Size.square(kCpiMinTouchTarget)),
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
        subtitleTextStyle: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brMd),
      ),

      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        indicatorColor: scheme.secondaryContainer,
        elevation: 0,
        height: 76,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith<TextStyle?>((
          Set<WidgetState> states,
        ) {
          final TextStyle base = text.labelMedium ?? const TextStyle(fontSize: 14);
          return states.contains(WidgetState.selected)
              ? base.copyWith(color: scheme.primary, fontWeight: FontWeight.w700)
              : base.copyWith(color: scheme.onSurfaceVariant);
        }),
        iconTheme: WidgetStateProperty.resolveWith<IconThemeData>((
          Set<WidgetState> states,
        ) {
          return IconThemeData(
            size: 26,
            color: states.contains(WidgetState.selected)
                ? scheme.primary
                : scheme.onSurfaceVariant,
          );
        }),
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
