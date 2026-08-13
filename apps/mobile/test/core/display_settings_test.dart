import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/settings/display_settings.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/core/theme/cpi_typography.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Réglages d'affichage : taille du texte et animations réduites.
void main() {
  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
  });

  ProviderContainer container() {
    final ProviderContainer c = ProviderContainer(
      overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
    );
    addTearDown(c.dispose);
    return c;
  }

  group('échelle de texte', () {
    test('le défaut est Normal', () {
      expect(container().read(displaySettingsProvider).textScale, CpiTextScale.normal);
    });

    test('le choix SURVIT au redémarrage', () async {
      await container()
          .read(displaySettingsProvider.notifier)
          .setTextScale(CpiTextScale.extraLarge);

      // Nouveau conteneur sur les MÊMES préférences : c'est ce que fait un
      // relancement de l'app.
      expect(
        container().read(displaySettingsProvider).textScale,
        CpiTextScale.extraLarge,
      );
    });

    test('« réduire les animations » survit aussi', () async {
      await container()
          .read(displaySettingsProvider.notifier)
          .setReduceMotion(value: true);
      expect(container().read(displaySettingsProvider).reduceMotion, isTrue);
    });

    test('une valeur inconnue en préférences retombe sur Normal', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'display.textScale': 'gigantesque',
      });
      prefs = await SharedPreferences.getInstance();
      expect(container().read(displaySettingsProvider).textScale, CpiTextScale.normal);
    });
  });

  group('resolveTextScaleFactor', () {
    test('le réglage de l\'app MULTIPLIE le réglage système', () {
      // Quelqu'un qui a déjà grossi le texte d'Android ne doit pas voir son
      // choix annulé par celui de l'app.
      final double f = resolveTextScaleFactor(
        system: const TextScaler.linear(1.2),
        choice: CpiTextScale.large,
      );
      expect(f, closeTo(1.2 * 1.15, 0.001));
    });

    test('le réglage système est borné avant multiplication', () {
      // Un téléphone à 2,0 ferait déborder les cartes ; on plafonne sa part à
      // 1,3, puis le choix de l'app s'applique par-dessus.
      final double f = resolveTextScaleFactor(
        system: const TextScaler.linear(2.0),
        choice: CpiTextScale.normal,
      );
      expect(f, closeTo(kCpiMaxSystemTextScale, 0.001));
    });

    test('le total ne descend jamais sous 1,0 ni au-dessus du plafond', () {
      expect(
        resolveTextScaleFactor(
          system: const TextScaler.linear(0.5),
          choice: CpiTextScale.normal,
        ),
        kCpiMinTextScale,
      );
      expect(
        resolveTextScaleFactor(
          system: const TextScaler.linear(2.0),
          choice: CpiTextScale.extraLarge,
        ),
        lessThanOrEqualTo(kCpiMaxTextScale),
      );
    });

    test('le plafond laisse passer « Très grand » par-dessus le maximum système', () {
      // C'est la raison d'être de l'élargissement de 1,3 à 1,8 : sans lui,
      // choisir « Très grand » sur un téléphone déjà réglé à 1,3 ne changeait
      // strictement rien.
      final double f = resolveTextScaleFactor(
        system: const TextScaler.linear(1.3),
        choice: CpiTextScale.extraLarge,
      );
      expect(f, greaterThan(kCpiMaxSystemTextScale));
    });
  });

  group('échelle typographique', () {
    final TextTheme text = CpiTypography.textTheme(const Color(0xFF1C0810));

    test('aucun rôle de corps ne descend sous le plancher Material 3', () {
      for (final TextStyle? style in <TextStyle?>[
        text.bodyLarge,
        text.bodyMedium,
        text.bodySmall,
      ]) {
        expect(
          style!.fontSize,
          greaterThanOrEqualTo(CpiTypography.minBodySize),
          reason: 'un corps de texte sous 14 sp est illisible sur un vrai écran',
        );
      }
    });

    test('aucun libellé ne descend sous 12 sp', () {
      for (final TextStyle? style in <TextStyle?>[
        text.labelLarge,
        text.labelMedium,
        text.labelSmall,
      ]) {
        expect(style!.fontSize, greaterThanOrEqualTo(CpiTypography.minLabelSize));
      }
    });

    test('l\'en-tête de section porte du corps ET de la graisse', () {
      // C'est la plainte d'origine sur Réglages : « PROFIL » à 11 sp maigre.
      expect(CpiTypography.sectionLabel.fontSize, greaterThanOrEqualTo(14));
      expect(CpiTypography.sectionLabel.fontWeight, FontWeight.w700);
    });
  });

  group('mouvement réduit', () {
    testWidgets('le réglage de l\'app ramène les durées à zéro', (
      WidgetTester tester,
    ) async {
      late CpiMotion observed;
      await tester.pumpWidget(
        MediaQuery(
          // Le réglage applicatif emprunte le chemin de code système : c'est
          // `disableAnimations` que la racine positionne.
          data: const MediaQueryData(disableAnimations: true),
          child: Builder(
            builder: (BuildContext context) {
              observed = CpiMotion.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(observed.micro, Duration.zero);
      expect(observed.component, Duration.zero);
      expect(observed.screen, Duration.zero);
    });

    testWidgets('sans le réglage, les durées sont celles de design.md §7', (
      WidgetTester tester,
    ) async {
      late CpiMotion observed;
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(),
          child: Builder(
            builder: (BuildContext context) {
              observed = CpiMotion.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(observed.micro, const Duration(milliseconds: 150));
      expect(observed.component, const Duration(milliseconds: 220));
      expect(observed.screen, const Duration(milliseconds: 300));
    });
  });
}
