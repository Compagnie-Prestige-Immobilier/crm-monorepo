import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/ui/widgets/search_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Le champ de recherche des listes de représentants.
///
/// Chaque valeur émise relance une requête qui balaye la table sans index.
void main() {
  Future<List<String>> pumpAndType(
    WidgetTester tester,
    List<String> frappes,
  ) async {
    final List<String> emitted = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: CpiSearchField(onChanged: emitted.add)),
      ),
    );
    for (final String frappe in frappes) {
      await tester.enterText(find.byType(TextField), frappe);
      await tester.pump(const Duration(milliseconds: 80));
    }
    await tester.pump(const Duration(milliseconds: 400));
    return emitted;
  }

  testWidgets('un mot tapé d\'un trait ne lance qu\'une recherche', (
    WidgetTester tester,
  ) async {
    final List<String> emitted = await pumpAndType(tester, <String>[
      'O',
      'Ou',
      'Ous',
      'Ousm',
    ]);

    expect(emitted, <String>['Ousm']);
  });

  testWidgets('une pause dans la frappe relance la recherche', (
    WidgetTester tester,
  ) async {
    final List<String> emitted = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: CpiSearchField(onChanged: emitted.add)),
      ),
    );

    await tester.enterText(find.byType(TextField), 'Ous');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.enterText(find.byType(TextField), 'Ousmane');
    await tester.pump(const Duration(milliseconds: 400));

    expect(emitted, <String>['Ous', 'Ousmane']);
  });

  // Effacer est un geste, pas une frappe : rien à attendre.
  testWidgets('effacer rend la liste entière tout de suite', (
    WidgetTester tester,
  ) async {
    final List<String> emitted = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: CpiSearchField(onChanged: emitted.add)),
      ),
    );

    await tester.enterText(find.byType(TextField), 'Ousmane');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.byTooltip('Effacer la recherche'));
    await tester.pump();

    expect(emitted, <String>['Ousmane', '']);
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller?.text,
      isEmpty,
    );
  });
}
