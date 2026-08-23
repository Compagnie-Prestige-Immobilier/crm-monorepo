import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/ui/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

/// Sept écrans écrivaient leur propre état vide : icône 56 / 48 / aucune,
/// titre `titleSmall` / `titleMedium`, écarts `lg` / `xs` / `xxs`.
void main() {
  Future<void> monte(
    WidgetTester tester, {
    required double hauteur,
    double textScale = 1,
    Widget? action,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: MediaQuery(
          data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
          child: Scaffold(
            body: SizedBox(
              width: 320,
              height: hauteur,
              child: CpiEmptyState(
                icon: PhosphorIconsDuotone.usersThree,
                title: 'Aucun représentant',
                message:
                    'Créez une première fiche pour commencer à saisir des '
                    'prospects.',
                action: action,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('il porte toujours une icône, un titre et une phrase', (
    WidgetTester tester,
  ) async {
    await monte(tester, hauteur: 600);

    final Icon icone = tester.widget<Icon>(find.byType(Icon));
    expect(icone.size, CpiIconSize.display);
    expect(find.text('Aucun représentant'), findsOneWidget);
    expect(find.textContaining('Créez une première fiche'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('il défile plutôt que de déborder quand la place manque', (
    WidgetTester tester,
  ) async {
    await monte(
      tester,
      hauteur: 160,
      textScale: 1.76,
      action: FilledButton(onPressed: () {}, child: const Text('Créer')),
    );

    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
  });
}
