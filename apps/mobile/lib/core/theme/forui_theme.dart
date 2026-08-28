import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:forui/forui.dart';

import 'cpi_colors.dart';
import 'cpi_tokens.dart';
import 'cpi_typography.dart';

/// Traduit le thème Material de CPI en `FThemeData` : les couleurs, la
/// typographie et les rayons restent ceux de `AppTheme`/`CpiColors`/`CpiRadius`,
/// ForUI ne fait que les consommer.
///
/// Le résultat est mémorisé par instance de [ThemeData] : `AppTheme.light`,
/// `AppTheme.dark`, `AppTheme.chues` et `AppTheme.chuesDark` sont des instances
/// stables, la table ne compte donc que quelques entrées.
FThemeData cpiForuiTheme(ThemeData theme, {bool reduceMotion = false}) =>
    reduceMotion
    ? (_still[theme] ??= _build(theme, true))
    : (_moving[theme] ??= _build(theme, false));

final Expando<FThemeData> _still = Expando<FThemeData>('forui-still');
final Expando<FThemeData> _moving = Expando<FThemeData>('forui-moving');

/// Hauteurs des contrôles. `kCpiMinTouchTarget` (48) reste le plancher WCAG
/// 2.5.8 ; CPI GO vise au-dessus parce qu'on l'utilise debout, au soleil, à une
/// main, souvent avec des gants.
const double kCpiButtonHeight = 56;

/// Plancher d'une ligne de liste, prefixe et suffixe compris.
const double kCpiRowMinHeight = 60;

/// Côté d'une action de bandeau (`CpiHeaderAction`, `CpiBackButton`).
const double kCpiHeaderActionSize = 52;

const FBorderRadius _radius = FBorderRadius(
  xs2: CpiRadius.brXs,
  xs: CpiRadius.brXs,
  sm: CpiRadius.brSm,
  md: CpiRadius.brMd,
  lg: CpiRadius.brLg,
  xl: CpiRadius.brXl,
  xl2: CpiRadius.brXxl,
  xl3: CpiRadius.brXxl,
  pill: CpiRadius.brFull,
);

