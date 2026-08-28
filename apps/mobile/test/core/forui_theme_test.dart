import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_colors.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/core/theme/cpi_typography.dart';
import 'package:cpi_go/core/theme/forui_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';

import '../support/contrast_helpers.dart';

/// La couche ForUI ne repeint pas l'application aux couleurs de l'enseigne :
/// `colors.primary` porte l'encre, la marque ne sort qu'en accent. ForUI dérive
/// aplats de boutons, cases, onglets et curseurs de `colors.primary` : y
/// brancher le bordeaux rendait chaque surface pleine bordeaux.
void main() {
  final Map<String, ThemeData> themes = <String, ThemeData>{
    'CPI clair': AppTheme.light,
    'CPI sombre': AppTheme.dark,
    'CHUES clair': AppTheme.chues,
    'CHUES sombre': AppTheme.chuesDark,
  };

  Color? fill(FButtonSizeStyles styles) =>
      (styles.base.decoration.resolve(const <FVariant>{}) as ShapeDecoration)
          .color;

  Color? ink(FButtonSizeStyles styles) =>
      styles.base.contentStyle.textStyle.resolve(const <FVariant>{}).color;

  for (final MapEntry<String, ThemeData> entry in themes.entries) {
    group(entry.key, () {
      final ThemeData theme = entry.value;
      final ColorScheme scheme = theme.colorScheme;
      final CpiColors cpi = theme.extension<CpiColors>()!;
      final FThemeData forui = cpiForuiTheme(theme);

      test('l\'aplat par défaut est l\'encre, jamais la marque', () {
        expect(forui.colors.primary, scheme.onSurface);
        expect(forui.colors.primary, isNot(scheme.primary));
        expect(fill(forui.buttonStyles.primary), scheme.onSurface);
        expect(
          contrastRatio(ink(forui.buttonStyles.primary)!, scheme.onSurface),
          greaterThanOrEqualTo(4.5),
        );
      });

      // En sombre l'ombre ne porte plus la carte : le filet EST sa limite.
      test('la carte a une limite visible en sombre', () {
        if (scheme.brightness != Brightness.dark) return;
        final BoxDecoration carte = forui.cardStyle.decoration as BoxDecoration;
        expect(carte.border, isNotNull);
        expect(carte.boxShadow ?? const <BoxShadow>[], isEmpty);
        expect(
          contrastRatio(cpi.cardBorder, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(1.5),
        );
      });

      test('les variantes neutres restent lisibles', () {
        expect(
          contrastRatio(
            ink(forui.buttonStyles.secondary)!,
            fill(forui.buttonStyles.secondary)!,
          ),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          contrastRatio(
            ink(forui.buttonStyles.outline)!,
            fill(forui.buttonStyles.outline)!,
          ),
          greaterThanOrEqualTo(4.5),
        );
        // Le contour EST la limite du bouton : WCAG 1.4.11, 3:1.
        expect(
          contrastRatio(cpi.inputBorder, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('la marque ne reste que sur le bouton fantôme', () {
        expect(ink(forui.buttonStyles.ghost), scheme.primary);
        expect(fill(forui.buttonStyles.ghost), isNull);
        expect(
          contrastRatio(scheme.primary, scheme.surface),
          greaterThanOrEqualTo(4.5),
        );
      });

      test('le bouton destructeur porte l\'erreur, pleine', () {
        expect(fill(forui.buttonStyles.destructive), scheme.error);
        expect(ink(forui.buttonStyles.destructive), scheme.onError);
      });

      // ForUI peint le pouce en `background`/`foreground` et la piste éteinte
      // en `secondary` : mesuré 1,15:1 en clair et 1,00:1 en sombre — un
      // interrupteur littéralement invisible (WCAG 1.4.11 demande 3:1).
      test('interrupteur_visible_dans_les_quatre_themes', () {
        final FSwitchStyle interrupteur = forui.switchStyle;
        final Color pouce = interrupteur.thumbColor.resolve(const <FVariant>{});
        final Color eteinte = interrupteur.trackColor.resolve(
          const <FVariant>{},
        );
        final Color allumee = interrupteur.trackColor.resolve(<FVariant>{
          FSwitchVariant.selected,
        });
        expect(contrastRatio(pouce, eteinte), greaterThanOrEqualTo(3.0));
        expect(contrastRatio(pouce, allumee), greaterThanOrEqualTo(3.0));
        expect(
          contrastRatio(eteinte, forui.colors.card),
          greaterThanOrEqualTo(3.0),
        );
        expect(
          contrastRatio(eteinte, forui.colors.background),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('case et bouton radio portent un contour visible', () {
        final ShapeDecoration case_ =
            forui.checkboxStyle.decoration.resolve(const <FVariant>{})
                as ShapeDecoration;
        final Color contour =
            (case_.shape as RoundedSuperellipseBorder).side.color;
        expect(contrastRatio(contour, case_.color!), greaterThanOrEqualTo(3.0));
        expect(
          contrastRatio(contour, scheme.surface),
          greaterThanOrEqualTo(3.0),
        );
        expect(
          contrastRatio(
            forui.radioStyle.borderColor.resolve(const <FVariant>{}),
            scheme.surface,
          ),
          greaterThanOrEqualTo(3.0),
        );
      });

      // `colors.muted` laissait la piste à 1,2–1,4:1 du fond.
      test('la piste de progression se distingue du fond', () {
        for (final (Decoration piste, Decoration rempli)
            in <(Decoration, Decoration)>[
              (
                forui.progressStyle.trackDecoration,
                forui.progressStyle.fillDecoration,
              ),
              (
                forui.determinateProgressStyle.trackDecoration,
                forui.determinateProgressStyle.fillDecoration,
              ),
            ]) {
          final Color fondDePiste = (piste as ShapeDecoration).color!;
          final Color avancement = (rempli as ShapeDecoration).color!;
          expect(
            contrastRatio(fondDePiste, scheme.surface),
            greaterThanOrEqualTo(3.0),
          );
          expect(
            contrastRatio(avancement, fondDePiste),
            greaterThanOrEqualTo(3.0),
          );
        }
      });

      // `FHeaderActionStyle` n'a pas de contraintes : icône + rembourrage font
      // toute la cible, et ForUI la laissait à 39 dp.
      test('l\'action de bandeau tient la cible tactile', () {
        final FHeaderStyle nested = forui.headerStyles.nested;
        final double icone = nested.actionStyle.iconStyle
            .resolve(const <FVariant>{})
            .size!;
        final EdgeInsets marge = nested.actionStyle.padding.resolve(
          TextDirection.ltr,
        );
        expect(
          icone + marge.horizontal,
          greaterThanOrEqualTo(kCpiMinTouchTarget),
        );
        expect(
          icone + marge.vertical,
          greaterThanOrEqualTo(kCpiMinTouchTarget),
        );
        expect(nested.constraints.minHeight, greaterThanOrEqualTo(52));
      });

      test('mouvement réduit : le toaster ne bouge plus', () {
        final FThemeData fige = cpiForuiTheme(theme, reduceMotion: true);
        expect(fige.toasterStyle.motion.expandDuration, Duration.zero);
        expect(fige.toasterStyle.motion.collapseDuration, Duration.zero);
        expect(
          fige.toasterStyle.toastStyles.primary.motion.entranceDuration,
          Duration.zero,
        );
        expect(
          forui.toasterStyle.toastStyles.primary.motion.entranceDuration,
          isNot(Duration.zero),
        );
      });

      // Le corps ne descend jamais sous 16 et les libellés sous 14 : l'app se
      // lit debout, au soleil, à bout de bras.
      test('aucun texte de composant ne passe sous le plancher', () {
        expect(
          forui.tileStyles.base.contentStyle.titleTextStyle
              .resolve(const <FVariant>{})
              .fontSize,
          greaterThanOrEqualTo(CpiTypography.minBodySize),
        );
        expect(
          forui.tileStyles.base.contentStyle.subtitleTextStyle
              .resolve(const <FVariant>{})
              .fontSize,
          greaterThanOrEqualTo(CpiTypography.minBodySize),
        );
        expect(
          forui.textFieldStyles.base.contentTextStyle
              .resolve(const <FVariant>{})
              .fontSize,
          greaterThanOrEqualTo(CpiTypography.minBodySize),
        );
        expect(
          forui.textFieldStyles.base.labelTextStyle
              .resolve(const <FVariant>{})
              .fontSize,
          greaterThanOrEqualTo(CpiTypography.minBodySize),
        );
        expect(ink(forui.buttonStyles.primary)!, isNotNull);
        expect(
          forui.buttonStyles.primary.base.contentStyle.textStyle
              .resolve(const <FVariant>{})
              .fontSize,
          greaterThanOrEqualTo(CpiTypography.minBodySize),
        );
      });

      // Un tap de moins de 100 ms ne posait jamais l'état `pressed` (ForUI
      // 0.21.3, `tappable.dart:471`) et le rebond était bridé à 5 px : un CTA
      // pleine largeur ne bougeait pas sous le doigt.
      test('l\'appui est immédiat et le rebond n\'est plus bridé', () {
        final FTappableStyle tappable = forui.style.tappableStyle;
        expect(tappable.pressedEnterDuration, Duration.zero);
        expect(tappable.motion.bounceFloor, isNull);
        expect(tappable.motion.bounceTween.transform(1), lessThan(1));
        expect(
          cpiForuiTheme(
            theme,
            reduceMotion: true,
          ).style.tappableStyle.motion.bounceTween.transform(1),
          1,
          reason: 'mouvement réduit : plus aucun rebond (WCAG 2.3.3)',
        );
      });

      test('toute variante bouge à l\'appui', () {
        for (final MapEntry<String, FButtonSizeStyles> entry
            in <String, FButtonSizeStyles>{
              'primary': forui.buttonStyles.primary,
              'outline': forui.buttonStyles.outline,
              'ghost': forui.buttonStyles.ghost,
              'destructive': forui.buttonStyles.destructive,
            }.entries) {
          final ShapeDecoration repos =
              entry.value.base.decoration.resolve(const <FVariant>{})
                  as ShapeDecoration;
          final ShapeDecoration appui =
              entry.value.base.decoration.resolve(<FVariant>{
                    FTappableVariant.pressed,
                  })
                  as ShapeDecoration;
          final BorderSide filetDeRepos =
              (repos.shape as RoundedSuperellipseBorder).side;
          final BorderSide filetDAppui =
              (appui.shape as RoundedSuperellipseBorder).side;
          final double ecart = contrastRatio(
            appui.color ?? scheme.surface,
            repos.color ?? scheme.surface,
          );
          expect(
            ecart >= 1.4 || filetDAppui != filetDeRepos,
            isTrue,
            reason:
                '${entry.key} : rien ne change à l\'appui '
                '(${ecart.toStringAsFixed(2)}:1, filet identique)',
          );
        }
      });

      test('la tuile aussi bouge à l\'appui, et se marque choisie', () {
        final FTileStyle tuile = forui.tileStyles.base;
        final Color repos =
            (tuile.decoration.resolve(const <FVariant>{}) as ShapeDecoration)
                .color!;
        final Color appui =
            (tuile.decoration.resolve(<FVariant>{FTappableVariant.pressed})
                    as ShapeDecoration)
                .color!;
        expect(contrastRatio(appui, repos), greaterThanOrEqualTo(1.4));

        final RoundedSuperellipseBorder choisie =
            (tuile.decoration.resolve(<FVariant>{FTappableVariant.selected})
                        as ShapeDecoration)
                    .shape
                as RoundedSuperellipseBorder;
        expect(choisie.side.width, greaterThanOrEqualTo(2));
        // Le filet est le signal d'état : WCAG 1.4.11 lui impose 3:1 contre la
        // tuile au repos ET contre la carte qui la porte.
        expect(
          contrastRatio(choisie.side.color, repos),
          greaterThanOrEqualTo(3.0),
        );
        expect(
          contrastRatio(choisie.side.color, forui.colors.card),
          greaterThanOrEqualTo(3.0),
        );
        expect(tuile.tappableStyle.motion.bounceFloor, isNull);
      });

      // ForUI éteint le texte à 50 % d'alpha : sur l'aplat éteint, lui-même
      // délavé, « Enregistrer » tombait à 2,06:1 et la RAISON du blocage
      // (`CpiButton.subtitle`) devenait illisible.
      test('un bouton éteint reste lisible', () {
        for (final MapEntry<String, FButtonSizeStyles> entry
            in <String, FButtonSizeStyles>{
              'primary': forui.buttonStyles.primary,
              'outline': forui.buttonStyles.outline,
              'ghost': forui.buttonStyles.ghost,
              'destructive': forui.buttonStyles.destructive,
            }.entries) {
          final Color encre = entry.value.base.contentStyle.textStyle.resolve(
            <FVariant>{FTappableVariant.disabled},
          ).color!;
          final Color? aplat =
              (entry.value.base.decoration.resolve(<FVariant>{
                        FTappableVariant.disabled,
                      })
                      as ShapeDecoration)
                  .color;
          final Color fond = aplat == null
              ? scheme.surface
              : Color.alphaBlend(aplat, scheme.surface);
          expect(encre.a, 1, reason: '${entry.key} : encre translucide');
          expect(
            contrastRatio(encre, fond),
            greaterThanOrEqualTo(3.0),
            reason:
                '${entry.key} éteint : '
                '${contrastRatio(encre, fond).toStringAsFixed(2)}:1',
          );
        }
      });

      test('l\'anneau de focus se voit sur la surface comme sur la carte', () {
        final FFocusedOutlineStyle anneau = forui.style.focusedOutlineStyle;
        expect(anneau.width, greaterThanOrEqualTo(2));
        expect(anneau.borderRadius, CpiRadius.brLg);
        expect(
          contrastRatio(anneau.color, scheme.surface),
          greaterThanOrEqualTo(3.0),
        );
        expect(
          contrastRatio(anneau.color, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('le champ dit son état par son contour', () {
        final FTextFieldStyle champ = forui.textFieldStyles.base;
        OutlineInputBorder trait(Set<FVariant> etat) =>
            champ.border.resolve(etat) as OutlineInputBorder;

        final OutlineInputBorder repos = trait(const <FVariant>{});
        final OutlineInputBorder actif = trait(<FVariant>{
          FTextFieldVariant.focused,
        });
        final OutlineInputBorder erreur = trait(<FVariant>{
          FTextFieldVariant.error,
        });
        final OutlineInputBorder eteint = trait(<FVariant>{
          FTextFieldVariant.disabled,
        });

        expect(eteint.borderSide, isNot(actif.borderSide));
        expect(eteint.borderSide, isNot(repos.borderSide));
        // Une erreur se voit sans avoir le doigt dessus.
        expect(
          erreur.borderSide.width,
          greaterThanOrEqualTo(actif.borderSide.width),
        );
        expect(erreur.borderSide.color, scheme.error);
        expect(
          trait(<FVariant>{
            FTextFieldVariant.error,
            FTextFieldVariant.disabled,
          }).borderSide,
          isNot(erreur.borderSide),
        );
      });

      // Le contraste entre les DEUX encres de nav ne peut pas atteindre 3:1
      // (mesuré 1,19 à 1,76:1) : deux encres lisibles sur la même carte claire
      // en sont incapables. C'est la pastille pleine qui porte l'état, et elle
      // se mesure contre la carte (WCAG 1.4.11), doublée d'une icône pleine et
      // d'une graisse (WCAG 1.4.1).
      test('la destination active se distingue sans compter sur la teinte', () {
        expect(
          contrastRatio(scheme.primary, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(3.0),
          reason: 'la pastille active disparaît sur la nav',
        );
        expect(
          contrastRatio(scheme.onPrimary, scheme.primary),
          greaterThanOrEqualTo(4.5),
          reason: 'l\'icône active est illisible dans sa pastille',
        );
        final FBottomNavigationBarItemStyle item =
            forui.bottomNavigationBarStyle.itemStyle;
        final Color inactif = item.textStyle.resolve(const <FVariant>{}).color!;
        final Color actif = item.textStyle.resolve(<FVariant>{
          FTappableVariant.selected,
        }).color!;
        expect(actif, scheme.primary);
        // Le libellé est du texte courant (14 sp), l'icône ne l'est pas :
        // 4,5:1 pour l'un, 3:1 pour l'autre (WCAG 1.4.3 et 1.4.11).
        expect(
          contrastRatio(inactif, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(4.5),
          reason: 'le libellé au repos passe sous AA',
        );
        expect(
          item.iconStyle.resolve(const <FVariant>{}).color,
          scheme.outline,
        );
        expect(
          contrastRatio(scheme.outline, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(3.0),
          reason: 'l\'icône au repos disparaît de la nav',
        );
        expect(
          contrastRatio(actif, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          item.textStyle.resolve(<FVariant>{
            FTappableVariant.selected,
          }).fontWeight,
          FontWeight.w700,
        );
      });

      test('toute variante tient le plancher tactile', () {
        for (final FButtonSizeStyles styles in <FButtonSizeStyles>[
          forui.buttonStyles.primary,
          forui.buttonStyles.secondary,
          forui.buttonStyles.outline,
          forui.buttonStyles.ghost,
          forui.buttonStyles.destructive,
        ]) {
          expect(
            styles.base.contentStyle.constraints.minHeight,
            greaterThanOrEqualTo(kCpiButtonHeight),
          );
          expect(
            styles.base.iconContentStyle.constraints.minWidth,
            greaterThanOrEqualTo(kCpiButtonHeight),
          );
        }
      });
    });
  }
}
