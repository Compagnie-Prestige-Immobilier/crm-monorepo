import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../data/services/app_space.dart';
import 'app_colors.dart';
import 'app_motion.dart';
import 'app_spacing.dart';
import 'app_text_styles.dart';

/// The theme is the redesign.
///
/// Almost every screen in this app renders through Material components, so the
/// component themes below are what actually change how the product looks. The
/// per-screen work that follows is layout and hierarchy; the *finish* — type,
/// radius, weight, colour, motion — is decided once, here.
class AppTheme {
  AppTheme._();

  /// Root themes. Used before a shell has been entered — splash, onboarding,
  /// space selector, auth — where no space has been chosen yet.
  static ThemeData get lightTheme => _build(Brightness.light, AppSpace.atelier);
  static ThemeData get darkTheme => _build(Brightness.dark, AppSpace.atelier);

  /// The theme a shell installs over its own subtree.
  ///
  /// Everything but the accent is identical between the two; see [AppSpace].
  static ThemeData forSpace(AppSpace space, Brightness brightness) =>
      _build(brightness, space);

  static ThemeData _build(Brightness brightness, AppSpace space) {
    final isDark = brightness == Brightness.dark;
    final background = isDark ? AppColors.darkBackground : AppColors.background;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final surfaceSunken = isDark
        ? AppColors.darkSurfaceLight
        : AppColors.surfaceDark;
    final textPrimary = isDark
        ? AppColors.darkTextPrimary
        : AppColors.textPrimary;
    final textSecondary = isDark
        ? AppColors.darkTextSecondary
        : AppColors.textSecondary;
    final border = isDark ? AppColors.darkBorder : AppColors.border;

    // The primary action wears the space accent — orange in the client space,
    // blue in the atelier. It used to be ink on both sides, which is why the
    // two spaces were indistinguishable at the token level: the accent existed
    // but nothing load-bearing ever wore it.
    //
    // The accent already carries its own dark-mode lift, so unlike ink it does
    // not need inverting here.
    final actionColor = space.accent(isDark: isDark);
    final onAction = space.onAccent(isDark: isDark);

    // Ink is still the *type* colour and still the correct fill for a
    // secondary, non-branded surface. It just no longer stands in for a brand.
    final inkAction = isDark ? AppColors.darkTextPrimary : AppColors.primary;

    final scheme =
        ColorScheme.fromSeed(
          seedColor: actionColor,
          brightness: brightness,
          primary: actionColor,
          onPrimary: onAction,
          secondary: inkAction,
          surface: surface,
          error: AppColors.error,
        ).copyWith(
          onSurface: textPrimary,
          onSurfaceVariant: textSecondary,
          // The M3 "tinted tile" pair, which every selected chip and tonal button
          // resolves to. Bound to the space accent's own wash rather than left to
          // the seed, so a selected chip is the same hue as the button above it.
          //
          // The foreground is the *pressed* accent, not the accent: the accent on
          // its own wash is roughly 1.3:1.
          primaryContainer: space.accentSoft(isDark: isDark),
          onPrimaryContainer: space.accentPressed(isDark: isDark),
          // Ink keeps its own neutral pair, for surfaces that should read as
          // structure rather than as a branded action.
          secondaryContainer: Color.alphaBlend(
            inkAction.withValues(alpha: isDark ? 0.16 : 0.07),
            surface,
          ),
          onSecondaryContainer: textPrimary,
          surfaceContainerLowest: surface,
          surfaceContainerLow: isDark
              ? AppColors.darkSurface
              : AppColors.surfaceRaised,
          surfaceContainer: surfaceSunken,
          surfaceContainerHighest: surfaceSunken,
          outline: border,
          outlineVariant: border.withValues(alpha: 0.6),
        );

    TextStyle tint(TextStyle style, {bool secondary = false}) =>
        style.copyWith(color: secondary ? textSecondary : textPrimary);

    final baseTextTheme = TextTheme(
      displayLarge: tint(AppTextStyles.h1),
      displayMedium: tint(AppTextStyles.h2),
      displaySmall: tint(AppTextStyles.h3),
      headlineLarge: tint(AppTextStyles.h2),
      headlineMedium: tint(AppTextStyles.h4),
      headlineSmall: tint(AppTextStyles.h5),
      titleLarge: tint(AppTextStyles.h4),
      titleMedium: tint(AppTextStyles.h5),
      titleSmall: tint(AppTextStyles.label),
      bodyLarge: tint(AppTextStyles.bodyLarge),
      bodyMedium: tint(AppTextStyles.bodyMedium),
      bodySmall: tint(AppTextStyles.bodySmall, secondary: true),
      labelLarge: tint(AppTextStyles.label),
      labelMedium: tint(AppTextStyles.caption, secondary: true),
      labelSmall: tint(AppTextStyles.overline, secondary: true),
    );

    // Every action control shares one shape. Buttons used to be pills while
    // bespoke CTAs were soft rectangles, so the same role changed shape from
    // screen to screen; this is the single definition both now resolve to.
    final actionShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      // System font throughout — no fontFamily override.
      // Material's ink ripple is an Android signature. A soft fade reads as
      // neutral on both platforms and is what the reference apps use.
      splashFactory: InkSparkle.constantTurbulenceSeedSplashFactory,
      visualDensity: VisualDensity.standard,
      textTheme: baseTextTheme,
      primaryTextTheme: baseTextTheme,

      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: background,
        foregroundColor: textPrimary,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        titleTextStyle: AppTextStyles.h4.copyWith(color: textPrimary),
        toolbarHeight: 56,
        iconTheme: IconThemeData(color: textPrimary, size: 22),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
        ),
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: actionColor,
          foregroundColor: onAction,
          minimumSize: const Size(48, AppSpacing.buttonHeightLG),
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          shape: actionShape,
          elevation: 0,
          textStyle: AppTextStyles.label.copyWith(fontSize: 15.5),
          disabledBackgroundColor: border.withValues(alpha: 0.5),
          disabledForegroundColor: textSecondary.withValues(alpha: 0.7),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: actionColor,
          foregroundColor: onAction,
          minimumSize: const Size(48, AppSpacing.buttonHeightLG),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          shape: actionShape,
          textStyle: AppTextStyles.label.copyWith(fontSize: 15.5),
          disabledBackgroundColor: border.withValues(alpha: 0.5),
          disabledForegroundColor: textSecondary.withValues(alpha: 0.7),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: textPrimary,
          minimumSize: const Size(48, AppSpacing.buttonHeightLG),
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          side: BorderSide(color: border, width: 1.3),
          shape: actionShape,
          textStyle: AppTextStyles.label.copyWith(fontSize: 15.5),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: textPrimary,
          minimumSize: const Size(48, 44),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          shape: actionShape,
          textStyle: AppTextStyles.label,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: textPrimary,
          // 48dp meets the Android minimum even though the glyph is 22.
          minimumSize: const Size(48, 48),
          iconSize: 22,
          shape: const CircleBorder(),
        ),
      ),

      // Fields sit on a sunken neutral surface with no border until focus, so a
      // form reads as a set of slots rather than a stack of outlined boxes.
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceSunken,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 18,
        ),
        hintStyle: AppTextStyles.input.copyWith(
          color: textSecondary.withValues(alpha: 0.75),
        ),
        labelStyle: AppTextStyles.bodyMedium.copyWith(color: textSecondary),
        floatingLabelStyle: AppTextStyles.overline.copyWith(
          color: textSecondary,
        ),
        prefixIconColor: textSecondary,
        suffixIconColor: textSecondary,
        border: _fieldBorder(BorderSide.none),
        enabledBorder: _fieldBorder(BorderSide.none),
        focusedBorder: _fieldBorder(BorderSide(color: actionColor, width: 1.8)),
        errorBorder: _fieldBorder(
          const BorderSide(color: AppColors.error, width: 1.3),
        ),
        focusedErrorBorder: _fieldBorder(
          const BorderSide(color: AppColors.error, width: 1.8),
        ),
        disabledBorder: _fieldBorder(BorderSide.none),
        errorStyle: AppTextStyles.caption.copyWith(color: AppColors.error),
      ),

      // Fallback only — both shells render AppNavBar. Kept aligned to it so a
      // stray Material NavigationBar does not stand out: same height, no tinted
      // pill indicator, labels always visible, accent on the selected item.
      navigationBarTheme: NavigationBarThemeData(
        height: 64,
        elevation: 0,
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            size: 24,
            color: states.contains(WidgetState.selected)
                ? actionColor
                : textSecondary,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => AppTextStyles.caption.copyWith(
            color: states.contains(WidgetState.selected)
                ? actionColor
                : textSecondary,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
          ),
        ),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        modalBackgroundColor: surface,
        // 52% scrim: strong enough to isolate the sheet, short of the muddy
        // full-black that makes a modal feel like an error state.
        modalBarrierColor: const Color(0xFF000000).withValues(alpha: 0.55),
        showDragHandle: true,
        dragHandleColor: border,
        dragHandleSize: const Size(38, 4),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radiusSheet),
          ),
        ),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: AppTextStyles.h3.copyWith(color: textPrimary),
        contentTextStyle: AppTextStyles.bodyLarge.copyWith(
          color: textSecondary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
        ),
      ),

      // The label colour has to be state-resolved, not fixed. A flat
      // `labelStyle` painted ink on a chip whose selected fill is *also* ink
      // rendered every selected chip as a black slab with an invisible label —
      // 1:1 contrast, on every filter row in the app. `RawChip` resolves
      // `labelStyle.color` as a `WidgetStateProperty`, so the inversion belongs
      // here rather than at each call site.
      chipTheme: ChipThemeData(
        backgroundColor: surfaceSunken,
        selectedColor: actionColor,
        checkmarkColor: onAction,
        disabledColor: border.withValues(alpha: 0.3),
        side: BorderSide.none,
        showCheckmark: false,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        labelStyle: AppTextStyles.label.copyWith(
          fontSize: 13.5,
          color: _chipLabelColor(
            selected: onAction,
            unselected: textPrimary,
            disabled: textSecondary.withValues(alpha: 0.6),
          ),
        ),
        secondaryLabelStyle: AppTextStyles.label.copyWith(
          fontSize: 13.5,
          color: _chipLabelColor(
            selected: onAction,
            unselected: textPrimary,
            disabled: textSecondary.withValues(alpha: 0.6),
          ),
        ),
        iconTheme: IconThemeData(color: textSecondary, size: 18),
      ),

      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
        minTileHeight: 60,
        iconColor: textSecondary,
        titleTextStyle: AppTextStyles.label.copyWith(color: textPrimary),
        subtitleTextStyle: AppTextStyles.bodySmall.copyWith(
          color: textSecondary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        ),
      ),

      dividerTheme: DividerThemeData(
        color: isDark ? border.withValues(alpha: 0.8) : AppColors.divider,
        thickness: 1,
        space: 1,
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark
            ? AppColors.darkTextPrimary
            : AppColors.midnight,
        contentTextStyle: AppTextStyles.bodyMedium.copyWith(
          color: isDark ? AppColors.midnight : AppColors.textOnPrimary,
          fontWeight: FontWeight.w500,
        ),
        // The snackbar surface is inverted relative to the page, so the accent
        // has to be taken from the *opposite* brightness or it lands at 4.3:1
        // on near-black.
        actionTextColor: space.accent(isDark: !isDark),
        insetPadding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        ),
      ),

      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: actionColor,
        linearTrackColor: border.withValues(alpha: 0.5),
        circularTrackColor: Colors.transparent,
        strokeCap: StrokeCap.round,
        strokeWidth: 2.6,
      ),

      floatingActionButtonTheme: FloatingActionButtonThemeData(
        elevation: 0,
        focusElevation: 0,
        hoverElevation: 0,
        highlightElevation: 0,
        backgroundColor: actionColor,
        foregroundColor: onAction,
        extendedTextStyle: AppTextStyles.label.copyWith(color: onAction),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
        ),
      ),

      searchBarTheme: SearchBarThemeData(
        elevation: const WidgetStatePropertyAll(0),
        backgroundColor: WidgetStatePropertyAll(surfaceSunken),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
        side: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.focused)
              ? BorderSide(color: actionColor, width: 1.6)
              : BorderSide.none,
        ),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          ),
        ),
        textStyle: WidgetStatePropertyAll(
          AppTextStyles.input.copyWith(color: textPrimary),
        ),
        hintStyle: WidgetStatePropertyAll(
          AppTextStyles.input.copyWith(color: textSecondary),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 18),
        ),
      ),

      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(48, 46)),
          visualDensity: VisualDensity.standard,
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          ),
          side: const WidgetStatePropertyAll(BorderSide.none),
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? actionColor
                : Colors.transparent,
          ),
          foregroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? onAction
                : textSecondary,
          ),
          textStyle: WidgetStatePropertyAll(AppTextStyles.label),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.buttonRadius),
            ),
          ),
        ),
      ),

      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusXS + 2),
        ),
        side: BorderSide(color: border, width: 1.6),
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? actionColor
              : Colors.transparent,
        ),
        checkColor: WidgetStatePropertyAll(onAction),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? actionColor
              : textSecondary,
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? onAction
              : (isDark ? textSecondary : AppColors.surface),
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? actionColor : border,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),

      tabBarTheme: TabBarThemeData(
        dividerColor: Colors.transparent,
        indicatorColor: actionColor,
        indicatorSize: TabBarIndicatorSize.label,
        labelColor: textPrimary,
        unselectedLabelColor: textSecondary,
        labelStyle: AppTextStyles.label,
        unselectedLabelStyle: AppTextStyles.label.copyWith(
          fontWeight: FontWeight.w500,
        ),
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      ),

      badgeTheme: BadgeThemeData(
        backgroundColor: actionColor,
        textColor: onAction,
        textStyle: AppTextStyles.tag.copyWith(color: onAction, fontSize: 10),
      ),

      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkTextPrimary : AppColors.midnight,
          borderRadius: BorderRadius.circular(AppSpacing.radiusSM + 2),
        ),
        textStyle: AppTextStyles.bodySmall.copyWith(
          color: isDark ? AppColors.midnight : AppColors.textOnPrimary,
        ),
        waitDuration: const Duration(milliseconds: 450),
      ),

      popupMenuTheme: PopupMenuThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
          side: BorderSide(color: border),
        ),
        textStyle: AppTextStyles.bodyMedium.copyWith(color: textPrimary),
      ),

      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        },
      ),

      extensions: const <ThemeExtension<dynamic>>[],
    );
  }

  /// Chip labels invert on selection. Returned as a [WidgetStateColor] so
  /// `RawChip` can resolve it against the chip's own states.
  static WidgetStateColor _chipLabelColor({
    required Color selected,
    required Color unselected,
    required Color disabled,
  }) {
    return WidgetStateColor.resolveWith((states) {
      if (states.contains(WidgetState.disabled)) return disabled;
      if (states.contains(WidgetState.selected)) return selected;
      return unselected;
    });
  }

  static OutlineInputBorder _fieldBorder(BorderSide side) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
    borderSide: side,
  );

  /// Re-exported so screens can reach motion tokens from the theme import they
  /// already have, instead of adding a second import for two constants.
  static const Duration quick = AppMotion.quick;
  static const Duration standard = AppMotion.standard;
}