FThemeData _build(ThemeData theme, bool reduceMotion) {
  final ColorScheme scheme = theme.colorScheme;
  final CpiColors cpi = theme.extension<CpiColors>() ?? CpiColors.light;
  final bool dark = scheme.brightness == Brightness.dark;

  // La marque ne peint pas les aplats : ForUI dérive presque tout de
  // `colors.primary`, y brancher le bordeaux (ou le bleu CHUES) repeint chaque
  // bouton, case et onglet aux couleurs de l'enseigne. `primary` porte donc
  // l'encre ; la marque ne ressort qu'en accent — bouton fantôme, destination
  // active, curseur et contour de champ actif.
  final Color brand = scheme.primary;

  final FColors colors = FColors(
    brightness: scheme.brightness,
    systemOverlayStyle: dark
        ? SystemUiOverlayStyle.light
        : SystemUiOverlayStyle.dark,
    barrier: scheme.scrim.withValues(alpha: dark ? 0.6 : 0.4),
    background: scheme.surface,
    foreground: scheme.onSurface,
    primary: scheme.onSurface,
    primaryForeground: scheme.surface,
    secondary: scheme.surfaceContainerHigh,
    secondaryForeground: scheme.onSurfaceVariant,
    muted: scheme.surfaceContainerHigh,
    mutedForeground: scheme.onSurfaceVariant,
    destructive: scheme.error,
    destructiveForeground: scheme.onError,
    error: scheme.error,
    errorForeground: scheme.onError,
    card: scheme.surfaceContainerLowest,
    // Filet décoratif. Le contour des champs prend `cpi.inputBorder` plus bas :
    // WCAG 1.4.11 lui impose 3:1, pas à celui-ci.
    // Filets de séparation neutres : la marque ne teinte jamais un trait.
    border: scheme.outlineVariant,
  );

  final CpiMotion motion = reduceMotion
      ? CpiMotion.none
      : (theme.extension<CpiMotion>() ?? CpiMotion.standard);

  final FTypography typography = _typography(theme.textTheme);
  final FStyle style =
      FStyle.inherit(
        colors: colors,
        typography: typography,
        touch: true,
      ).copyWith(
        borderRadius: _radius,
        pagePadding: const EdgeInsetsDelta.value(
          EdgeInsets.symmetric(horizontal: CpiSpacing.md),
        ),
        shadow: const <BoxShadow>[],
        iconStyle: IconThemeDataDelta.delta(
          color: scheme.onSurface,
          size: CpiIconSize.lg,
        ),
        // L'anneau ForUI fait 1 dp de la couleur de marque : sur un bouton
        // bordeaux il se confond avec l'aplat. L'encre le pose à 2 dp,
        // au rayon des cartes (WCAG 2.4.11 et 1.4.11).
        focusedOutlineStyle: FFocusedOutlineStyle(
          color: scheme.onSurface,
          borderRadius: CpiRadius.brLg,
          width: 2,
        ),
        tappableStyle: _tappable(motion, scale: 0.97),
      );

  // Carte à la gnawalma : blanche, sans contour, posée par une ombre douce sur
  // le fond gris. En sombre l'ombre ne se voit pas : un filet neutre la borde,
  // jamais une teinte de marque.
  final BoxDecoration card = BoxDecoration(
    color: scheme.surfaceContainerLowest,
    borderRadius: CpiRadius.brXxl,
    border: dark ? Border.all(color: cpi.cardBorder) : null,
    boxShadow: dark
        ? null
        : CpiElevation.tinted(CpiElevation.md, scheme.shadow),
  );

  final BoxDecoration navPill = BoxDecoration(
    color: scheme.surfaceContainerLowest,
    borderRadius: CpiRadius.brFull,
    border: dark ? Border.all(color: cpi.cardBorder) : null,
    boxShadow: dark
        ? null
        : CpiElevation.tinted(CpiElevation.lg, scheme.shadow),
  );

  // `_RenderItemContent` fixe sa hauteur sans regarder les contraintes reçues :
  // un `ConstrainedBox` autour d'une tuile ne tient pas le plancher tactile,
  // seul son rembourrage le fait.
  final FVariants<
    FItemVariantConstraint,
    FItemVariant,
    FTileStyle,
    FTileStyleDelta
  >
  tiles =
      FTileStyles.inherit(
        colors: colors,
        typography: typography,
        style: style,
      ).apply(<
        FVariantOperation<
          FItemVariantConstraint,
          FItemVariant,
          FTileStyle,
          FTileStyleDelta
        >
      >[
        FVariantOperation.all(
          FTileStyleDelta.delta(
            // `FTileStyle.inherit` coupe le rebond et confond appui et survol
            // dans `colors.secondary` : une ligne de liste ne bougeait pas et
            // ne changeait pas de teinte sous le doigt.
            tappableStyle: _tappable(motion, scale: 0.985),
            decoration:
                FVariants<
                  FTappableVariantConstraint,
                  FTappableVariant,
                  Decoration,
                  DecorationDelta
                >(
                  _tile(colors, side: BorderSide(color: colors.border)),
                  variants: <List<FTappableVariantConstraint>, Decoration>{
                    <FTappableVariantConstraint>[
                      FTappableVariant.hovered,
                    ]: _tile(
                      colors,
                      side: BorderSide(color: colors.border),
                      color: colors.secondary,
                    ),
                    <FTappableVariantConstraint>[
                      FTappableVariant.pressed,
                    ]: _tile(
                      colors,
                      side: BorderSide(color: colors.border),
                      color: _pressed(colors, colors.card),
                    ),
                    // La coche de `CpiChoiceGroup` reste : le filet est le
                    // second signal, non chromatique (WCAG 1.4.1).
                    <FTappableVariantConstraint>[
                      FTappableVariant.selected,
                    ]: _tile(
                      colors,
                      side: BorderSide(color: scheme.primary, width: 2),
                    ),
                    <FTappableVariantConstraint>[
                      FTappableVariant.disabled,
                    ]: _tile(
                      colors,
                      side: BorderSide(color: colors.border),
                      color: colors.disable(colors.secondary),
                    ),
                  },
                ),
            contentStyle: FItemContentStyleDelta.delta(
              titleTextStyle: _text(
                const TextStyleDelta.delta(fontWeight: FontWeight.w600),
              ),
              // `FTileGroup` rabaisse sous-titre et détail à `xs2` (14) : le
              // plancher de corps CPI est 16.
              subtitleTextStyle: _text(
                const TextStyleDelta.delta(
                  fontSize: CpiTypography.minBodySize,
                  height: CpiTypography.leadingSnug,
                ),
              ),
              detailsTextStyle: _text(
                const TextStyleDelta.delta(
                  fontSize: CpiTypography.minBodySize,
                  height: CpiTypography.leadingSnug,
                ),
              ),
              suffixedPadding: const EdgeInsetsGeometryDelta.value(
                EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.lg,
                  CpiSpacing.sm,
                  CpiSpacing.lg,
                ),
              ),
              unsuffixedPadding: const EdgeInsetsGeometryDelta.value(
                EdgeInsets.symmetric(
                  horizontal: CpiSpacing.md,
                  vertical: CpiSpacing.lg,
                ),
              ),
              suffixIconStyle: _icon(
                const IconThemeDataDelta.delta(size: CpiIconSize.lg),
              ),
            ),
          ),
        ),
      ]);

  // Contour de case mesuré à 7,0–8,1:1 chez ForUI : il tient déjà 1.4.11, seul
  // son trait de 0,6 dp disparaissait au soleil.
  final FCheckboxStyle checkbox = FCheckboxStyle.inherit(
    colors: colors,
    style: style,
    touch: true,
  );
  // Piste et pastille de progression : la piste est une limite non textuelle,
  // `colors.muted` la laisse à 1,2:1 du fond (WCAG 1.4.11 en demande 3).
  final ShapeDecoration progressTrack = ShapeDecoration(
    shape: const RoundedSuperellipseBorder(borderRadius: CpiRadius.brFull),
    color: cpi.inputBorder,
  );
  final ShapeDecoration progressFill = ShapeDecoration(
    shape: const RoundedSuperellipseBorder(borderRadius: CpiRadius.brFull),
    color: colors.primary,
  );

  return FThemeData(
    colors: colors,
    touch: true,
    typography: typography,
    style: style,
    // Le pouce ForUI est `background`/`foreground` et la piste éteinte
    // `secondary` : les deux se confondent (1,15:1 en clair, 1,00:1 en sombre).
    // Le pouce prend la carte, la piste éteinte le contour de champ — le seul
    // gris du thème calibré pour 3:1 (WCAG 1.4.11).
    switchStyle: FSwitchStyle.inherit(colors: colors, style: style).copyWith(
      trackColor:
          FVariants<FSwitchVariantConstraint, FSwitchVariant, Color, Delta>(
            cpi.inputBorder,
            variants: <List<FSwitchVariantConstraint>, Color>{
              <FSwitchVariantConstraint>[FSwitchVariant.selected]:
                  colors.primary,
              <FSwitchVariantConstraint>[FSwitchVariant.disabled]: colors
                  .disable(cpi.inputBorder),
              <FSwitchVariantConstraint>[
                FSwitchVariant.selected.and(FSwitchVariant.disabled),
              ]: colors.disable(
                colors.primary,
              ),
            },
          ),
      thumbColor:
          FVariants<FSwitchVariantConstraint, FSwitchVariant, Color, Delta>.all(
            colors.card,
          ),
    ),
    checkboxStyle: checkbox.copyWith(
      decoration: checkbox.decoration.apply(<
        FVariantOperation<
          FCheckboxVariantConstraint,
          FCheckboxVariant,
          Decoration,
          DecorationDelta
        >
      >[
        FVariantOperation<
          FCheckboxVariantConstraint,
          FCheckboxVariant,
          Decoration,
          DecorationDelta
        >.base(
          DecorationDelta.shapeDelta(
            shape: RoundedSuperellipseBorder(
              side: BorderSide(color: colors.mutedForeground),
              borderRadius: CpiRadius.brXs,
            ),
          ),
        ),
      ]),
    ),
    progressStyle: FProgressStyle(
      trackDecoration: progressTrack,
      fillDecoration: progressFill,
    ),
    determinateProgressStyle: FDeterminateProgressStyle(
      trackDecoration: progressTrack,
      fillDecoration: progressFill,
    ),
    toasterStyle:
        FToasterStyle.inherit(
          colors: colors,
          typography: typography,
          style: style,
          touch: true,
        ).copyWith(
          motion: FToasterMotionDelta.delta(
            expandDuration: motion.screen,
            collapseDuration: motion.component,
            expandCurve: motion.easeOut,
            collapseCurve: motion.easeOut,
          ),
          toastStyles:
              FVariantsDelta<
                FToastVariantConstraint,
                FToastVariant,
                FToastStyle,
                FToastStyleDelta
              >.delta(<
                FVariantOperation<
                  FToastVariantConstraint,
                  FToastVariant,
                  FToastStyle,
                  FToastStyleDelta
                >
              >[
                FVariantOperation<
                  FToastVariantConstraint,
                  FToastVariant,
                  FToastStyle,
                  FToastStyleDelta
                >.all(
                  FToastStyleDelta.delta(
                    motion: FToastMotionDelta.delta(
                      entranceDuration: motion.component,
                      dismissDuration: motion.component,
                      transitionDuration: motion.component,
                      reentranceDuration: motion.component,
                      exitDuration: motion.component,
                      swipeCompletionDuration: motion.micro,
                    ),
                  ),
                ),
              ]),
        ),
    // `FHeaderActionStyle` n'a pas de contraintes : la cible tactile n'est que
    // la taille d'icône plus son rembourrage. ForUI tombait à 39 dp.
    headerStyles:
        FHeaderStyles.inherit(
          colors: colors,
          typography: typography,
          style: style,
          touch: true,
        ).apply(<
          FVariantOperation<
            FHeaderVariantConstraint,
            FHeaderVariant,
            FHeaderStyle,
            FHeaderStyleDelta
          >
        >[
          FVariantOperation<
            FHeaderVariantConstraint,
            FHeaderVariant,
            FHeaderStyle,
            FHeaderStyleDelta
          >.all(
            FHeaderStyleDelta.delta(
              actionStyle: FHeaderActionStyleDelta.delta(
                iconStyle: _icon(
                  const IconThemeDataDelta.delta(size: CpiIconSize.lg),
                ),
                padding: const EdgeInsetsGeometryDelta.value(
                  EdgeInsets.all((kCpiHeaderActionSize - CpiIconSize.lg) / 2),
                ),
              ),
            ),
          ),
        ]),
    buttonStyles:
        FVariants<
          FButtonVariantConstraint,
          FButtonVariant,
          FButtonSizeStyles,
          FButtonSizesDelta
        >(
          _button(
            colors,
            typography,
            style,
            fill: colors.primary,
            text: colors.primaryForeground,
            hovered: colors.hover(colors.primary),
            solid: true,
          ),
          variants: <List<FButtonVariantConstraint>, FButtonSizeStyles>{
            <FButtonVariantConstraint>[FButtonVariant.outline]: _button(
              colors,
              typography,
              style,
              fill: colors.card,
              // Le contour EST la limite du bouton : seuil non textuel de
              // WCAG 1.4.11, donc `inputBorder` et non le filet décoratif.
              border: cpi.inputBorder,
              text: colors.foreground,
              hovered: colors.secondary,
            ),
            <FButtonVariantConstraint>[FButtonVariant.ghost]: _button(
              colors,
              typography,
              style,
              text: brand,
              hovered: colors.secondary,
            ),
            <FButtonVariantConstraint>[FButtonVariant.destructive]: _button(
              colors,
              typography,
              style,
              fill: colors.destructive,
              text: colors.destructiveForeground,
              hovered: colors.hover(colors.destructive),
              solid: true,
            ),
          },
        ),
    tileStyles: tiles,
    cardStyle: FCardStyle.inherit(
      colors: colors,
      typography: typography,
      style: style,
      touch: true,
    ).copyWith(decoration: DecorationDelta.value(card)),
    tileGroupStyle: FTileGroupStyle.inherit(
      colors: colors,
      typography: typography,
      style: style,
    ).copyWith(decoration: DecorationDelta.value(card), tileStyles: tiles),
    bottomNavigationBarStyle:
        FBottomNavigationBarStyle.inherit(
          colors: colors,
          typography: typography,
          style: style,
        ).copyWith(
          decoration: DecorationDelta.value(navPill),
          padding: const EdgeInsetsGeometryDelta.value(
            EdgeInsets.symmetric(
              vertical: CpiSpacing.xs,
              horizontal: CpiSpacing.xxs,
            ),
          ),
          itemStyle: _navItemStyle(scheme, typography, style),
        ),
    textFieldStyles:
        FTextFieldSizeStyles.inherit(
          colors: colors,
          typography: typography,
          style: style,
          touch: true,
        ).apply(<
          FVariantOperation<
            FTextFieldSizeVariantConstraint,
            FTextFieldSizeVariant,
            FTextFieldStyle,
            FTextFieldStyleDelta
          >
        >[
          FVariantOperation.all(
            FTextFieldStyleDelta.delta(
              cursorColor: brand,
              contentPadding: const EdgeInsetsGeometryDelta.value(
                EdgeInsets.all(CpiSpacing.md),
              ),
              color:
                  FVariants<
                    FTextFieldVariantConstraint,
                    FTextFieldVariant,
                    Color?,
                    Delta
                  >(
                    cpi.inputBackground,
                    variants: <List<FTextFieldVariantConstraint>, Color?>{
                      <FTextFieldVariantConstraint>[FTextFieldVariant.disabled]:
                          colors.disable(cpi.inputBackground),
                    },
                  ),
              border:
                  FVariants<
                    FTextFieldVariantConstraint,
                    FTextFieldVariant,
                    InputBorder,
                    Delta
                  >(
                    _fieldBorder(cpi.inputBorder, 1),
                    variants: <List<FTextFieldVariantConstraint>, InputBorder>{
                      <FTextFieldVariantConstraint>[FTextFieldVariant.focused]:
                          _fieldBorder(brand, 2),
                      // Une erreur se voit sans avoir le doigt dessus : à 1 dp
                      // le champ fautif était identique au champ au repos.
                      <FTextFieldVariantConstraint>[FTextFieldVariant.error]:
                          _fieldBorder(scheme.error, 2),
                      <FTextFieldVariantConstraint>[
                        FTextFieldVariant.error.and(FTextFieldVariant.focused),
                      ]: _fieldBorder(
                        scheme.error,
                        2,
                      ),
                      <FTextFieldVariantConstraint>[FTextFieldVariant.disabled]:
                          _fieldBorder(colors.disable(cpi.inputBorder), 1),
                      <FTextFieldVariantConstraint>[
                        FTextFieldVariant.error.and(FTextFieldVariant.disabled),
                      ]: _fieldBorder(
                        colors.disable(scheme.error),
                        1,
                      ),
                    },
                  ),
            ),
          ),
        ]),
  );
}

