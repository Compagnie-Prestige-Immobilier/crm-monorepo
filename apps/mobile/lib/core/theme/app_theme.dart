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
    return ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.light,
    ).copyWith(
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

  static const Color _primaryDark = Color(0xFFE3919A);
  static const Color _onPrimaryDark = Color(0xFF3D0009);
  static const Color _primaryContainerDark = Color(0xFF4A1119);
  static const Color _onPrimaryContainerDark = Color(0xFFF7D3D8);

  static const Color _mutedDark = Color(0xFF2E292C);
  static const Color _mutedForegroundDark = Color(0xFFB0A6A9);
  static const Color _outlineDark = Color(0xFF8A7F83);

  static const Color _backgroundDark = Color(0xFF141013);
  static const Color _foregroundDark = Color(0xFFEFECED);
  static const Color _cardDark = Color(0xFF211D20);

  static const Color _destructiveDark = Color(0xFFFF8D7E);
  static const Color _onDestructiveDark = Color(0xFF3F0A05);
  static const Color _destructiveSurfaceDark = Color(0xFF4A1710);

  /// Sur fond sombre la carte est PLUS CLAIRE que la page. Material nomme
  /// `surfaceContainerLowest` le conteneur le plus sombre ; le thème s'en sert
  /// partout comme « la carte », ce rôle prime sur la convention de nommage.
  static ColorScheme get darkColorScheme {
    return ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.dark,
    ).copyWith(
      primary: _primaryDark,
      onPrimary: _onPrimaryDark,
      primaryContainer: _primaryContainerDark,
      onPrimaryContainer: _onPrimaryContainerDark,

      secondary: _mutedForegroundDark,
      onSecondary: const Color(0xFF1C1416),
      secondaryContainer: _mutedDark,
      onSecondaryContainer: _mutedForegroundDark,

      tertiary: const Color(0xFFE8C069),
      onTertiary: const Color(0xFF2A1D00),
      tertiaryContainer: const Color(0xFF3A2E12),
      onTertiaryContainer: const Color(0xFFE8C069),

      error: _destructiveDark,
      onError: _onDestructiveDark,
      errorContainer: _destructiveSurfaceDark,
      onErrorContainer: _destructiveDark,

      surface: _backgroundDark,
      onSurface: _foregroundDark,
      onSurfaceVariant: _mutedForegroundDark,
      surfaceContainerLowest: _cardDark,
      surfaceContainerLow: const Color(0xFF1A1619),
      surfaceContainer: const Color(0xFF262124),
      surfaceContainerHigh: _mutedDark,
      surfaceContainerHighest: _mutedDark,
      surfaceDim: const Color(0xFF0E0B0D),
      surfaceBright: const Color(0xFF332D30),
      surfaceTint: _primaryDark,

      outline: _outlineDark,
      outlineVariant: _mutedDark,

      inverseSurface: _foregroundDark,
      onInverseSurface: _backgroundDark,
      inversePrimary: const Color(0xFF7A0714),

      shadow: const Color(0xFF000000),
      scrim: const Color(0xFF000000),
    );
  }

  static const SystemUiOverlayStyle systemOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: _background,
    systemNavigationBarIconBrightness: Brightness.dark,
  );

  /// Le bleu du logo CHUES, relevé sur `assets/brand/chues-logo.png` : c'est la
  /// teinte dominante du fichier, pas une interprétation.
  static const Color chuesSeed = Color(0xFF0201E9);

  static const Color _chuesBlue = Color(0xFF0201E9);

  /// Le même bleu assombri : il porte les rôles de TEXTE (accent, tertiaire) où
  /// #0201E9 tient déjà 9,6:1 sur blanc mais laisse trop peu d'écart avec les
  /// aplats de marque posés dessous.
  static const Color _chuesBlueDeep = Color(0xFF0201CB);
  static const Color _chuesBlack = Color(0xFF0B0D12);
  static const Color _chuesBackground = Color(0xFFF6F7FA);
  static const Color _chuesMuted = Color(0xFFE4E8F0);
  static const Color _chuesMutedForeground = Color(0xFF44506A);
  static const Color _chuesBorderFlattened = Color(0xFFDDE2EC);

  /// Union des Enseignants du Sénégal : le bleu porte les aplats, le noir le
  /// texte et la barre de navigation. Les surfaces restent le gris froid neutre
  /// — les teinter en bleu a été refusé.
  static ColorScheme get chuesColorScheme {
    return ColorScheme.fromSeed(
      seedColor: chuesSeed,
      brightness: Brightness.light,
    ).copyWith(
      primary: _chuesBlue,
      onPrimary: _onPrimary,
      primaryContainer: const Color(0xFFEFEFFF),
      onPrimaryContainer: _chuesBlue,

      secondary: _chuesMutedForeground,
      onSecondary: const Color(0xFFFFFFFF),
      secondaryContainer: _chuesMuted,
      onSecondaryContainer: _chuesMutedForeground,

      tertiary: _chuesBlueDeep,
      onTertiary: const Color(0xFFFFFFFF),
      tertiaryContainer: const Color(0xFFE6E6FF),
      onTertiaryContainer: _chuesBlueDeep,

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
      onInverseSurface: const Color(0xFFCDCDE4),
      inversePrimary: _chuesBlueDark,

      shadow: _chuesBlack,
      scrim: _chuesBlack,
    );
  }

  /// Le bleu du logo remonté en clarté jusqu'à passer 4,5:1 sur le fond sombre
  /// #101116 tout en gardant une encre lisible dessus (#0A0940, 7,4:1).
  static const Color _chuesBlueDark = Color(0xFF9A99FF);
  static const Color _onChuesBlueDark = Color(0xFF0A0940);
  static const Color _chuesBackgroundDark = Color(0xFF101116);
  static const Color _chuesForegroundDark = Color(0xFFECEEF2);
  static const Color _chuesCardDark = Color(0xFF1C1E25);
  static const Color _chuesMutedDark = Color(0xFF2B2F3A);
  static const Color _chuesMutedForegroundDark = Color(0xFFA6ACBA);
  static const Color _chuesOutlineDark = Color(0xFF7F8697);

  static ColorScheme get chuesDarkColorScheme {
    return ColorScheme.fromSeed(
      seedColor: chuesSeed,
      brightness: Brightness.dark,
    ).copyWith(
      primary: _chuesBlueDark,
      onPrimary: _onChuesBlueDark,
      primaryContainer: const Color(0xFF23225E),
      onPrimaryContainer: const Color(0xFFCFCEFF),

      secondary: _chuesMutedForegroundDark,
      onSecondary: const Color(0xFF12151C),
      secondaryContainer: const Color(0xFF282C36),
      onSecondaryContainer: _chuesMutedForegroundDark,

      tertiary: const Color(0xFF8B8AFF),
      onTertiary: _onChuesBlueDark,
      tertiaryContainer: const Color(0xFF1E1E4A),
      onTertiaryContainer: const Color(0xFFA5A4FF),

      error: _destructiveDark,
      onError: _onDestructiveDark,
      errorContainer: _destructiveSurfaceDark,
      onErrorContainer: _destructiveDark,

      surface: _chuesBackgroundDark,
      onSurface: _chuesForegroundDark,
      onSurfaceVariant: _chuesMutedForegroundDark,
      surfaceContainerLowest: _chuesCardDark,
      surfaceContainerLow: const Color(0xFF16181E),
      surfaceContainer: const Color(0xFF222530),
      surfaceContainerHigh: _chuesMutedDark,
      surfaceContainerHighest: _chuesMutedDark,
      surfaceDim: const Color(0xFF0B0C10),
      surfaceBright: const Color(0xFF31353F),
      surfaceTint: _chuesBlueDark,

      outline: _chuesOutlineDark,
      outlineVariant: _chuesMutedDark,

      inverseSurface: _chuesForegroundDark,
      onInverseSurface: _chuesBackgroundDark,
      inversePrimary: _chuesBlue,

      shadow: const Color(0xFF000000),
      scrim: const Color(0xFF000000),
    );
  }

  static const SystemUiOverlayStyle darkSystemOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: _backgroundDark,
    systemNavigationBarIconBrightness: Brightness.light,
  );

  static const SystemUiOverlayStyle chuesDarkSystemOverlay =
      SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: _chuesBackgroundDark,
        systemNavigationBarIconBrightness: Brightness.light,
      );

  /// Les mêmes thèmes, transitions de page coupées. Le thème ForUI est mémorisé
  /// par INSTANCE de [ThemeData] (`cpiForuiTheme`) : une variante figée doit
  /// donc être une instance stable, pas un `copyWith` reconstruit à chaque
  /// image.
  static final ThemeData lightStill = _build(
    colorScheme,
    CpiColors.light,
    systemOverlay,
    still: true,
  );

  static final ThemeData darkStill = _build(
    darkColorScheme,
    CpiColors.dark,
    darkSystemOverlay,
    still: true,
  );

  static final ThemeData chuesStill = _build(
    chuesColorScheme,
    CpiColors.chues,
    chuesSystemOverlay,
    still: true,
  );

  static final ThemeData chuesDarkStill = _build(
    chuesDarkColorScheme,
    CpiColors.chuesDark,
    chuesDarkSystemOverlay,
    still: true,
  );

  static final ThemeData light = _build(
    colorScheme,
    CpiColors.light,
    systemOverlay,
  );

  static const SystemUiOverlayStyle chuesSystemOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: _chuesBackground,
    systemNavigationBarIconBrightness: Brightness.dark,
  );

  static final ThemeData chues = _build(
    chuesColorScheme,
    CpiColors.chues,
    chuesSystemOverlay,
  );

  static final ThemeData dark = _build(
    darkColorScheme,
    CpiColors.dark,
    darkSystemOverlay,
  );

  static final ThemeData chuesDark = _build(
    chuesDarkColorScheme,
    CpiColors.chuesDark,
    chuesDarkSystemOverlay,
  );

  static ThemeData _build(
    ColorScheme scheme,
    CpiColors cpi,
    SystemUiOverlayStyle overlay, {
    bool still = false,
  }) {
    final TextTheme text = CpiTypography.textTheme(scheme.onSurface);

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: scheme.brightness,
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
          side: BorderSide(color: cpi.inputBorder),
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
          borderSide: BorderSide(color: cpi.inputBorder),
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
        side: BorderSide(color: cpi.inputBorder, width: 2),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onInverseSurface,
        ),
        behavior: SnackBarBehavior.floating,
        shape: const RoundedRectangleBorder(borderRadius: CpiRadius.brMd),
      ),

      listTileTheme: ListTileThemeData(
        minVerticalPadding: CpiSpacing.sm,
        iconColor: scheme.onSurfaceVariant,
        titleTextStyle: text.bodyLarge,
        subtitleTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
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
          final TextStyle base =
              text.labelMedium ?? const TextStyle(fontSize: 14);
          return states.contains(WidgetState.selected)
              ? base.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w700,
                )
              : base.copyWith(color: scheme.onSurfaceVariant);
        }),
        iconTheme: WidgetStateProperty.resolveWith<IconThemeData>((
          Set<WidgetState> states,
        ) {
          return IconThemeData(
            size: CpiIconSize.xl,
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

      // `refreshBackgroundColor` : le disque du « tirer pour rafraîchir » de six
      // écrans sortait blanc Material sur un fond sombre. Il n'y a pas de
      // `refreshIndicatorTheme` dans Flutter, c'est ici que ça se règle.
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHigh,
        refreshBackgroundColor: scheme.surfaceContainerLowest,
      ),

      pageTransitionsTheme: still ? _stillTransitions : _movingTransitions,
    );
  }

  static const PageTransitionsTheme _movingTransitions = PageTransitionsTheme(
    builders: <TargetPlatform, PageTransitionsBuilder>{
      TargetPlatform.android: CpiSharedAxisTransition(),
      TargetPlatform.iOS: CpiSharedAxisTransition(),
    },
  );

  static const PageTransitionsTheme _stillTransitions = PageTransitionsTheme(
    builders: <TargetPlatform, PageTransitionsBuilder>{
      TargetPlatform.android: CpiSharedAxisTransition(motion: CpiMotion.none),
      TargetPlatform.iOS: CpiSharedAxisTransition(motion: CpiMotion.none),
    },
  );
}

