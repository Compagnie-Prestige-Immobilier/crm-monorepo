import 'package:cpi_go/core/feedback/feedback.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:cpi_go/ui/widgets/cpi_pressable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Enregistre ce que le kit demande, sans toucher ni au vibreur ni à l'audio.
class _FauxRetours implements CpiFeedbackService {
  final List<CpiFeedback> joues = <CpiFeedback>[];

  @override
  void jouer(CpiFeedback retour) => joues.add(retour);

  @override
  void tap() => jouer(CpiFeedback.tap);

  @override
  void choix() => jouer(CpiFeedback.choix);

  @override
  void etape() => jouer(CpiFeedback.etape);

  @override
  void succes() => jouer(CpiFeedback.succes);

  @override
  void echec() => jouer(CpiFeedback.echec);

  @override
  void rappel() => jouer(CpiFeedback.rappel);

  @override
  void appliquerReglages({required bool haptiques, required bool sons}) {}

  @override
  Future<void> preparer() async {}

  @override
  Future<void> jouerLeSon(CpiFeedback retour, String asset) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Contrat de la bibliothèque `Cpi*` : chaque primitive se monte dans les
/// quatre thèmes (CPI/CHUES × clair/sombre), sans dépendre d'un `FTheme`
/// installé plus haut dans l'arbre.
void main() {
  final Map<String, ThemeData> themes = <String, ThemeData>{
    'CPI clair': AppTheme.light,
    'CPI sombre': AppTheme.dark,
    'CHUES clair': AppTheme.chues,
    'CHUES sombre': AppTheme.chuesDark,
  };

  Future<void> monte(
    WidgetTester tester,
    ThemeData theme,
    Widget child, {
    bool nu = false,
    // La roue de chargement tourne sans fin : `pumpAndSettle` n'y rendrait
    // jamais la main.
    bool stabilise = true,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: theme,
        home: nu ? child : Scaffold(body: child),
      ),
    );
    if (stabilise) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
    }
  }

  group('rendu dans les quatre thèmes', () {
    for (final MapEntry<String, ThemeData> entry in themes.entries) {
      testWidgets('${entry.key} : les primitives se montent', (
        WidgetTester tester,
      ) async {
        await monte(
          tester,
          entry.value,
          ListView(
            children: <Widget>[
              CpiButton('Enregistrer', onPressed: () {}),
              CpiButton(
                'Supprimer',
                variant: CpiButtonVariant.danger,
                icon: PhosphorIconsRegular.trash,
                onPressed: () {},
              ),
              const CpiCard(child: Text('Une carte')),
              const CpiCard.rows(<CpiRow>[
                CpiRow(title: 'Première ligne', subtitle: 'Sous-titre'),
                CpiRow(title: 'Ligne rouge', danger: true),
              ]),
              const CpiField(label: 'Nom'),
              const CpiTag('Synchronisé', tone: CpiTone.success),
              const CpiTag('En attente', tone: CpiTone.warning),
              const CpiTag('Échec', tone: CpiTone.danger),
              const CpiTag('Brouillon'),
            ],
          ),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Enregistrer'), findsOneWidget);
        expect(find.text('Première ligne'), findsOneWidget);
        expect(find.text('Synchronisé'), findsOneWidget);

        await tester.pumpWidget(const SizedBox.shrink());
      });

      testWidgets('${entry.key} : la coque et la nav du bas se montent', (
        WidgetTester tester,
      ) async {
        await monte(
          tester,
          entry.value,
          CpiScaffold(
            title: 'Réglages',
            leading: IconButton(
              icon: const Icon(PhosphorIconsRegular.arrowLeft),
              onPressed: () {},
            ),
            actions: const <Widget>[Icon(PhosphorIconsRegular.cloudSlash)],
            footer: CpiBottomNav(
              index: 0,
              onSelected: (int _) {},
              items: const <CpiNavItem>[
                CpiNavItem(
                  label: 'Accueil',
                  icon: PhosphorIconsRegular.house,
                  activeIcon: PhosphorIconsFill.house,
                ),
                CpiNavItem(
                  label: 'À corriger',
                  icon: PhosphorIconsRegular.warningCircle,
                  activeIcon: PhosphorIconsFill.warningCircle,
                  badge: 3,
                ),
              ],
            ),
            body: const Center(child: Text('Corps')),
          ),
          nu: true,
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Réglages'), findsOneWidget);
        expect(find.text('Corps'), findsOneWidget);
        expect(find.text('3'), findsOneWidget);

        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  });

  group('CpiButton', () {
    testWidgets(
      'la roue remplace l\'icône et bloque l\'appui pendant l\'envoi',
      (WidgetTester tester) async {
        int appuis = 0;
        await monte(
          tester,
          AppTheme.light,
          CpiButton(
            'Envoyer',
            icon: PhosphorIconsRegular.paperPlaneTilt,
            loading: true,
            onPressed: () => appuis += 1,
          ),
          stabilise: false,
        );

        expect(find.byType(FCircularProgress), findsOneWidget);
        expect(find.byIcon(PhosphorIconsRegular.paperPlaneTilt), findsNothing);
        // Pendant l'envoi le bouton dit ce qu'il fait : le libellé de repos
        // laisse la place à celui de l'envoi.
        expect(find.text('Envoyer'), findsNothing);

        await tester.tap(find.text('Enregistrement…'));
        await tester.pump(const Duration(milliseconds: 300));
        expect(appuis, 0);

        await tester.pumpWidget(const SizedBox.shrink());
      },
    );

    testWidgets('hors envoi, pas de roue et l\'appui passe', (
      WidgetTester tester,
    ) async {
      int appuis = 0;
      await monte(
        tester,
        AppTheme.dark,
        CpiButton(
          'Envoyer',
          icon: PhosphorIconsRegular.paperPlaneTilt,
          onPressed: () => appuis += 1,
        ),
      );

      expect(find.byType(FCircularProgress), findsNothing);
      expect(find.byIcon(PhosphorIconsRegular.paperPlaneTilt), findsOneWidget);

      await tester.tap(find.text('Envoyer'));
      await tester.pumpAndSettle();
      expect(appuis, 1);

      await tester.pumpWidget(const SizedBox.shrink());
    });
  });

  group('CpiButton, suite', () {
    testWidgets('l\'envoi garde l\'aplat de repos', (
      WidgetTester tester,
    ) async {
      Color aplat(WidgetTester tester) {
        final ShapeDecoration peinture =
            tester
                    .widgetList<DecoratedBox>(
                      find.descendant(
                        of: find.byType(CpiButton),
                        matching: find.byType(DecoratedBox),
                      ),
                    )
                    .first
                    .decoration
                as ShapeDecoration;
        return peinture.color ?? const Color(0x00000000);
      }

      await monte(tester, AppTheme.light, const CpiButton('Envoyer'));
      final Color eteint = aplat(tester);

      await monte(
        tester,
        AppTheme.light,
        CpiButton('Envoyer', onPressed: () {}),
      );
      final Color repos = aplat(tester);

      await monte(
        tester,
        AppTheme.light,
        CpiButton('Envoyer', loading: true, onPressed: () {}),
        stabilise: false,
      );
      // Le verrou anti double envoi éteint le bouton : sans rappel de style il
      // se délavait au moment précis où l'utilisateur attend un signe de vie.
      expect(aplat(tester), repos);
      expect(aplat(tester), isNot(eteint));

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('la confirmation tient 800 ms puis rend la main', (
      WidgetTester tester,
    ) async {
      int rendus = 0;
      await monte(
        tester,
        AppTheme.light,
        CpiButton(
          'Enregistrer',
          success: true,
          onSuccessShown: () => rendus += 1,
          onPressed: () {},
        ),
        stabilise: false,
      );

      expect(find.text('Enregistré'), findsOneWidget);
      expect(find.text('Enregistrer'), findsNothing);
      expect(rendus, 0);

      await tester.pump(CpiButton.successLinger);
      await tester.pump();
      expect(find.text('Enregistré'), findsNothing);
      expect(find.text('Enregistrer'), findsOneWidget);
      expect(rendus, 1);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('une confirmation démontée n\'ouvre pas de minuteur pendant', (
      WidgetTester tester,
    ) async {
      await monte(
        tester,
        AppTheme.light,
        CpiButton('Enregistrer', success: true, onPressed: () {}),
        stabilise: false,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      // Sans `Timer.cancel` au démontage, le test échouerait ici.
    });
  });

  group('CpiCountUp', () {
    testWidgets('le chiffre défile jusqu\'à sa valeur', (
      WidgetTester tester,
    ) async {
      await monte(
        tester,
        AppTheme.light,
        const CpiCountUp(value: 0),
        stabilise: false,
      );
      await monte(
        tester,
        AppTheme.light,
        const CpiCountUp(value: 40),
        stabilise: false,
      );
      await tester.pump(const Duration(milliseconds: 100));
      final String milieu = tester.widget<Text>(find.byType(Text)).data!;
      expect(int.parse(milieu), inExclusiveRange(0, 40));
      await tester.pumpAndSettle();
      expect(find.text('40'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('rien ne défile depuis l\'inconnu', (
      WidgetTester tester,
    ) async {
      await monte(
        tester,
        AppTheme.light,
        const CpiCountUp(value: null),
        stabilise: false,
      );
      expect(find.text('—'), findsOneWidget);

      await monte(
        tester,
        AppTheme.light,
        const CpiCountUp(value: 12),
        stabilise: false,
      );
      // Première valeur connue : elle s'affiche, elle ne se déroule pas depuis
      // zéro — un compteur qui part de zéro à chaque chargement ment.
      expect(find.text('12'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('mouvement réduit : le chiffre est posé, pas déroulé', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: Scaffold(body: CpiCountUp(value: 7)),
          ),
        ),
      );
      expect(find.byType(TweenAnimationBuilder<int>), findsNothing);
      expect(find.text('7'), findsOneWidget);
    });
  });

  group('CpiStepHeader', () {
    testWidgets('la jauge rampe puis tombe juste', (WidgetTester tester) async {
      double jauge() => tester
          .widget<FDeterminateProgress>(find.byType(FDeterminateProgress))
          .value;

      await monte(
        tester,
        AppTheme.light,
        const CpiStepHeader(step: 1, total: 4, question: 'Qui ?'),
        stabilise: false,
      );
      expect(jauge(), closeTo(0.25, 0.001));

      await monte(
        tester,
        AppTheme.light,
        const CpiStepHeader(step: 4, total: 4, question: 'Combien ?'),
        stabilise: false,
      );
      await tester.pump(const Duration(milliseconds: 100));
      expect(jauge(), greaterThan(0.25));
      expect(jauge(), lessThan(1));

      await tester.pumpAndSettle();
      expect(jauge(), closeTo(1, 0.001));

      await tester.pumpWidget(const SizedBox.shrink());
    });
  });

  group('CpiListEntrance', () {
    testWidgets('au-delà du sixième rang, l\'enfant est rendu nu', (
      WidgetTester tester,
    ) async {
      final Finder entree = find.descendant(
        of: find.byType(CpiListEntrance),
        matching: find.byType(FadeTransition),
      );

      await monte(
        tester,
        AppTheme.light,
        const CpiListEntrance(index: 7, child: Text('Ligne')),
        stabilise: false,
      );
      expect(entree, findsNothing);

      await monte(
        tester,
        AppTheme.light,
        const CpiListEntrance(index: 0, child: Text('Ligne')),
        stabilise: false,
      );
      expect(entree, findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('mouvement réduit : aucune entrée, aucun minuteur', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(disableAnimations: true),
            child: Scaffold(
              body: CpiListEntrance(index: 0, child: Text('Ligne')),
            ),
          ),
        ),
      );
      expect(
        find.descendant(
          of: find.byType(CpiListEntrance),
          matching: find.byType(FadeTransition),
        ),
        findsNothing,
      );
      expect(find.text('Ligne'), findsOneWidget);
    });

    testWidgets('une liste quittée en pleine entrée ne laisse rien derrière', (
      WidgetTester tester,
    ) async {
      await monte(
        tester,
        AppTheme.light,
        Column(
          children: <Widget>[
            for (int i = 0; i < 6; i += 1)
              CpiListEntrance(index: i, child: Text('Ligne $i')),
          ],
        ),
        stabilise: false,
      );
      // Le retard était un `Future.delayed` par ligne : six minuteurs
      // survivaient à l'écran quitté.
      await tester.pumpWidget(const SizedBox.shrink());
    });
  });

  testWidgets('CpiStatusBand reste une région vivante pendant sa venue', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await monte(
      tester,
      AppTheme.light,
      const CpiScaffold(
        title: 'Écran',
        banner: CpiStatusBand(text: 'Tout est envoyé.', tone: CpiTone.success),
        body: SizedBox.shrink(),
      ),
      nu: true,
      stabilise: false,
    );
    // À mi-transition la bande doit déjà être annoncée : une confirmation qui
    // n'existe qu'une fois l'animation finie arrive après le geste suivant.
    await tester.pump(const Duration(milliseconds: 60));
    expect(
      tester
          .getSemantics(find.text('Tout est envoyé.'))
          .getSemanticsData()
          .flagsCollection
          .isLiveRegion,
      isTrue,
    );
    await tester.pumpAndSettle();
    handle.dispose();
  });

  testWidgets('un appui sur une ligne ne claque qu\'une fois', (
    WidgetTester tester,
  ) async {
    final _FauxRetours retours = _FauxRetours();
    final CpiFeedbackService avant = CpiFeedbackService.instance;
    CpiFeedbackService.instance = retours;
    addTearDown(() => CpiFeedbackService.instance = avant);

    await monte(tester, AppTheme.light, CpiRow(title: 'Fiche', onTap: () {}));
    await tester.tap(find.text('Fiche'));
    await tester.pumpAndSettle();

    expect(retours.joues, <CpiFeedback>[CpiFeedback.tap]);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('CpiRow tient le plancher tactile', (WidgetTester tester) async {
    await monte(
      tester,
      AppTheme.light,
      CpiRow(title: 'Se déconnecter', danger: true, onTap: () {}),
    );

    expect(
      tester.getSize(find.byType(CpiRow)).height,
      greaterThanOrEqualTo(kCpiMinTouchTarget),
    );

    await tester.pumpWidget(const SizedBox.shrink());
  });

  group('cpiConfirm', () {
    Future<bool?> ouvre(WidgetTester tester, String bouton) async {
      late Future<bool?> reponse;
      await monte(
        tester,
        AppTheme.dark,
        Builder(
          builder: (BuildContext context) => CpiButton(
            'Ouvrir',
            onPressed: () => reponse = cpiConfirm(
              context,
              title: 'Se déconnecter ?',
              message: 'Les saisies non envoyées resteront sur ce téléphone.',
              confirmLabel: 'Se déconnecter',
              danger: true,
            ),
          ),
        ),
      );

      await tester.tap(find.text('Ouvrir'));
      await tester.pumpAndSettle();
      expect(find.text('Se déconnecter ?'), findsOneWidget);

      await tester.tap(find.text(bouton));
      await tester.pumpAndSettle();
      return reponse;
    }

    testWidgets('le bouton d\'action renvoie true', (
      WidgetTester tester,
    ) async {
      expect(await ouvre(tester, 'Se déconnecter'), isTrue);
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('Annuler renvoie false', (WidgetTester tester) async {
      expect(await ouvre(tester, 'Annuler'), isFalse);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  });

  group('cpiToast', () {
    testWidgets('sous un CpiScaffold, le message passe par ForUI', (
      WidgetTester tester,
    ) async {
      await monte(
        tester,
        AppTheme.light,
        CpiScaffold(
          title: 'Accueil',
          body: Builder(
            builder: (BuildContext context) => CpiButton(
              'Prévenir',
              onPressed: () => cpiToast(context, 'Visite enregistrée'),
            ),
          ),
        ),
        nu: true,
      );

      await tester.tap(find.text('Prévenir'));
      await tester.pumpAndSettle();

      expect(find.text('Visite enregistrée'), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('sur un écran Material, il retombe sur la SnackBar', (
      WidgetTester tester,
    ) async {
      await monte(
        tester,
        AppTheme.chuesDark,
        Builder(
          builder: (BuildContext context) => CpiButton(
            'Prévenir',
            onPressed: () => cpiToast(context, 'Visite enregistrée'),
          ),
        ),
      );

      await tester.tap(find.text('Prévenir'));
      await tester.pumpAndSettle();

      expect(find.byType(SnackBar), findsOneWidget);

      // Laisse la SnackBar expirer : sinon son minuteur survit à l'arbre.
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox.shrink());
    });
  });

  testWidgets('showCpiSheet renvoie la valeur choisie', (
    WidgetTester tester,
  ) async {
    late Future<String?> reponse;
    await monte(
      tester,
      AppTheme.chues,
      Builder(
        builder: (BuildContext context) => CpiButton(
          'Choisir',
          onPressed: () => reponse = showCpiSheet<String>(
            context,
            title: 'Résultat de l\'appel',
            builder: (BuildContext sheet) => CpiRow(
              title: 'Joignable',
              onTap: () => Navigator.of(sheet).pop('joignable'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Choisir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Joignable'));
    await tester.pumpAndSettle();

    expect(await reponse, 'joignable');

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