/// Une variante de bouton : aplat, contour et couleur de texte explicites.
///
/// Sans cette table ForUI déduit chaque variante de `colors.primary`, et la
/// couleur d'aplat suivrait l'enseigne au lieu de l'encre. Une seule taille :
/// tout bouton tient le plancher tactile (WCAG 2.5.8), y compris en icône
/// seule.
///
/// [solid] distingue les variantes à aplat : sur elles l'appui ne peut pas
/// s'assombrir davantage sans devenir illisible, il pose donc un filet à la
/// couleur du fond de page. Les autres se remplissent de l'encre à
/// `CpiStateOpacity.pressed`.
FButtonSizeStyles _button(
  FColors colors,
  FTypography typography,
  FStyle style, {
  required Color text,
  required Color hovered,
  Color? fill,
  Color? border,
  bool solid = false,
}) {
  final BorderSide side = border == null
      ? BorderSide.none
      : BorderSide(color: border);
  final Color disabledFill = fill == null
      ? colors.background
      : Color.alphaBlend(colors.disable(fill), colors.background);

  ShapeDecoration decoration(Color? color, BorderSide side) => ShapeDecoration(
    shape: RoundedSuperellipseBorder(borderRadius: CpiRadius.brMd, side: side),
    color: color,
  );

  return FButtonSizeStyles(
    FVariants<
      FButtonSizeVariantConstraint,
      FButtonSizeVariant,
      FButtonStyle,
      FButtonStyleDelta
    >.all(
      FButtonStyle.inherit(
        style: style,
        decoration:
            FVariants<
              FTappableVariantConstraint,
              FTappableVariant,
              Decoration,
              DecorationDelta
            >(
              decoration(fill, side),
              variants: <List<FTappableVariantConstraint>, Decoration>{
                <FTappableVariantConstraint>[FTappableVariant.hovered]:
                    decoration(hovered, side),
                <FTappableVariantConstraint>[FTappableVariant.pressed]: solid
                    ? decoration(
                        colors.hover(fill!),
                        BorderSide(color: colors.background, width: 2),
                      )
                    : decoration(_pressed(colors, fill), side),
                <FTappableVariantConstraint>[FTappableVariant.selected]:
                    decoration(fill, BorderSide(color: text, width: 2)),
                <FTappableVariantConstraint>[
                  FTappableVariant.disabled,
                ]: decoration(
                  fill == null ? null : colors.disable(fill),
                  side,
                ),
              },
            ),
        textStyle: typography.sm,
        foregroundColor: text,
        disabledForegroundColor: _disabledInk(colors, disabledFill),
        contentConstraints: const BoxConstraints(
          minWidth: kCpiButtonHeight,
          minHeight: kCpiButtonHeight,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: CpiSpacing.lg,
          vertical: CpiSpacing.md,
        ),
        contentSpacing: CpiSpacing.xs,
        iconConstraints: const BoxConstraints(
          minWidth: kCpiButtonHeight,
          minHeight: kCpiButtonHeight,
        ),
        iconSize: CpiIconSize.lg,
        iconPadding: const EdgeInsets.all(
          (kCpiButtonHeight - CpiIconSize.lg) / 2,
        ),
      ),
    ),
  );
}

