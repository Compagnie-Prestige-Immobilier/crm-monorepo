import 'dart:async';

import 'package:cpi_go/core/router/back_navigation.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Contrat d'accessibilité de la bibliothèque `Cpi*`.
///
/// `FTappableGroup` — posé par `FTileGroup`, `FHeader.nested` et
/// `FBottomNavigationBar` — annule les rappels du `GestureDetector` de chaque
/// `FTappable` (forui-0.21.3, `foundation/tappable/tappable.dart`). Le nœud
/// reste `isButton` mais n'expose plus `SemanticsAction.tap` : Switch Access et
/// Voice Access n'ont plus rien à actionner. Ces tests mesurent l'arbre rendu,
/// pas l'intention du code.
void main() {
  final Map<String, ThemeData> themes = <String, ThemeData>{
    'CPI clair': AppTheme.light,
    'CPI sombre': AppTheme.dark,
    'CHUES clair': AppTheme.chues,
    'CHUES sombre': AppTheme.chuesDark,
  };

  Future<void> monte(
    WidgetTester tester,
    Widget home, {
    double textScale = 1,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr', 'SN'),
        supportedLocales: const <Locale>[Locale('fr', 'SN'), Locale('fr')],
        localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
          FLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(textScale)),
            child: home,
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));
  }

  /// Le nœud rendu pour [finder], données fusionnées comprises.
  SemanticsData donnees(WidgetTester tester, Finder finder) =>
      tester.getSemantics(finder).getSemanticsData();

  /// Ce que ferait Switch Access : demander l'action au nœud lui-même.
  void agit(SemanticsNode node, SemanticsAction action) =>
      node.owner!.performAction(node.id, action);

  List<String> libelles(
    SemanticsNode depuis, {
    bool Function(SemanticsData)? ou,
  }) {
    SemanticsNode racine = depuis;
    while (racine.parent != null) {
      racine = racine.parent!;
    }
    final List<String> collectes = <String>[];
    void visite(SemanticsNode node) {
      final SemanticsData data = node.getSemanticsData();
      if (ou == null || ou(data)) collectes.add(data.label);
      node.visitChildren((SemanticsNode child) {
        visite(child);
        return true;
      });
    }

    visite(racine);
    return collectes;
  }

  testWidgets('cpi_row_dans_un_groupe_reste_activable', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    int appuis = 0;
    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        body: ListView(
          children: <Widget>[
            CpiCard.rows(<CpiRow>[
              CpiRow(title: 'Dans un groupe', onTap: () => appuis += 1),
            ]),
          ],
        ),
      ),
    );

    final SemanticsNode node = tester.getSemantics(
      find.bySemanticsLabel('Dans un groupe'),
    );
    final SemanticsData data = node.getSemanticsData();
    expect(data.flagsCollection.isButton, isTrue);
    expect(data.hasAction(SemanticsAction.tap), isTrue);
    expect(data.label, 'Dans un groupe');

    agit(node, SemanticsAction.tap);
    await tester.pump();
    expect(appuis, 1);
    handle.dispose();
  });

  testWidgets('header_action_expose_son_activation', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    int appuis = 0;
    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        leading: const CpiBackButton(),
        actions: <Widget>[
          CpiHeaderAction(
            icon: PhosphorIconsRegular.magnifyingGlass,
            label: 'Chercher',
            onPressed: () => appuis += 1,
          ),
        ],
        body: const SizedBox.shrink(),
      ),
    );

    final SemanticsNode node = tester.getSemantics(
      find.byType(CpiHeaderAction),
    );
    final SemanticsData data = node.getSemanticsData();
    expect(data.label, 'Chercher');
    expect(data.flagsCollection.isButton, isTrue);
    expect(data.flagsCollection.isHeader, isFalse);
    expect(data.hasAction(SemanticsAction.tap), isTrue);

    agit(node, SemanticsAction.tap);
    await tester.pump();
    expect(appuis, 1);
    handle.dispose();
  });

  testWidgets('retour_ne_renomme_pas_le_bandeau', (WidgetTester tester) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    // `initialRoute` empile « / » puis « /detail » : le retour a de quoi
    // dépiler sans passer par `GoRouter`.
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        initialRoute: '/detail',
        routes: <String, WidgetBuilder>{
          '/': (BuildContext _) => const Scaffold(body: Text('racine')),
          '/detail': (BuildContext _) => const CpiScaffold(
            title: 'Détail',
            leading: CpiBackButton(),
            body: SizedBox.shrink(),
          ),
        },
      ),
    );
    await tester.pumpAndSettle();

    final SemanticsNode node = tester.getSemantics(find.byType(CpiBackButton));
    final SemanticsData data = node.getSemanticsData();
    expect(data.label, 'Retour');
    expect(data.flagsCollection.isButton, isTrue);
    // Le nœud du `FHeader` porte `isHeader` ; celui du bouton ne doit pas s'y
    // fondre, sinon le bandeau entier s'annonce « Retour ».
    expect(data.flagsCollection.isHeader, isFalse);
    expect(data.hasAction(SemanticsAction.tap), isTrue);
    expect(node.rect.width, lessThanOrEqualTo(kCpiMinTouchTarget * 2));
    expect(node.rect.height, lessThanOrEqualTo(kCpiMinTouchTarget * 2));

    agit(node, SemanticsAction.tap);
    await tester.pumpAndSettle();
    expect(find.text('racine'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('nav_du_bas_activable_par_semantique', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    final List<int> choisis = <int>[];
    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        body: const SizedBox.shrink(),
        footer: CpiBottomNav(
          index: 0,
          onSelected: choisis.add,
          items: const <CpiNavItem>[
            CpiNavItem(
              label: 'Accueil',
              icon: PhosphorIconsRegular.house,
              activeIcon: PhosphorIconsFill.house,
            ),
            CpiNavItem(
              label: 'Notifications',
              icon: PhosphorIconsRegular.bell,
              activeIcon: PhosphorIconsFill.bell,
            ),
          ],
        ),
      ),
    );

    final SemanticsNode node = tester.getSemantics(
      find.bySemanticsLabel('Notifications'),
    );
    expect(node.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
    agit(node, SemanticsAction.tap);
    await tester.pump();
    expect(choisis, <int>[1]);
    handle.dispose();
  });

  testWidgets('pastille_de_nav_annonce_son_compteur', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        body: const SizedBox.shrink(),
        footer: CpiBottomNav(
          index: 0,
          onSelected: (int _) {},
          items: const <CpiNavItem>[
            CpiNavItem(
              label: 'Accueil',
              icon: PhosphorIconsRegular.house,
              activeIcon: PhosphorIconsFill.house,
              badge: 3,
            ),
          ],
        ),
      ),
    );

    expect(
      libelles(tester.getSemantics(find.byType(CpiScaffold))),
      contains(contains('3 en attente')),
    );
    handle.dispose();
  });

  testWidgets('libelle_de_nav_grandit_avec_l_echelle', (
    WidgetTester tester,
  ) async {
    Widget nav() => CpiScaffold(
      title: 'Écran',
      body: const SizedBox.shrink(),
      footer: CpiBottomNav(
        index: 0,
        onSelected: (int _) {},
        items: const <CpiNavItem>[
          CpiNavItem(
            label: 'Notifications',
            icon: PhosphorIconsRegular.bell,
            activeIcon: PhosphorIconsFill.bell,
          ),
          CpiNavItem(
            label: 'Accueil',
            icon: PhosphorIconsRegular.house,
            activeIcon: PhosphorIconsFill.house,
          ),
        ],
      ),
    );

    await monte(tester, nav());
    final double petit = tester
        .getSize(find.text('Notifications').first)
        .height;
    await monte(tester, nav(), textScale: 1.76);
    final double grand = tester
        .getSize(find.text('Notifications').first)
        .height;
    expect(grand, greaterThan(petit));
  });

  testWidgets('cible_tactile_reelle_de_48', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        leading: const CpiBackButton(),
        actions: <Widget>[
          CpiHeaderAction(
            icon: PhosphorIconsRegular.magnifyingGlass,
            label: 'Chercher',
            onPressed: () {},
          ),
        ],
        body: ListView(
          children: <Widget>[
            for (final CpiButtonVariant variant in CpiButtonVariant.values)
              CpiButton(variant.name, variant: variant, onPressed: () {}),
            CpiCard.rows(<CpiRow>[
              CpiRow(
                title: 'Ligne',
                trailing: FSwitch(value: true, onChange: (bool _) {}),
                onTap: () {},
              ),
            ]),
          ],
        ),
      ),
    );

    final Map<String, Finder> cibles = <String, Finder>{
      'CpiBackButton': find.byType(CpiBackButton),
      'CpiHeaderAction': find.byType(CpiHeaderAction),
      'CpiRow': find.byType(CpiRow),
      for (final CpiButtonVariant variant in CpiButtonVariant.values)
        'CpiButton.${variant.name}': find.widgetWithText(
          CpiButton,
          variant.name,
        ),
    };
    for (final MapEntry<String, Finder> cible in cibles.entries) {
      final Size size = tester.getSize(cible.value);
      expect(
        size.width,
        greaterThanOrEqualTo(kCpiMinTouchTarget),
        reason: '${cible.key} large de ${size.width}',
      );
      expect(
        size.height,
        greaterThanOrEqualTo(kCpiMinTouchTarget),
        reason: '${cible.key} haut de ${size.height}',
      );
    }

    // `FSwitch` rend un `CupertinoSwitch` de 51×31 : c'est la LIGNE qui porte
    // la cible, l'interrupteur seul ne la tiendrait pas.
    expect(
      tester.getSize(find.byType(CpiRow)).height,
      greaterThanOrEqualTo(kCpiMinTouchTarget),
    );
  });

  testWidgets('chaines_forui_en_francais', (WidgetTester tester) async {
    late BuildContext hote;
    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        body: Builder(
          builder: (BuildContext context) {
            hote = context;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    final FLocalizations? traductions = FLocalizations.of(hote);
    expect(traductions, isNotNull);
    expect(traductions!.barrierLabel, isNot('Barrier'));
    expect(traductions.sheetSemanticsLabel, isNot('Sheet'));

    final SemanticsHandle handle = tester.ensureSemantics();
    unawaited(
      showCpiSheet<void>(
        hote,
        title: 'Feuille',
        builder: (BuildContext _) => const Text('contenu'),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      libelles(
        tester.getSemantics(find.text('contenu')),
        ou: (SemanticsData data) => data.flagsCollection.namesRoute,
      ),
      isNot(contains('Sheet')),
    );
    handle.dispose();
  });

  testWidgets('bandeau_d_etat_se_pose_sous_le_titre', (
    WidgetTester tester,
  ) async {
    int actions = 0;
    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        banner: CpiStatusBand(
          text: '3 saisies en attente',
          tone: CpiTone.warning,
          actionLabel: 'Envoyer',
          onAction: () => actions += 1,
        ),
        body: const SizedBox.shrink(),
      ),
    );
    expect(find.text('3 saisies en attente'), findsOneWidget);
    expect(
      tester.getTopLeft(find.byType(CpiStatusBand)).dy,
      greaterThan(tester.getTopLeft(find.byType(CpiTitle)).dy),
    );
    await tester.tap(find.text('Envoyer'));
    await tester.pumpAndSettle();
    expect(actions, 1);
  });

  testWidgets('en_tete_d_etape_annonce_son_rang', (WidgetTester tester) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await monte(
      tester,
      const CpiScaffold(
        title: 'Écran',
        showTitle: false,
        body: CpiStepHeader(step: 1, total: 3, question: 'Qui avez-vous vu ?'),
      ),
    );
    final SemanticsData data = donnees(tester, find.byType(CpiStepHeader));
    expect(data.label, 'Étape 1 sur 3. Qui avez-vous vu ?');
    expect(data.flagsCollection.isHeader, isTrue);
    expect(
      tester
          .widget<FDeterminateProgress>(find.byType(FDeterminateProgress))
          .value,
      closeTo(1 / 3, 0.001),
    );
    handle.dispose();
  });

  testWidgets('le_sous_titre_du_bouton_ne_sort_que_desactive', (
    WidgetTester tester,
  ) async {
    await monte(
      tester,
      const CpiScaffold(
        title: 'Écran',
        body: CpiButton(
          'Enregistrer',
          subtitle: 'Choisissez d\'abord le résultat',
        ),
      ),
    );
    expect(find.text('Choisissez d\'abord le résultat'), findsOneWidget);

    await monte(
      tester,
      CpiScaffold(
        title: 'Écran',
        body: CpiButton(
          'Enregistrer',
          subtitle: 'Choisissez d\'abord le résultat',
          onPressed: () {},
        ),
      ),
    );
    expect(find.text('Choisissez d\'abord le résultat'), findsNothing);
  });

  group('durée du message', () {
    test('un message court tient six secondes au minimum', () {
      expect(cpiToastDuration('Enregistré').inSeconds, greaterThanOrEqualTo(6));
    });

    test('un message long dure plus longtemps', () {
      expect(
        cpiToastDuration('a' * 200),
        greaterThan(cpiToastDuration('a' * 20)),
      );
    });
  });

  for (final MapEntry<String, ThemeData> entry in themes.entries) {
    testWidgets('${entry.key} · les primitives se montent', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: entry.value,
          home: const CpiScaffold(
            title: 'Écran',
            banner: CpiStatusBand(text: 'Hors ligne'),
            body: CpiStepHeader(
              step: 2,
              total: 4,
              question: 'Combien de visites ?',
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    });
  }
}
