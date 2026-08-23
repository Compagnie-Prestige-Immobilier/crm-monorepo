import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/ui/widgets/offline_indicator.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// WCAG 2.2.2 : un mouvement qui démarre seul et dure plus de cinq secondes
/// doit pouvoir être arrêté. Le réseau, lui, peut manquer toute la journée : la
/// pulsation tournait indéfiniment sur douze écrans.
void main() {
  Widget host({bool reduced = false}) => ProviderScope(
    overrides: [
      connectivityProvider.overrideWithValue(CpiConnectivity.offline),
    ],
    child: MaterialApp(
      theme: AppTheme.light,
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduced),
        child: const Scaffold(
          appBar: null,
          body: Center(child: OfflineIndicator()),
        ),
      ),
    ),
  );

  // La transition de page du thème pose ses propres FadeTransition : on ne
  // regarde que celle qui enveloppe l'icône.
  double opacity(WidgetTester tester) => tester
      .widgetList<FadeTransition>(
        find.ancestor(
          of: find.byType(Icon),
          matching: find.byType(FadeTransition),
        ),
      )
      .first
      .opacity
      .value;

  testWidgets(
    'la pulsation s\'arrête avant six secondes, réseau toujours absent',
    (WidgetTester tester) async {
      await tester.pumpWidget(host());
      await tester.pump(const Duration(milliseconds: 400));

      // Elle bouge d'abord : sans ça le test passerait sur un indicateur mort.
      final double debut = opacity(tester);
      await tester.pump(const Duration(milliseconds: 400));
      expect(opacity(tester), isNot(closeTo(debut, 0.001)));

      await tester.pump(const Duration(seconds: 6));
      final double apres = opacity(tester);
      await tester.pump(const Duration(milliseconds: 800));
      expect(
        opacity(tester),
        closeTo(apres, 0.001),
        reason: 'la pulsation tourne encore après le plafond de cinq secondes',
      );
      expect(apres, closeTo(1, 0.001), reason: 'elle doit se poser pleine');

      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('animations désactivées : elle ne démarre pas du tout', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host(reduced: true));
    await tester.pump(const Duration(milliseconds: 800));
    expect(opacity(tester), closeTo(1, 0.001));
    await tester.pump(const Duration(milliseconds: 800));
    expect(opacity(tester), closeTo(1, 0.001));

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