/// Encre d'un bouton éteint. ForUI la rend à moitié transparente : posée sur un
/// aplat lui-même délavé, « Enregistrer » tombait à 2,06:1. On garde l'encre ou
/// le fond — celui qui tranche le plus sur l'aplat éteint — dilué juste assez
/// pour tenir 3:1 (WCAG 1.4.3 exempte les contrôles éteints, le propriétaire
/// non : un bouton bloqué doit rester lisible pour qu'on lise pourquoi).
Color _disabledInk(FColors colors, Color fill) {
  final Color ink =
      _ratio(colors.foreground, fill) >= _ratio(colors.background, fill)
      ? colors.foreground
      : colors.background;
  for (final double alpha in <double>[0.55, 0.7, 0.85]) {
    final Color faded = Color.alphaBlend(ink.withValues(alpha: alpha), fill);
    if (_ratio(faded, fill) >= 3) return faded;
  }
  return ink;
}

/// Contraste WCAG 2.2 entre deux couleurs opaques.
/// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
double _ratio(Color a, Color b) {
  double luminance(Color c) {
    double channel(double v) => v <= 0.03928
        ? v / 12.92
        : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
    return 0.2126 * channel(c.r) +
        0.7152 * channel(c.g) +
        0.0722 * channel(c.b);
  }

  final double la = luminance(a);
  final double lb = luminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// L'appui : l'encre du thème posée à [CpiStateOpacity.pressed] sur la surface
/// de repos. Un aplat déjà foncé ne peut pas s'assombrir, il prend un filet.
Color _pressed(FColors colors, Color? rest) => Color.alphaBlend(
  colors.foreground.withValues(alpha: CpiStateOpacity.pressed),
  rest ?? colors.background,
);

/// Le rebond ForUI est bridé à 5 px : sur un CTA pleine largeur il ne se voyait
/// pas. `pressedEnterDuration` à zéro rend l'appui immédiat — à 100 ms un tap
/// bref ne posait jamais l'état `pressed`, et rien ne changeait à l'écran.
///
/// Les deux temporisations restent à zéro : `_FTappableState` les tient par un
/// `Future.delayed` que rien n'annule au démontage (forui 0.21.3,
/// `tappable.dart:471,494`) — un appui laissait un minuteur pendant derrière
/// l'écran quitté. Le relâchement se voit par le rebond, lui porté par un
/// `AnimationController` qui, lui, est bien libéré.
FTappableStyle _tappable(CpiMotion motion, {required double scale}) =>
    FTappableStyle(
      pressedEnterDuration: Duration.zero,
      pressedExitDuration: Duration.zero,
      motion: motion.micro == Duration.zero
          ? FTappableMotion.none
          : FTappableMotion(
              bounceTween: Tween<double>(begin: 1, end: scale),
              bounceFloor: null,
              bounceDownDuration: const Duration(milliseconds: 90),
              bounceUpDuration: motion.micro,
              bounceUpCurve: motion.easeSpring,
            ),
    );

/// La décoration d'une tuile : même forme que celle de ForUI, teintes à nous.
ShapeDecoration _tile(
  FColors colors, {
  required BorderSide side,
  Color? color,
}) => ShapeDecoration(
  shape: RoundedSuperellipseBorder(side: side, borderRadius: CpiRadius.brMd),
  color: color ?? colors.card,
);

/// Reprend le style ForUI d'une destination en imposant `CpiIconSize` et
/// l'accent de marque sur la destination active.
FBottomNavigationBarItemStyle _navItemStyle(
  ColorScheme scheme,
  FTypography typography,
  FStyle style,
) => FBottomNavigationBarItemStyle(
  iconStyle:
      FVariants<
        FTappableVariantConstraint,
        FTappableVariant,
        IconThemeData,
        IconThemeDataDelta
      >.from(
        // La destination au repos RECULE : `outline` la pose un cran sous
        // l'encre de corps, la marque ressort d'autant sur l'active.
        IconThemeData(color: scheme.outline, size: CpiIconSize.xxl),
        variants: <List<FTappableVariantConstraint>, IconThemeDataDelta>{
          <FTappableVariantConstraint>[FTappableVariant.selected]:
              IconThemeDataDelta.delta(color: scheme.primary),
        },
      ),
  textStyle:
      FVariants<
        FTappableVariantConstraint,
        FTappableVariant,
        TextStyle,
        TextStyleDelta
      >.from(
        // Quatre libellés côte à côte sur 320 dp : à l'échelle du corps ils se
        // tronquent, et un libellé coupé est pire qu'un libellé plus petit.
        // Le LIBELLÉ reste en `onSurfaceVariant` : à 14 sp gras il compte
        // comme du texte courant, et `outline` le laisse à 4,32:1 sur la
        // carte sombre CPI (WCAG 1.4.3 en demande 4,5). Seule l'icône, qui
        // n'est pas du texte, recule à `outline`.
        typography.xs3.copyWith(
          color: scheme.onSurfaceVariant,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        variants: <List<FTappableVariantConstraint>, TextStyleDelta>{
          <FTappableVariantConstraint>[
            FTappableVariant.selected,
          ]: TextStyleDelta.delta(
            color: scheme.primary,
            fontWeight: FontWeight.w700,
          ),
        },
      ),
  tappableStyle: style.tappableStyle,
  focusedOutlineStyle: style.focusedOutlineStyle,
  spacing: CpiSpacing.xxs,
);

/// Applique un delta à toutes les variantes tactiles d'un jeu de styles.
FVariantsDelta<
  FTappableVariantConstraint,
  FTappableVariant,
  TextStyle,
  TextStyleDelta
>
_text(TextStyleDelta delta) =>
    FVariantsDelta<
      FTappableVariantConstraint,
      FTappableVariant,
      TextStyle,
      TextStyleDelta
    >.delta(<
      FVariantOperation<
        FTappableVariantConstraint,
        FTappableVariant,
        TextStyle,
        TextStyleDelta
      >
    >[
      FVariantOperation<
        FTappableVariantConstraint,
        FTappableVariant,
        TextStyle,
        TextStyleDelta
      >.all(delta),
    ]);

FVariantsDelta<
  FTappableVariantConstraint,
  FTappableVariant,
  IconThemeData,
  IconThemeDataDelta
>
_icon(IconThemeDataDelta delta) =>
    FVariantsDelta<
      FTappableVariantConstraint,
      FTappableVariant,
      IconThemeData,
      IconThemeDataDelta
    >.delta(<
      FVariantOperation<
        FTappableVariantConstraint,
        FTappableVariant,
        IconThemeData,
        IconThemeDataDelta
      >
    >[
      FVariantOperation<
        FTappableVariantConstraint,
        FTappableVariant,
        IconThemeData,
        IconThemeDataDelta
      >.all(delta),
    ]);

OutlineInputBorder _fieldBorder(Color color, double width) =>
    OutlineInputBorder(
      borderRadius: CpiRadius.brMd,
      borderSide: BorderSide(color: color, width: width),
    );

/// L'échelle ForUI se branche sur le `TextTheme` de CPI : une seule source de
/// vérité typographique, y compris pour la couleur du texte.
FTypography _typography(TextTheme text) => FTypography(
  fontFamily: CpiFonts.body,
  xs3: text.labelSmall,
  xs2: text.labelSmall,
  xs: text.bodySmall,
  sm: text.bodyMedium,
  md: text.labelLarge,
  lg: text.titleSmall,
  xl: text.titleMedium,
  xl2: text.titleLarge,
  xl3: text.headlineMedium,
  xl4: text.displaySmall,
  xl5: text.displayMedium,
  xl6: text.displayLarge,
  xl7: text.displayLarge,
  xl8: text.displayLarge,
);
