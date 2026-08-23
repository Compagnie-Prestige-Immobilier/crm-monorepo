import 'dart:io';
import 'dart:math' as math;

import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_colors.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double _luminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

double contrast(Color a, Color b) {
  final double la = _luminance(a);
  final double lb = _luminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

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
            contrast(cpi.inputBorder, fond),
            greaterThanOrEqualTo(3.0),
            reason:
                '$coque : le contour de champ disparaît sur $voisin '
                '(${contrast(cpi.inputBorder, fond).toStringAsFixed(2)}:1)',
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
          expect(contrast(aplati, cpi.inputBackground), lessThan(3.0));
          expect(cpi.inputBorder, isNot(cpi.borderSubtle));
        },
      );

      test('$coque : la piste de progression du démarrage tient 3:1', () {
        final Color piste = cpiTrackOn(scheme.primary);
        expect(contrast(piste, scheme.primary), greaterThanOrEqualTo(3.0));
        expect(contrast(piste, scheme.onPrimary), greaterThanOrEqualTo(3.0));
      });

      test(
        '$coque : le dégradé de connexion reste lisible sur ses trois arrêts',
        () {
          final List<Color> stops = cpiBrandGradient(scheme.primary);
          expect(stops, hasLength(3));
          expect(stops[1], scheme.primary);
          for (final Color stop in stops) {
            expect(
              contrast(scheme.onPrimary, stop),
              greaterThanOrEqualTo(4.5),
              reason: '$coque : le texte de connexion passe sous AA',
            );
            expect(
              contrast(cpi.navForeground, stop),
              greaterThanOrEqualTo(4.5),
            );
          }
        },
      );
    }

    test(
      'la connexion ne peut plus rendre du bordeaux sous la coque CHUES',
      () {
        // Le dégradé était écrit en dur : #7B0A1B -> #630210 -> #48000A.
        final List<Color> cpi = cpiBrandGradient(AppTheme.colorScheme.primary);
        final List<Color> chues = cpiBrandGradient(
          AppTheme.chuesColorScheme.primary,
        );
        expect(cpi.toSet().intersection(chues.toSet()), isEmpty);
        expect(cpi, contains(const Color(0xFF630210)));
        expect(chues, isNot(contains(const Color(0xFF630210))));
      },
    );

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
