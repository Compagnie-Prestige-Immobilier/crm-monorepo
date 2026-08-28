import 'package:cpi_go/core/feedback/feedback.dart';
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
      expect(
        container().read(displaySettingsProvider).textScale,
        CpiTextScale.normal,
      );
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

    test('les CINQ tailles survivent au redémarrage', () async {
      // Les noms sont la clé de persistance : en ajouter deux ne doit pas
      // déplacer les trois déjà enregistrées sur les téléphones du parc.
      for (final CpiTextScale scale in CpiTextScale.values) {
        await container()
            .read(displaySettingsProvider.notifier)
            .setTextScale(scale);
        expect(container().read(displaySettingsProvider).textScale, scale);
      }
      expect(CpiTextScale.values.map((CpiTextScale s) => s.name), <String>[
        'tresPetit',
        'petit',
        'normal',
        'large',
        'extraLarge',
      ]);
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
      expect(
        container().read(displaySettingsProvider).textScale,
        CpiTextScale.normal,
      );
    });
  });

  group('vibrations et sons', () {
    test('les deux sont allumés par défaut', () {
      final DisplaySettings display = container().read(displaySettingsProvider);
      expect(display.haptiques, isTrue);
      expect(display.sons, isTrue);
    });

    test('les coupures SURVIVENT au redémarrage', () async {
      final DisplaySettingsController reglages = container().read(
        displaySettingsProvider.notifier,
      );
      await reglages.setHaptiques(value: false);
      await reglages.setSons(value: false);

      final DisplaySettings apres = container().read(displaySettingsProvider);
      expect(apres.haptiques, isFalse);
      expect(apres.sons, isFalse);
    });

    test('une valeur inconnue en préférences retombe sur allumé', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'display.haptiques': 'peut-être',
      });
      prefs = await SharedPreferences.getInstance();
      expect(container().read(displaySettingsProvider).haptiques, isTrue);
    });

    test('couper les vibrations ne touche pas aux animations', () async {
      // Deux plaintes différentes : « ça bouge trop » et « ça vibre trop ».
      await container()
          .read(displaySettingsProvider.notifier)
          .setHaptiques(value: false);
      expect(container().read(displaySettingsProvider).reduceMotion, isFalse);
    });

    test('le réglage est POUSSÉ au service que le kit appelle', () async {
      // Le kit est Material pur : il lit `CpiFeedbackService.instance`, jamais
      // ce provider. Sans cette poussée, l'interrupteur ne coupe rien.
      final CpiFeedbackService reel = CpiFeedbackService.instance;
      final _ServiceEspion espion = _ServiceEspion();
      CpiFeedbackService.instance = espion;
      addTearDown(() => CpiFeedbackService.instance = reel);

      final DisplaySettingsController reglages = container().read(
        displaySettingsProvider.notifier,
      );
      expect(espion.recus.last, (haptiques: true, sons: true));

      await reglages.setSons(value: false);
      expect(espion.recus.last, (haptiques: true, sons: false));

      await reglages.setHaptiques(value: false);
      expect(espion.recus.last, (haptiques: false, sons: false));
    });
  });

  group('thème', () {
    test('le défaut est Système', () {
      expect(
        container().read(displaySettingsProvider).themeMode,
        ThemeMode.system,
      );
    });

    test('le choix SURVIT au redémarrage', () async {
      await container()
          .read(displaySettingsProvider.notifier)
          .setThemeMode(ThemeMode.dark);

      expect(
        container().read(displaySettingsProvider).themeMode,
        ThemeMode.dark,
      );
    });

    test('une valeur inconnue en préférences retombe sur Système', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'display.themeMode': 'inconnu',
      });
      prefs = await SharedPreferences.getInstance();
      expect(
        container().read(displaySettingsProvider).themeMode,
        ThemeMode.system,
      );
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

    test('la part système reste entre 1,0 et le plafond', () {
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

    test('« Très petit » rétrécit vraiment, et pas plus bas que 0,85', () {
      // Le plancher du total est le plus petit choix de l'app : un Android
      // réglé plus petit que 1,0 ne rétrécit rien de plus.
      expect(
        resolveTextScaleFactor(
          system: TextScaler.noScaling,
          choice: CpiTextScale.tresPetit,
        ),
        closeTo(0.85, 0.001),
      );
      expect(
        resolveTextScaleFactor(
          system: const TextScaler.linear(0.5),
          choice: CpiTextScale.tresPetit,
        ),
        closeTo(0.85, 0.001),
      );
      expect(
        resolveTextScaleFactor(
          system: TextScaler.noScaling,
          choice: CpiTextScale.petit,
        ),
        closeTo(0.92, 0.001),
      );
    });

    test('le corps reste lisible au plus petit réglage', () {
      // WCAG 1.4.4 : rétrécir est un choix, l'illisibilité n'en est pas un.
      // 18 × 0,85 = 15,3, au-dessus du plancher Material 3 de 14.
      final double corps =
          CpiTypography.minBodySize *
          resolveTextScaleFactor(
            system: TextScaler.noScaling,
            choice: CpiTextScale.tresPetit,
          );
      expect(corps, greaterThanOrEqualTo(15));
    });

    test(
      'le plafond laisse passer « Très grand » par-dessus le maximum système',
      () {
        // C'est la raison d'être de l'élargissement de 1,3 à 1,8 : sans lui,
        // choisir « Très grand » sur un téléphone déjà réglé à 1,3 ne changeait
        // strictement rien.
        final double f = resolveTextScaleFactor(
          system: const TextScaler.linear(1.3),
          choice: CpiTextScale.extraLarge,
        );
        expect(f, greaterThan(kCpiMaxSystemTextScale));
      },
    );
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
          reason:
              'un corps de texte sous 14 sp est illisible sur un vrai écran',
        );
      }
    });

    test('aucun libellé ne descend sous 12 sp', () {
      for (final TextStyle? style in <TextStyle?>[
        text.labelLarge,
        text.labelMedium,
        text.labelSmall,
      ]) {
        expect(
          style!.fontSize,
          greaterThanOrEqualTo(CpiTypography.minLabelSize),
        );
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

class _ServiceEspion extends CpiFeedbackService {
  final List<({bool haptiques, bool sons})> recus =
      <({bool haptiques, bool sons})>[];

  @override
  void appliquerReglages({required bool haptiques, required bool sons}) {
    recus.add((haptiques: haptiques, sons: sons));
    super.appliquerReglages(haptiques: haptiques, sons: sons);
  }
}
