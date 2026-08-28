import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_colors.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/core/theme/cpi_typography.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/contrast_helpers.dart';

void main() {
  const Color gold = Color(0xFFC8921A);
  const Color white = Color(0xFFFFFFFF);

  group('ColorScheme', () {
    final ColorScheme scheme = AppTheme.colorScheme;

    test(
      'les rôles critiques portent les hex audités, pas ceux de fromSeed',
      () {
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
      },
    );

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
            'deviendrait redondante : ce test le signalerait',
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
      expect(contrastRatio(scheme.tertiary, white), greaterThanOrEqualTo(4.5));
    });

    test('les paires texte/fond annoncées par le document tiennent AA', () {
      expect(
        contrastRatio(scheme.onSurface, scheme.surface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(scheme.onPrimary, scheme.primary),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(scheme.onSurfaceVariant, scheme.surfaceContainerLowest),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(scheme.onError, scheme.error),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(scheme.onErrorContainer, scheme.errorContainer),
        greaterThanOrEqualTo(4.5),
      );
      // `outline` sert de bordure de champ : seuil non textuel, 3:1.
      expect(
        contrastRatio(scheme.outline, scheme.surface),
        greaterThanOrEqualTo(3.0),
      );
    });

    group('texte posé sur le bordeaux plein', () {
      // L'écran de connexion est bordeaux plein bord à bord. TOUT ce qui s'y
      // écrit se mesure contre `primary`, et pas contre une surface claire.
      const CpiColors cpi = CpiColors.light;

      test('le rouge d\'erreur standard NE PASSE PAS sur bordeaux', () {
        // Le bug constaté : `colorScheme.error` posé à même le fond de l'écran
        // de connexion. 2,10:1, illisible. Ce test fige la raison d'être de
        // `destructiveOnDark` : si quelqu'un rebascule sur `error`, il casse.
        expect(contrastRatio(scheme.error, scheme.primary), lessThan(3.0));
      });

      test('destructiveOnDark passe AA sur bordeaux', () {
        expect(
          contrastRatio(cpi.destructiveOnDark, scheme.primary),
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
            contrastRatio(color, scheme.primary),
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
          contrastRatio(cpi.accentOnDark, scheme.primary),
          greaterThan(contrastRatio(cpi.accent, scheme.primary)),
        );
      });
    });
  });

  group('CpiColors', () {
    const CpiColors cpi = CpiColors.light;

    test('l\'or décoratif est bien exposé, et seulement comme surface', () {
      expect(cpi.accent, gold);
      // Confirmation du chiffre qui motive toute la règle.
      expect(contrastRatio(gold, white), lessThan(3.0));
      // Ce qu'on pose DESSUS passe largement.
      expect(
        contrastRatio(cpi.accentForeground, cpi.accent),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('accentText est la seule déclinaison or utilisable en texte', () {
      expect(cpi.accentText, const Color(0xFF856011));
      expect(contrastRatio(cpi.accentText, white), greaterThanOrEqualTo(4.5));
      expect(
        contrastRatio(cpi.accentText, cpi.accentSurface),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('accentOnDark est lisible sur bordeaux', () {
      expect(cpi.accentOnDark, const Color(0xFFFFC65A));
      expect(
        contrastRatio(cpi.accentOnDark, const Color(0xFF630210)),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('les statuts passent AA sur leur surface', () {
      expect(
        contrastRatio(cpi.success, cpi.successSurface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(cpi.warning, cpi.warningSurface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(cpi.info, cpi.infoSurface),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('cinq couleurs de série, pas une de plus', () {
      expect(cpi.chartSeries, hasLength(5));
      expect(cpi.chartSeries.toSet(), hasLength(5));
      expect(cpi.chart1, const Color(0xFF630210));
      expect(cpi.chart5, const Color(0xFF8B5CF6));
    });

    test('chaque statut de synchronisation a SA couleur, distincte', () {
      final Map<String, Color> seen = <String, Color>{};
      for (final String status in <String>[
        'draft',
        'pending',
        'syncing',
        'synced',
        'conflict',
        'failed',
        'blocked',
      ]) {
        // `isA<Color>()` était garanti par la signature : l'assertion ne
        // pouvait pas échouer, même si tous les statuts rendaient la même
        // couleur. Ce qui compte, c'est qu'ils se DISTINGUENT : la couleur est
        // le seul signal de la liste, et deux statuts confondus rendent
        // « en conflit » indiscernable de « envoyé ».
        seen[status] = cpi.colorForSyncStatus(status);
      }
      // `draft`, `pending` et `blocked` partagent DÉLIBÉRÉMENT la même teinte
      // neutre : ce sont trois nuances d'« en attente », et les distinguer à
      // l'œil n'apprendrait rien à l'utilisateur. Les cinq FAMILLES, elles,
      // doivent se distinguer : une liste où « en conflit » et « en échec »
      // portent la même couleur ne dit plus laquelle des deux actions prendre.
      expect(
        <Color>{
          seen['draft']!,
          seen['syncing']!,
          seen['synced']!,
          seen['conflict']!,
          seen['failed']!,
        },
        hasLength(5),
        reason:
            'deux familles qui partagent une couleur ne se distinguent plus',
      );
      expect(seen['pending'], seen['draft']);
      expect(seen['blocked'], seen['draft']);
      expect(cpi.colorForSyncStatus('synced'), cpi.success);
      expect(cpi.colorForSyncStatus('failed'), cpi.syncFailed);
      expect(cpi.colorForSyncStatus('conflict'), cpi.syncConflict);
      // Un statut inconnu ne doit pas se confondre avec un statut sain.
      expect(cpi.colorForSyncStatus('inconnu'), isNot(cpi.success));
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
      expect(CpiFonts.display, 'Plus Jakarta Sans');
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
      final Size? outlined = theme.outlinedButtonTheme.style?.minimumSize
          ?.resolve(<WidgetState>{});
      expect(outlined!.height, greaterThanOrEqualTo(kCpiMinTouchTarget));
    });
  });

  /// La coque CHUES porte l'identité de l'Union des Enseignants du Senegal :
  /// un « UES » noir massif souligne d'un filet bleu. Le bleu tient les aplats
  /// et le noir la barre de navigation ; le bordeaux CPI n'y entre pas.
  group('Palette CHUES', () {
    final ColorScheme scheme = AppTheme.chuesColorScheme;
    const CpiColors cpi = CpiColors.chues;

    test('le bleu profond et le noir sont ceux du logo', () {
      // #0201E9 est la teinte dominante mesurée sur `assets/brand/chues-logo.png`
      // (histogramme). Toute autre valeur n'est plus « leur » bleu.
      expect(scheme.primary, const Color(0xFF0201E9));
      expect(scheme.onSurface, const Color(0xFF0B0D12));
      expect(cpi.navSurface, const Color(0xFF0B0D12));
      expect(scheme.primary, isNot(AppTheme.colorScheme.primary));
    });

    test('les paires texte/fond de la coque tiennent AA', () {
      for (final (String name, Color fg, Color bg) in <(String, Color, Color)>[
        ('onSurface', scheme.onSurface, scheme.surface),
        ('onPrimary', scheme.onPrimary, scheme.primary),
        (
          'onSurfaceVariant sur carte',
          scheme.onSurfaceVariant,
          scheme.surfaceContainerLowest,
        ),
        ('onSurfaceVariant sur fond', scheme.onSurfaceVariant, scheme.surface),
        (
          'onSecondaryContainer',
          scheme.onSecondaryContainer,
          scheme.secondaryContainer,
        ),
        (
          'onTertiaryContainer',
          scheme.onTertiaryContainer,
          scheme.tertiaryContainer,
        ),
        ('onErrorContainer', scheme.onErrorContainer, scheme.errorContainer),
        ('onError', scheme.onError, scheme.error),
        ('navForeground', cpi.navForeground, cpi.navSurface),
        ('navActiveForeground', cpi.navActiveForeground, cpi.navActive),
        ('accentText sur carte', cpi.accentText, scheme.surfaceContainerLowest),
        ('accentText sur sa surface', cpi.accentText, cpi.accentSurface),
        ('accentForeground', cpi.accentForeground, cpi.accent),
      ]) {
        expect(
          contrastRatio(fg, bg),
          greaterThanOrEqualTo(4.5),
          reason: '$name est illisible sur la coque CHUES',
        );
      }
      expect(
        contrastRatio(scheme.outline, scheme.surface),
        greaterThanOrEqualTo(3.0),
      );
    });

    test('sur le bleu plein, le rouge d\'erreur cede la place', () {
      // Meme piege que sur le bordeaux : `colorScheme.error` pose a meme un
      // aplat de marque tombe sous 3:1 et devient illisible.
      expect(contrastRatio(scheme.error, scheme.primary), lessThan(3.0));
      expect(
        contrastRatio(cpi.destructiveOnDark, scheme.primary),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(cpi.accentOnDark, scheme.primary),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(cpi.accentOnDark, scheme.primary),
        greaterThan(contrastRatio(cpi.accent, scheme.primary)),
      );
    });

    test('les statuts passent AA sur leur surface', () {
      expect(
        contrastRatio(cpi.success, cpi.successSurface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(cpi.warning, cpi.warningSurface),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        contrastRatio(cpi.info, cpi.infoSurface),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('cinq series et cinq familles de synchronisation se distinguent', () {
      expect(cpi.chartSeries.toSet(), hasLength(5));
      expect(<Color>{
        cpi.syncDraft,
        cpi.syncSyncing,
        cpi.syncSynced,
        cpi.syncConflict,
        cpi.syncFailed,
      }, hasLength(5));
    });

    test('chaque coque emporte SON extension de couleurs', () {
      expect(AppTheme.chues.extension<CpiColors>(), same(CpiColors.chues));
      expect(AppTheme.light.extension<CpiColors>(), same(CpiColors.light));
    });
  });

  /// Mode sombre. Les neutres des deux coques viennent du même registre sobre ;
  /// c'est la teinte de marque qui doit continuer à les séparer.
  group('Palettes sombres', () {
    for (final (String coque, ColorScheme scheme, CpiColors cpi)
        in <(String, ColorScheme, CpiColors)>[
          ('CPI', AppTheme.darkColorScheme, CpiColors.dark),
          ('CHUES', AppTheme.chuesDarkColorScheme, CpiColors.chuesDark),
        ]) {
      test('$coque sombre : le schéma est réellement sombre', () {
        expect(scheme.brightness, Brightness.dark);
        expect(
          relativeLuminance(scheme.surface),
          lessThan(relativeLuminance(scheme.onSurface)),
        );
        expect(
          contrastRatio(scheme.surface, const Color(0xFF000000)),
          lessThan(1.6),
          reason: '$coque : le fond doit rester quasi noir',
        );
      });

      test('$coque sombre : aucun rôle de premier plan ne vaut l\'or', () {
        expect(<Color>[
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
        ], isNot(contains(gold)));
      });

      test('$coque sombre : les paires texte/fond tiennent AA', () {
        for (final (String name, Color fg, Color bg)
            in <(String, Color, Color)>[
              ('onSurface', scheme.onSurface, scheme.surface),
              (
                'onSurface sur carte',
                scheme.onSurface,
                scheme.surfaceContainerLowest,
              ),
              (
                'onSurface sur conteneur',
                scheme.onSurface,
                scheme.surfaceContainer,
              ),
              (
                'onSurface sur le plus clair',
                scheme.onSurface,
                scheme.surfaceBright,
              ),
              ('onPrimary', scheme.onPrimary, scheme.primary),
              (
                'onSurfaceVariant sur carte',
                scheme.onSurfaceVariant,
                scheme.surfaceContainerLowest,
              ),
              (
                'onSurfaceVariant sur fond',
                scheme.onSurfaceVariant,
                scheme.surface,
              ),
              (
                'onSurfaceVariant sur muted',
                scheme.onSurfaceVariant,
                scheme.surfaceContainerHigh,
              ),
              (
                'onPrimaryContainer',
                scheme.onPrimaryContainer,
                scheme.primaryContainer,
              ),
              ('onSecondary', scheme.onSecondary, scheme.secondary),
              (
                'onSecondaryContainer',
                scheme.onSecondaryContainer,
                scheme.secondaryContainer,
              ),
              ('onTertiary', scheme.onTertiary, scheme.tertiary),
              (
                'onTertiaryContainer',
                scheme.onTertiaryContainer,
                scheme.tertiaryContainer,
              ),
              ('onError', scheme.onError, scheme.error),
              (
                'onErrorContainer',
                scheme.onErrorContainer,
                scheme.errorContainer,
              ),
              (
                'onInverseSurface',
                scheme.onInverseSurface,
                scheme.inverseSurface,
              ),
              ('tertiary sur fond', scheme.tertiary, scheme.surface),
              ('primary sur fond', scheme.primary, scheme.surface),
              ('error sur fond', scheme.error, scheme.surface),
              ('navForeground', cpi.navForeground, cpi.navSurface),
              ('navActiveForeground', cpi.navActiveForeground, cpi.navActive),
              (
                'accentText sur carte',
                cpi.accentText,
                scheme.surfaceContainerLowest,
              ),
              ('accentText sur sa surface', cpi.accentText, cpi.accentSurface),
              ('accentForeground', cpi.accentForeground, cpi.accent),
            ]) {
          expect(
            contrastRatio(fg, bg),
            greaterThanOrEqualTo(4.5),
            reason: '$coque sombre : $name est illisible',
          );
        }
        // `outline` reste une bordure : seuil non textuel.
        expect(
          contrastRatio(scheme.outline, scheme.surface),
          greaterThanOrEqualTo(3.0),
        );
        expect(
          contrastRatio(scheme.outline, scheme.surfaceContainerLowest),
          greaterThanOrEqualTo(3.0),
        );
      });

      test('$coque sombre : le rouge d\'erreur cède la place sur l\'aplat', () {
        // Même piège qu'en clair, à l'envers : l'aplat de marque est désormais
        // la teinte CLAIRE, et `error` y disparaît tout autant.
        expect(contrastRatio(scheme.error, scheme.primary), lessThan(3.0));
        expect(
          contrastRatio(scheme.onPrimary, scheme.primary),
          greaterThanOrEqualTo(4.5),
        );
      });

      test('$coque sombre : les déclinaisons « on dark » servent le fond', () {
        // En sombre, le fond quasi noir EST le fond de marque : c'est là que
        // `destructiveOnDark` et `accentOnDark` sont attendus.
        for (final Color fond in <Color>[
          scheme.surface,
          scheme.surfaceContainerLowest,
          cpi.navSurface,
        ]) {
          expect(
            contrastRatio(cpi.destructiveOnDark, fond),
            greaterThanOrEqualTo(4.5),
          );
          expect(
            contrastRatio(cpi.accentOnDark, fond),
            greaterThanOrEqualTo(4.5),
          );
        }
        expect(
          contrastRatio(cpi.accentOnDark, scheme.surface),
          greaterThan(contrastRatio(cpi.accent, scheme.surface)),
          reason:
              '$coque : accentOnDark reste LA déclinaison de texte sur sombre',
        );
        expect(
          contrastRatio(cpi.destructiveOnDark, scheme.surface),
          greaterThan(contrastRatio(scheme.error, scheme.surface)),
        );
      });

      test('$coque sombre : les statuts passent AA sur leur surface', () {
        expect(
          contrastRatio(cpi.success, cpi.successSurface),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          contrastRatio(cpi.warning, cpi.warningSurface),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          contrastRatio(cpi.info, cpi.infoSurface),
          greaterThanOrEqualTo(4.5),
        );
        for (final Color statut in <Color>[
          cpi.success,
          cpi.warning,
          cpi.info,
        ]) {
          expect(
            contrastRatio(statut, scheme.surface),
            greaterThanOrEqualTo(4.5),
          );
          expect(
            contrastRatio(statut, scheme.surfaceContainerLowest),
            greaterThanOrEqualTo(4.5),
          );
        }
        expect(
          contrastRatio(cpi.onSuccess, cpi.success),
          greaterThanOrEqualTo(4.5),
        );
        expect(
          contrastRatio(cpi.onWarning, cpi.warning),
          greaterThanOrEqualTo(4.5),
        );
        expect(contrastRatio(cpi.onInfo, cpi.info), greaterThanOrEqualTo(4.5));
      });

      test('$coque sombre : séries et familles de sync restent lisibles', () {
        expect(cpi.chartSeries, hasLength(5));
        expect(cpi.chartSeries.toSet(), hasLength(5));
        expect(<Color>{
          cpi.syncDraft,
          cpi.syncSyncing,
          cpi.syncSynced,
          cpi.syncConflict,
          cpi.syncFailed,
        }, hasLength(5));
        expect(cpi.syncPending, cpi.syncDraft);
        expect(cpi.syncBlocked, cpi.syncDraft);
        // Une couleur de série est un aplat : 3:1 suffit (WCAG 1.4.11).
        for (final Color c in <Color>[
          ...cpi.chartSeries,
          cpi.syncDraft,
          cpi.syncSyncing,
          cpi.syncSynced,
          cpi.syncConflict,
          cpi.syncFailed,
        ]) {
          expect(contrastRatio(c, scheme.surface), greaterThanOrEqualTo(3.0));
          expect(
            contrastRatio(c, scheme.surfaceContainerLowest),
            greaterThanOrEqualTo(3.0),
          );
        }
      });
    }

    test('la teinte de marque survit au passage en sombre', () {
      double hue(Color c) => HSLColor.fromColor(c).hue;
      double sat(Color c) => HSLColor.fromColor(c).saturation;
      double ecart(double a, double b) {
        final double d = (a - b).abs() % 360;
        return d > 180 ? 360 - d : d;
      }

      final Color cpiDark = AppTheme.darkColorScheme.primary;
      final Color chuesDark = AppTheme.chuesDarkColorScheme.primary;

      expect(ecart(hue(cpiDark), hue(AppTheme.seed)), lessThan(20));
      expect(ecart(hue(chuesDark), hue(AppTheme.chuesSeed)), lessThan(20));
      // Le garde-fou du brief : les deux coques ne doivent pas converger vers
      // le même gris sur noir.
      expect(sat(cpiDark), greaterThan(0.25));
      expect(sat(chuesDark), greaterThan(0.25));
      expect(ecart(hue(cpiDark), hue(chuesDark)), greaterThan(60));
    });

    test('le sombre ne recycle aucun aplat du clair', () {
      expect(AppTheme.darkColorScheme.primary, isNot(AppTheme.seed));
      expect(AppTheme.chuesDarkColorScheme.primary, isNot(AppTheme.chuesSeed));
      expect(
        AppTheme.darkColorScheme.surface,
        isNot(AppTheme.colorScheme.surface),
      );
      expect(
        AppTheme.chuesDarkColorScheme.surface,
        isNot(AppTheme.chuesColorScheme.surface),
      );
      expect(CpiColors.dark.navSurface, isNot(CpiColors.light.navSurface));
      expect(CpiColors.chuesDark.navSurface, isNot(CpiColors.chues.navSurface));
    });

    test('les schémas clairs restent intacts', () {
      expect(AppTheme.colorScheme.primary, const Color(0xFF630210));
      expect(AppTheme.chuesColorScheme.primary, const Color(0xFF0201E9));
      expect(AppTheme.colorScheme.brightness, Brightness.light);
      expect(AppTheme.chuesColorScheme.brightness, Brightness.light);
    });

    test('les neutres sombres des deux coques sont du même registre', () {
      // Le brief impose un fond, une carte et un filet issus de la même famille
      // sobre : seule la marque doit varier.
      for (final (Color cpi, Color chues) in <(Color, Color)>[
        (
          AppTheme.darkColorScheme.surface,
          AppTheme.chuesDarkColorScheme.surface,
        ),
        (
          AppTheme.darkColorScheme.surfaceContainerLowest,
          AppTheme.chuesDarkColorScheme.surfaceContainerLowest,
        ),
        (
          AppTheme.darkColorScheme.outlineVariant,
          AppTheme.chuesDarkColorScheme.outlineVariant,
        ),
        (
          AppTheme.darkColorScheme.onSurfaceVariant,
          AppTheme.chuesDarkColorScheme.onSurfaceVariant,
        ),
      ]) {
        expect(
          contrastRatio(cpi, chues),
          lessThan(1.2),
          reason:
              'les neutres sombres doivent rester interchangeables à l\'œil',
        );
      }
    });

    test('copyWith et lerp tiennent aussi sur les instances sombres', () {
      const CpiColors cpi = CpiColors.dark;
      final CpiColors changed = cpi.copyWith(success: const Color(0xFF000000));
      expect(changed.success, const Color(0xFF000000));
      expect(changed.accentText, cpi.accentText);
      expect(cpi.lerp(changed, 1).success, const Color(0xFF000000));
      expect(cpi.lerp(null, 0.5), same(cpi));
    });
  });

  group('CpiMotion', () {
    testWidgets(
      'les durées tombent à zéro si les animations sont désactivées',
      (WidgetTester tester) async {
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
        expect(normal.stagger, const Duration(milliseconds: 40));
        expect(normal.figure, const Duration(milliseconds: 600));
        expect(reduced.screen, Duration.zero);
        expect(reduced.micro, Duration.zero);
        // Les deux jetons ajoutés doivent tomber comme les autres : une liste
        // qui se décale et un compteur qui défile SONT du mouvement.
        expect(reduced.stagger, Duration.zero);
        expect(reduced.figure, Duration.zero);
        // La logique ne change pas : les courbes restent identiques.
        expect(reduced.easeOut, normal.easeOut);
      },
    );
  });

  /// `FadeForwardsPageTransitionsBuilder` écrivait 450 ms dans le widget :
  /// « Réduire les animations » ne pouvait pas les couper.
  group('Transitions de page', () {
    test('la durée est celle du jeton d\'écran, aller et retour', () {
      for (final ThemeData theme in <ThemeData>[
        AppTheme.light,
        AppTheme.dark,
        AppTheme.chues,
        AppTheme.chuesDark,
      ]) {
        for (final TargetPlatform platform in <TargetPlatform>[
          TargetPlatform.android,
          TargetPlatform.iOS,
        ]) {
          final PageTransitionsBuilder builder =
              theme.pageTransitionsTheme.builders[platform]!;
          expect(builder.transitionDuration, CpiMotion.standard.screen);
          expect(
            builder.reverseTransitionDuration,
            CpiMotion.standard.component,
          );
        }
      }
    });

    test('les thèmes figés ne transitionnent plus du tout', () {
      for (final ThemeData theme in <ThemeData>[
        AppTheme.lightStill,
        AppTheme.darkStill,
        AppTheme.chuesStill,
        AppTheme.chuesDarkStill,
      ]) {
        for (final TargetPlatform platform in <TargetPlatform>[
          TargetPlatform.android,
          TargetPlatform.iOS,
        ]) {
          final PageTransitionsBuilder builder =
              theme.pageTransitionsTheme.builders[platform]!;
          expect(builder.transitionDuration, Duration.zero);
          expect(builder.reverseTransitionDuration, Duration.zero);
        }
      }
    });

    test('la variante figée reste une INSTANCE stable', () {
      // Le thème ForUI est mémorisé par instance de `ThemeData` : un
      // `copyWith` reconstruit à chaque image ferait fuir la table.
      expect(AppTheme.lightStill, same(AppTheme.lightStill));
      expect(AppTheme.lightStill, isNot(same(AppTheme.light)));
      expect(
        AppTheme.lightStill.colorScheme.primary,
        AppTheme.light.colorScheme.primary,
      );
    });

    testWidgets('l\'écran figé rend son enfant tel quel', (
      WidgetTester tester,
    ) async {
      final PageTransitionsBuilder fige = AppTheme
          .lightStill
          .pageTransitionsTheme
          .builders[TargetPlatform.android]!;
      final Widget enfant = Container();
      await tester.pumpWidget(
        Builder(
          builder: (BuildContext context) => fige.buildTransitions<void>(
            MaterialPageRoute<void>(builder: (BuildContext _) => enfant),
            context,
            const AlwaysStoppedAnimation<double>(0.5),
            const AlwaysStoppedAnimation<double>(0),
            enfant,
          ),
        ),
      );
      expect(find.byType(FadeTransition), findsNothing);
      expect(find.byType(SlideTransition), findsNothing);
    });
  });

  group('Chiffres tabulaires', () {
    test('les titres qui portent un compteur ne dansent pas', () {
      final TextTheme text = AppTheme.light.textTheme;
      for (final TextStyle? style in <TextStyle?>[
        text.headlineLarge,
        text.headlineMedium,
        text.headlineSmall,
      ]) {
        expect(
          style?.fontFeatures,
          contains(const FontFeature.tabularFigures()),
        );
      }
      // Le corps garde ses chiffres proportionnels : c'est du texte, pas un
      // tableau.
      expect(text.bodyMedium?.fontFeatures, isNull);
    });
  });
}
