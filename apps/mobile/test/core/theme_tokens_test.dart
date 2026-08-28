import 'dart:io';

import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_colors.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/contrast_helpers.dart';

void main() {
  group('Contour des champs (WCAG 1.4.11)', () {
    // Le ratio est CALCULÉ contre les surfaces réelles du thème : figer le hex
    // laisserait passer un changement de fond qui replonge le bord sous 3:1.
    for (final (String coque, ColorScheme scheme, CpiColors cpi)
        in <(String, ColorScheme, CpiColors)>[
          ('CPI', AppTheme.colorScheme, CpiColors.light),
          ('CHUES', AppTheme.chuesColorScheme, CpiColors.chues),
        ]) {
      test('$coque : le contour atteint 3:1 sur ses trois voisins', () {
        for (final (String voisin, Color fond) in <(String, Color)>[
          ('le fond de page', scheme.surface),
          ('la carte', scheme.surfaceContainerLowest),
          ('le remplissage du champ', cpi.inputBackground),
        ]) {
          expect(
            contrastRatio(cpi.inputBorder, fond),
            greaterThanOrEqualTo(3.0),
            reason:
                '$coque : le contour de champ disparaît sur $voisin '
                '(${contrastRatio(cpi.inputBorder, fond).toStringAsFixed(2)}:1)',
          );
        }
      });

      test(
        '$coque : la bordure décorative NE PASSE PAS, d\'où le rôle séparé',
        () {
          // C'est le défaut mesuré : `borderSubtle` aplati sur le champ fait
          // 1,27:1. Si un jour il passait, `inputBorder` deviendrait redondant.
          final Color aplati = Color.alphaBlend(
            cpi.borderSubtle,
            cpi.inputBackground,
          );
          expect(contrastRatio(aplati, cpi.inputBackground), lessThan(3.0));
          expect(cpi.inputBorder, isNot(cpi.borderSubtle));
        },
      );

      test('$coque : la piste de progression du démarrage tient 3:1', () {
        // Le démarrage ne peint plus l'aplat de marque : le fil se lit
        // maintenant sur la piste neutre de la surface (WCAG 1.4.11).
        expect(
          contrastRatio(scheme.primary, scheme.surfaceContainerHigh),
          greaterThanOrEqualTo(3.0),
        );
      });

      // Le dégradé de connexion a été supprimé (`cpiBrandGradient`, zéro
      // appelant) : l'aplat de marque reste, et c'est LUI qui doit porter ses
      // deux encres.
      test('$coque : l\'aplat de marque porte ses encres', () {
        expect(
          contrastRatio(scheme.onPrimary, scheme.primary),
          greaterThanOrEqualTo(4.5),
          reason: '$coque : le texte de connexion passe sous AA',
        );
        expect(
          contrastRatio(cpi.navForeground, scheme.primary),
          greaterThanOrEqualTo(4.5),
        );
      });
    }

    test('la coque CHUES ne rend pas de bordeaux', () {
      expect(
        AppTheme.chuesColorScheme.primary,
        isNot(AppTheme.colorScheme.primary),
      );
      expect(AppTheme.colorScheme.primary, const Color(0xFF630210));
      expect(AppTheme.chuesColorScheme.primary, isNot(const Color(0xFF630210)));
    });

    test('les deux coques ont bien DEUX contours différents', () {
      expect(CpiColors.light.inputBorder, isNot(CpiColors.chues.inputBorder));
    });

    test('le thème pose le contour là où le champ se délimite', () {
      final ThemeData theme = AppTheme.light;
      final CpiColors cpi = theme.extension<CpiColors>()!;
      final InputBorder? enabled = theme.inputDecorationTheme.enabledBorder;
      expect(
        (enabled! as OutlineInputBorder).borderSide.color,
        cpi.inputBorder,
      );
      expect(
        theme.checkboxTheme.side?.color,
        cpi.inputBorder,
        reason: 'la case à cocher n\'a que son bord pour exister',
      );
      expect(
        theme.outlinedButtonTheme.style?.side?.resolve(<WidgetState>{})?.color,
        cpi.inputBorder,
      );
    });
  });

  group('Contour des champs en sombre (WCAG 1.4.11)', () {
    for (final (String coque, ColorScheme scheme, CpiColors cpi)
        in <(String, ColorScheme, CpiColors)>[
          ('CPI', AppTheme.darkColorScheme, CpiColors.dark),
          ('CHUES', AppTheme.chuesDarkColorScheme, CpiColors.chuesDark),
        ]) {
      test('$coque sombre : le contour atteint 3:1 sur ses trois voisins', () {
        for (final (String voisin, Color fond) in <(String, Color)>[
          ('le fond de page', scheme.surface),
          ('la carte', scheme.surfaceContainerLowest),
          ('le remplissage du champ', cpi.inputBackground),
        ]) {
          expect(
            contrastRatio(cpi.inputBorder, fond),
            greaterThanOrEqualTo(3.0),
            reason:
                '$coque sombre : le contour de champ disparaît sur $voisin '
                '(${contrastRatio(cpi.inputBorder, fond).toStringAsFixed(2)}:1)',
          );
        }
      });

      test('$coque sombre : la bordure décorative NE PASSE PAS', () {
        final Color aplati = Color.alphaBlend(
          cpi.borderSubtle,
          cpi.inputBackground,
        );
        expect(contrastRatio(aplati, cpi.inputBackground), lessThan(3.0));
        expect(cpi.inputBorder, isNot(cpi.borderSubtle));
      });

      test('$coque sombre : l\'aplat de marque reste lisible', () {
        // En sombre l'aplat de marque est CLAIR : c'est `onPrimary`, teinte
        // profonde, qui s'y écrit — pas `navForeground`, réservé au fond noir.
        expect(
          contrastRatio(scheme.onPrimary, scheme.primary),
          greaterThanOrEqualTo(4.5),
          reason: '$coque sombre : le texte sur l\'aplat passe sous AA',
        );
      });

      // En sombre l'ombre ne se voit pas : le filet EST la limite de la carte.
      test('$coque sombre : le filet de carte se voit sur la carte', () {
        expect(
          contrastRatio(cpi.cardBorder, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(1.5),
          reason:
              '$coque sombre : filet à '
              '${contrastRatio(cpi.cardBorder, scheme.surfaceContainerLowest).toStringAsFixed(2)}:1',
        );
        expect(
          contrastRatio(cpi.cardBorder, scheme.surfaceContainerLowest),
          greaterThan(
            contrastRatio(scheme.outlineVariant, scheme.surfaceContainerLowest),
          ),
        );
      });

      test('$coque sombre : le fil du démarrage tient 3:1 sur sa piste', () {
        // Le démarrage montre la même surface neutre en clair et en sombre :
        // c'est contre elle, et non contre un aplat de marque, que le fil de
        // progression doit se lire.
        expect(
          contrastRatio(scheme.primary, scheme.surfaceContainerHigh),
          greaterThanOrEqualTo(3.0),
        );
      });
    }

    test('en sombre non plus, CHUES ne rend pas de bordeaux', () {
      expect(
        AppTheme.chuesDarkColorScheme.primary,
        isNot(AppTheme.darkColorScheme.primary),
      );
      expect(
        AppTheme.darkColorScheme.primary,
        isNot(AppTheme.colorScheme.primary),
      );
      expect(CpiColors.dark.cardBorder, isNot(CpiColors.chuesDark.cardBorder));
    });

    test('les deux coques sombres ont bien DEUX contours différents', () {
      expect(
        CpiColors.dark.inputBorder,
        isNot(CpiColors.chuesDark.inputBorder),
      );
      expect(CpiColors.dark.inputBorder, isNot(CpiColors.light.inputBorder));
      expect(
        CpiColors.chuesDark.inputBorder,
        isNot(CpiColors.chues.inputBorder),
      );
    });
  });

  group('Cible tactile', () {
    test('le plancher est celui d\'Android, pas 44', () {
      expect(kCpiMinTouchTarget, greaterThanOrEqualTo(48));
    });

    test('les boutons du thème le respectent', () {
      for (final ThemeData theme in <ThemeData>[
        AppTheme.light,
        AppTheme.chues,
      ]) {
        for (final ButtonStyle? style in <ButtonStyle?>[
          theme.filledButtonTheme.style,
          theme.outlinedButtonTheme.style,
          theme.textButtonTheme.style,
          theme.iconButtonTheme.style,
        ]) {
          final Size? min = style?.minimumSize?.resolve(<WidgetState>{});
          expect(min!.height, greaterThanOrEqualTo(kCpiMinTouchTarget));
        }
      }
    });
  });

  group('Échelle d\'icônes', () {
    test('aucune taille d\'icône n\'est écrite en dur dans lib/', () {
      final RegExp litteral = RegExp(r'\bsize: \d');
      final List<String> fautifs = <String>[];
      for (final FileSystemEntity f in Directory(
        'lib',
      ).listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        final List<String> lignes = f.readAsLinesSync();
        for (int i = 0; i < lignes.length; i += 1) {
          if (litteral.hasMatch(lignes[i])) fautifs.add('${f.path}:${i + 1}');
        }
      }
      expect(
        fautifs,
        isEmpty,
        reason: '121 valeurs en dur pour 13 tailles : passez par CpiIconSize',
      );
    });

    test('l\'échelle d\'espacement n\'oblige plus à compter', () {
      expect(CpiSpacing.xxsPlus, 6);
      expect(CpiSpacing.xxsPlus, greaterThan(CpiSpacing.xxs));
      expect(CpiSpacing.xxsPlus, lessThan(CpiSpacing.xs));
    });

    test('aucun fichier ne recalcule un écart de l\'échelle', () {
      final List<String> fautifs = <String>[];
      for (final FileSystemEntity f in Directory(
        'lib',
      ).listSync(recursive: true)) {
        if (f is! File || !f.path.endsWith('.dart')) continue;
        if (f.readAsStringSync().contains('CpiSpacing.xxs + ')) {
          fautifs.add(f.path);
        }
      }
      expect(fautifs, isEmpty);
    });
  });
}
