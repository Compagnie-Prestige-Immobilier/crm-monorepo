import 'dart:math' as math;

import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_colors.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/core/theme/cpi_typography.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Luminance relative WCAG 2.1.
double _luminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/// Ratio de contraste entre deux couleurs opaques.
double contrast(Color a, Color b) {
  final double la = _luminance(a);
  final double lb = _luminance(b);
  final double lighter = math.max(la, lb);
  final double darker = math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

void main() {
  const Color gold = Color(0xFFC8921A);
  const Color white = Color(0xFFFFFFFF);

  group('ColorScheme', () {
    final ColorScheme scheme = AppTheme.colorScheme;

    test('les rôles critiques portent les hex audités, pas ceux de fromSeed', () {
      // `ColorScheme.fromSeed` dérive un `primary` qui n'est PAS #630210 :
      // c'est précisément la raison de la surcharge explicite.
      expect(scheme.primary, const Color(0xFF630210));
      expect(scheme.onPrimary, const Color(0xFFFFFFFF));
      expect(scheme.surface, const Color(0xFFFAF7F7));
      expect(scheme.onSurface, const Color(0xFF1C0810));
      expect(scheme.surfaceContainerLowest, white);
      expect(scheme.error, const Color(0xFFB91C1C));
      expect(scheme.outline, const Color(0xFF6B4A52));
      expect(scheme.outlineVariant, const Color(0xFFECE1E2));
      expect(scheme.brightness, Brightness.light);
    });

    test('fromSeed seul ne produirait pas ces valeurs', () {
      final ColorScheme raw = ColorScheme.fromSeed(
        seedColor: AppTheme.seed,
        brightness: Brightness.light,
      );
      expect(
        raw.primary,
        isNot(const Color(0xFF630210)),
        reason:
            'si un jour l\'algorithme Material tombait juste, la surcharge '
            'deviendrait redondante — ce test le signalerait',
      );
    });

    test('aucun rôle de premier plan Material ne vaut l\'or décoratif', () {
      // #C8921A fait 2,77:1 sur blanc. S'il atterrissait dans un rôle « on… »
      // ou dans `tertiary`, Material s'en servirait comme couleur de texte.
      final List<Color> foregroundRoles = <Color>[
        scheme.onPrimary,
        scheme.onSecondary,
        scheme.onTertiary,
        scheme.onSurface,
        scheme.onSurfaceVariant,
        scheme.onError,
        scheme.onPrimaryContainer,
        scheme.onSecondaryContainer,
        scheme.onTertiaryContainer,
        scheme.onErrorContainer,
        scheme.primary,
        scheme.secondary,
        scheme.tertiary,
        scheme.outline,
      ];
      expect(foregroundRoles, isNot(contains(gold)));
    });

    test('tertiary est la déclinaison or lisible et passe AA', () {
      expect(scheme.tertiary, const Color(0xFF856011));
      expect(contrast(scheme.tertiary, white), greaterThanOrEqualTo(4.5));
    });

    test('les paires texte/fond annoncées par le document tiennent AA', () {
      expect(contrast(scheme.onSurface, scheme.surface), greaterThanOrEqualTo(4.5));
      expect(contrast(scheme.onPrimary, scheme.primary), greaterThanOrEqualTo(4.5));
      expect(
        contrast(scheme.onSurfaceVariant, scheme.surfaceContainerLowest),
        greaterThanOrEqualTo(4.5),
      );
      expect(contrast(scheme.onError, scheme.error), greaterThanOrEqualTo(4.5));
      expect(
        contrast(scheme.onErrorContainer, scheme.errorContainer),
        greaterThanOrEqualTo(4.5),
      );
      // `outline` sert de bordure de champ : seuil non textuel, 3:1.
      expect(contrast(scheme.outline, scheme.surface), greaterThanOrEqualTo(3.0));
    });

    group('texte posé sur le bordeaux plein', () {
      // L'écran de connexion est bordeaux plein bord à bord. TOUT ce qui s'y
      // écrit se mesure contre `primary`, et pas contre une surface claire.
      const CpiColors cpi = CpiColors.light;

      test('le rouge d\'erreur standard NE PASSE PAS sur bordeaux', () {
        // Le bug constaté : `colorScheme.error` posé à même le fond de l'écran
        // de connexion. 2,10:1, illisible. Ce test fige la raison d'être de
        // `destructiveOnDark` : si quelqu'un rebascule sur `error`, il casse.
        expect(contrast(scheme.error, scheme.primary), lessThan(3.0));
      });

      test('destructiveOnDark passe AA sur bordeaux', () {
        expect(
          contrast(cpi.destructiveOnDark, scheme.primary),
          greaterThanOrEqualTo(4.5),
        );
      });

      test('les autres couleurs de l\'écran de connexion passent AA', () {
        for (final (String name, Color color) in <(String, Color)>[
          ('blanc', const Color(0xFFFFFFFF)),
          ('navForeground', cpi.navForeground),
          ('accentOnDark', cpi.accentOnDark),
        ]) {
          expect(
            contrast(color, scheme.primary),
            greaterThanOrEqualTo(4.5),
            reason: '$name doit rester lisible sur bordeaux',
          );
        }
      });

      test('sur bordeaux, l\'or de texte reste accentOnDark', () {
        // L'or de surface #C8921A atteint par accident 4,90:1 sur bordeaux,
        // mais il n'est pas la déclinaison de texte : docs/design.md §2.3 en
        // désigne UNE seule par fond, et sur bordeaux c'est `accent-on-dark`.
        // S'en remettre au chiffre plutôt qu'au token conduirait à réintroduire
        // #C8921A comme texte ailleurs, où il fait 2,77:1.
        expect(
          contrast(cpi.accentOnDark, scheme.primary),
          greaterThan(contrast(cpi.accent, scheme.primary)),
        );
      });
    });
  });

  group('CpiColors', () {
    const CpiColors cpi = CpiColors.light;

    test('l\'or décoratif est bien exposé, et seulement comme surface', () {
      expect(cpi.accent, gold);
      // Confirmation du chiffre qui motive toute la règle.
      expect(contrast(gold, white), lessThan(3.0));
      // Ce qu'on pose DESSUS passe largement.
      expect(contrast(cpi.accentForeground, cpi.accent), greaterThanOrEqualTo(4.5));
    });

    test('accentText est la seule déclinaison or utilisable en texte', () {
      expect(cpi.accentText, const Color(0xFF856011));
      expect(contrast(cpi.accentText, white), greaterThanOrEqualTo(4.5));
      expect(contrast(cpi.accentText, cpi.accentSurface), greaterThanOrEqualTo(4.5));
    });

    test('accentOnDark est lisible sur bordeaux', () {
      expect(cpi.accentOnDark, const Color(0xFFFFC65A));
      expect(
        contrast(cpi.accentOnDark, const Color(0xFF630210)),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('les statuts passent AA sur leur surface', () {
      expect(contrast(cpi.success, cpi.successSurface), greaterThanOrEqualTo(4.5));
      expect(contrast(cpi.warning, cpi.warningSurface), greaterThanOrEqualTo(4.5));
      expect(contrast(cpi.info, cpi.infoSurface), greaterThanOrEqualTo(4.5));
    });

    test('cinq couleurs de série, pas une de plus', () {
      expect(cpi.chartSeries, hasLength(5));
      expect(cpi.chartSeries.toSet(), hasLength(5));
      expect(cpi.chart1, const Color(0xFF630210));
      expect(cpi.chart5, const Color(0xFF8B5CF6));
    });

    test('chaque statut de synchronisation a sa couleur', () {
      for (final String status in <String>[
        'draft',
        'pending',
        'syncing',
        'synced',
        'conflict',
        'failed',
        'blocked',
      ]) {
        expect(cpi.colorForSyncStatus(status), isA<Color>());
      }
      expect(cpi.colorForSyncStatus('synced'), cpi.success);
      expect(cpi.colorForSyncStatus('failed'), cpi.syncFailed);
    });

    test('copyWith et lerp respectent le contrat ThemeExtension', () {
      final CpiColors changed = cpi.copyWith(success: const Color(0xFF000000));
      expect(changed.success, const Color(0xFF000000));
      expect(changed.accentText, cpi.accentText);
      // lerp interpole champ par champ et n'invente pas d'autre valeur.
      expect(cpi.lerp(changed, 0).success, cpi.success);
      expect(cpi.lerp(changed, 1).success, const Color(0xFF000000));
      expect(cpi.lerp(changed, 1).accentText, cpi.accentText);
      expect(cpi.lerp(null, 0.5), same(cpi));
    });
  });

  group('ThemeData', () {
    final ThemeData theme = AppTheme.light;

    test('l\'extension de couleurs est accessible via le thème', () {
      expect(theme.extension<CpiColors>(), isNotNull);
      expect(theme.extension<CpiColors>()!.accentText, const Color(0xFF856011));
    });

    test('les tokens de mouvement sont ceux du document', () {
      final CpiMotion motion = theme.extension<CpiMotion>()!;
      expect(motion.micro, const Duration(milliseconds: 150));
      expect(motion.component, const Duration(milliseconds: 220));
      expect(motion.screen, const Duration(milliseconds: 300));
      expect(motion.easeOut, const Cubic(0.22, 1, 0.36, 1));
      expect(motion.easeSpring, const Cubic(0.34, 1.56, 0.64, 1));
    });

    test('les polices empaquetées sont celles déclarées', () {
      expect(theme.textTheme.headlineSmall?.fontFamily, CpiFonts.display);
      expect(theme.textTheme.bodyMedium?.fontFamily, CpiFonts.body);
      expect(theme.textTheme.labelLarge?.fontFamily, CpiFonts.body);
      expect(CpiFonts.display, 'Bricolage Grotesque');
      expect(CpiFonts.body, 'Plus Jakarta Sans');
    });

    test('les titres portent le resserrement de -0.02em', () {
      final TextStyle title = theme.textTheme.titleLarge!;
      expect(title.letterSpacing, closeTo(title.fontSize! * -0.02, 0.001));
      expect(theme.textTheme.bodyMedium?.letterSpacing, isNull);
    });

    test('aucune élévation Material sur les cartes', () {
      expect(theme.cardTheme.elevation, 0);
      expect(theme.appBarTheme.elevation, 0);
      expect(theme.appBarTheme.scrolledUnderElevation, 0);
    });

    test('les boutons couvrent la cible tactile de 44 px', () {
      final ButtonStyle? filled = theme.filledButtonTheme.style;
      final Size? min = filled?.minimumSize?.resolve(<WidgetState>{});
      expect(min!.height, greaterThanOrEqualTo(kCpiMinTouchTarget));
      final Size? outlined = theme.outlinedButtonTheme.style?.minimumSize?.resolve(
        <WidgetState>{},
      );
      expect(outlined!.height, greaterThanOrEqualTo(kCpiMinTouchTarget));
    });
  });

  group('CpiMotion', () {
    testWidgets('les durées tombent à zéro si les animations sont désactivées', (
      WidgetTester tester,
    ) async {
      late CpiMotion normal;
      late CpiMotion reduced;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (BuildContext context) {
              normal = CpiMotion.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: MediaQuery(
            data: const MediaQueryData(disableAnimations: true),
            child: Builder(
              builder: (BuildContext context) {
                reduced = CpiMotion.of(context);
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );

      expect(normal.screen, const Duration(milliseconds: 300));
      expect(reduced.screen, Duration.zero);
      expect(reduced.micro, Duration.zero);
      // La logique ne change pas : les courbes restent identiques.
      expect(reduced.easeOut, normal.easeOut);
    });
  });
}