/// Axe partagé horizontal : l'écran entrant arrive de 6 % de sa largeur en
/// s'ouvrant, le sortant recule de 4 % en s'estompant à 60 %.
///
/// `FadeForwardsPageTransitionsBuilder` imposait 450 ms que « Réduire les
/// animations » ne coupait pas : sa durée est écrite dans le widget, hors de
/// portée du `MediaQuery`. La durée vient donc du jeton, et le thème `*Still`
/// la met à zéro.
class CpiSharedAxisTransition extends PageTransitionsBuilder {
  const CpiSharedAxisTransition({this.motion = CpiMotion.standard});

  final CpiMotion motion;

  @override
  Duration get transitionDuration => motion.screen;

  @override
  Duration get reverseTransitionDuration => motion.component;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (motion.screen == Duration.zero) return child;
    final Animatable<double> curve = CurveTween(curve: motion.easeOut);
    return SlideTransition(
      position: secondaryAnimation.drive(
        Tween<Offset>(
          begin: Offset.zero,
          end: const Offset(-0.04, 0),
        ).chain(curve),
      ),
      child: FadeTransition(
        opacity: secondaryAnimation.drive(
          Tween<double>(begin: 1, end: 0.6).chain(curve),
        ),
        child: SlideTransition(
          position: animation.drive(
            Tween<Offset>(
              begin: const Offset(0.06, 0),
              end: Offset.zero,
            ).chain(curve),
          ),
          child: FadeTransition(opacity: animation.drive(curve), child: child),
        ),
      ),
    );
  }
}
