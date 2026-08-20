import 'dart:async';

import 'package:cpi_go/core/router/back_navigation.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Le retour arrière doit aboutir sur **toutes** les routes.
///
/// ## Ce que ces tests verrouillent
///
/// Le bug d'origine : les écrans pleine page étaient atteints par `context.go`,
/// qui **remplace** la pile. Il ne restait qu'une route, donc `maybePop` ne
/// pouvait rien dépiler et la flèche de l'AppBar n'avait aucun effet : signalé
/// sur Phase 2, mais vrai partout.
///
/// Deux propriétés se testent séparément, parce qu'elles se cassent
/// séparément :
///
/// 1. **Empiler, pas remplacer.** Après `push`, la pile peut être dépilée.
/// 2. **Toujours une issue.** Même quand la route est la première de la pile :
///    ce qui arrive à chaque démarrage à froid sur une route restaurée :
///    [popOrHome] envoie ailleurs plutôt que de ne rien faire.
void main() {
  /// Routeur minimal : les vrais écrans ne sont pas nécessaires pour observer
  /// la pile, et les monter tirerait la base, le réseau et l'authentification.
  GoRouter buildRouter({required String initialLocation}) {
    Widget page(String title, {String fallback = Routes.home}) {
      return CpiPopScope(
        fallback: fallback,
        child: Scaffold(
          appBar: AppBar(
            title: Text(title),
            leading: CpiBackButton(fallback: fallback),
          ),
          body: Center(child: Text('corps $title')),
        ),
      );
    }

    return GoRouter(
      initialLocation: initialLocation,
      routes: <RouteBase>[
        GoRoute(
          path: Routes.home,
          builder: (_, _) => Scaffold(
            appBar: AppBar(title: const Text('Accueil')),
            body: const Center(child: Text('corps Accueil')),
          ),
        ),
        GoRoute(path: Routes.phase2, builder: (_, _) => page('Phase 2')),
        GoRoute(
          path: Routes.newRepresentant,
          builder: (_, _) => page('Nouveau représentant'),
        ),
        GoRoute(
          path: Routes.newProspect,
          builder: (_, _) => page('Saisie de prospects', fallback: Routes.historique),
        ),
        GoRoute(
          path: Routes.historique,
          builder: (_, _) => Scaffold(
            appBar: AppBar(title: const Text('Historique')),
            body: const Center(child: Text('corps Historique')),
          ),
        ),
        GoRoute(
          path: Routes.batteryHelp,
          builder: (_, _) => page('Autorisations et batterie', fallback: Routes.reglages),
        ),
        GoRoute(
          path: Routes.about,
          builder: (_, _) => page('À propos', fallback: Routes.reglages),
        ),
        GoRoute(
          path: Routes.reglages,
          builder: (_, _) => Scaffold(
            appBar: AppBar(title: const Text('Réglages')),
            body: const Center(child: Text('corps Réglages')),
          ),
        ),
      ],
    );
  }

  Future<GoRouter> pumpApp(WidgetTester tester, {String at = Routes.home}) async {
    final GoRouter router = buildRouter(initialLocation: at);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    return router;
  }

  /// Chaque route pleine page de l'app, avec son titre d'AppBar.
  const Map<String, String> fullScreenRoutes = <String, String>{
    Routes.phase2: 'Phase 2',
    Routes.newRepresentant: 'Nouveau représentant',
    Routes.newProspect: 'Saisie de prospects',
    Routes.batteryHelp: 'Autorisations et batterie',
    Routes.about: 'À propos',
  };

  group('la flèche de l\'AppBar dépile', () {
    for (final MapEntry<String, String> route in fullScreenRoutes.entries) {
      testWidgets('${route.value} : empilée depuis l\'accueil, la flèche revient', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await pumpApp(tester);
        // La future de `push` ne se règle qu'au dépilement, qui arrive plus bas.
        unawaited(router.push<void>(route.key));
        await tester.pumpAndSettle();
        expect(find.text('corps ${route.value}'), findsOneWidget);
        expect(router.canPop(), isTrue, reason: 'push doit empiler, pas remplacer');

        await tester.tap(find.byTooltip('Retour'));
        await tester.pumpAndSettle();

        expect(find.text('corps Accueil'), findsOneWidget);
      });
    }
  });

  group('le geste système dépile', () {
    for (final MapEntry<String, String> route in fullScreenRoutes.entries) {
      testWidgets('${route.value} : le retour Android revient aussi', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await pumpApp(tester);
        // La future de `push` ne se règle qu'au dépilement, qui arrive plus bas.
        unawaited(router.push<void>(route.key));
        await tester.pumpAndSettle();

        // `popRoute` est exactement ce que déclenche le bouton/geste système.
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();

        expect(find.text('corps Accueil'), findsOneWidget);
      });
    }
  });

  group('pile vide : il reste une issue', () {
    testWidgets(
      'Phase 2 restaurée au démarrage à froid : la flèche renvoie à l\'accueil',
      (WidgetTester tester) async {
        // Exactement le cas signalé : `RouteMemory` restaure `/phase2` en
        // `initialLocation`, la pile ne contient que lui.
        final GoRouter router = await pumpApp(tester, at: Routes.phase2);
        expect(router.canPop(), isFalse);

        await tester.tap(find.byTooltip('Retour'));
        await tester.pumpAndSettle();

        expect(find.text('corps Accueil'), findsOneWidget);
      },
    );

    testWidgets('chaque écran retombe sur SA destination de repli', (
      WidgetTester tester,
    ) async {
      // « À propos » ouvert directement doit revenir aux Réglages, pas à
      // l'accueil : c'est de là qu'il vient dans le parcours réel.
      await pumpApp(tester, at: Routes.about);
      await tester.tap(find.byTooltip('Retour'));
      await tester.pumpAndSettle();
      expect(find.text('corps Réglages'), findsOneWidget);
    });

    testWidgets('le geste système ne ferme pas l\'app quand la pile est vide', (
      WidgetTester tester,
    ) async {
      await pumpApp(tester, at: Routes.phase2);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('corps Accueil'), findsOneWidget);
    });
  });

  testWidgets('popOrHome sans routeur retombe sur le Navigator local', (
    WidgetTester tester,
  ) async {
    // Un écran monté seul : test de widget, aperçu : ne doit pas lever à la
    // construction sous prétexte qu'aucun `GoRouter` n'est au-dessus de lui.
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (BuildContext context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const CpiPopScope(
                    child: Scaffold(appBar: null, body: Center(child: Text('second'))),
                  ),
                ),
              ),
              child: const Text('ouvrir'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
    expect(find.text('second'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('ouvrir'), findsOneWidget);
  });

  testWidgets('sans routeur ni pile : le retour système ne se rappelle pas lui-même', (
    WidgetTester tester,
  ) async {
    // `maybePop` redemande son avis au `PopScope` qui vient de refuser : le
    // refus rappelle `popOrHome`, qui redemande, sans fin. L'écran se fige.
    await tester.pumpWidget(
      const MaterialApp(
        home: CpiPopScope(
          child: Scaffold(body: Center(child: Text('seul'))),
        ),
      ),
    );

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.text('seul'), findsOneWidget);
  });
}
