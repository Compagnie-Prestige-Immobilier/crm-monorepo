import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/ui/widgets/local_typeahead.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Recherche dans les référentiels : insensible à la casse ET aux accents.
///
/// Le défaut d'origine a été observé sur émulateur : taper « Thies » dans le
/// sélecteur de département ne remontait rien, alors que « Thi » trouvait
/// « Thiès ». Personne ne pose les accents en tapant vite sur un clavier de
/// téléphone ; le commercial en conclut que son département n'existe pas, et il
/// ne peut plus enregistrer sa fiche.
void main() {
  TypeaheadOption option(
    String label, {
    String? secondary,
    List<String> keywords = const <String>[],
  }) =>
      TypeaheadOption(id: label, label: label, secondary: secondary, keywords: keywords);

  group('foldSearch', () {
    test('replie les accents des référentiels sénégalais', () {
      expect(foldSearch('Thiès'), 'thies');
      expect(foldSearch('Kédougou'), 'kedougou');
      expect(foldSearch('Sédhiou'), 'sedhiou');
      expect(foldSearch('Ndèye'), 'ndeye');
      expect(foldSearch('Aïssatou'), 'aissatou');
      expect(foldSearch('Coopérative'), 'cooperative');
    });

    test('laisse intact ce qui n’a pas de diacritique', () {
      expect(foldSearch('Dakar'), 'dakar');
      expect(foldSearch('CBAO'), 'cbao');
    });
  });

  group('matches : départements', () {
    final TypeaheadOption thies = option('Thiès', secondary: 'TH-THI');

    test('la saisie SANS accent trouve le libellé accentué', () {
      // Exactement le cas observé sur l'appareil.
      expect(thies.matches('Thies'), isTrue);
      expect(thies.matches('thies'), isTrue);
      expect(thies.matches('THIES'), isTrue);
    });

    test('la saisie AVEC accent continue de fonctionner', () {
      expect(thies.matches('Thiès'), isTrue);
      expect(thies.matches('thiès'), isTrue);
    });

    test('un préfixe partiel suffit', () {
      expect(thies.matches('Thi'), isTrue);
    });

    test('le code du département reste cherchable', () {
      expect(thies.matches('TH-THI'), isTrue);
      expect(thies.matches('th-thi'), isTrue);
    });

    test('un terme absent ne remonte rien', () {
      expect(thies.matches('Dakar'), isFalse);
    });

    test('Kédougou se trouve aussi sans accent', () {
      expect(option('Kédougou', secondary: 'KE-KED').matches('Kedougou'), isTrue);
    });
  });

  group('matches : mots-clés', () {
    test('le sigle d’un syndicat mord, accentué ou non', () {
      final TypeaheadOption chues = option(
        'Coopérative d’Habitat de l’Union des Enseignants du Sénégal',
        keywords: <String>['CHUES'],
      );
      expect(chues.matches('chues'), isTrue);
      expect(chues.matches('cooperative'), isTrue);
      expect(chues.matches('senegal'), isTrue);
    });
  });

  test('une requête vide laisse tout passer', () {
    expect(option('Thiès').matches(''), isTrue);
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('message d\'état : il DOIT être à l\'écran', () {
    /// Monte un champ isolé, avec les options qu'on lui donne.
    Future<
      ({TextEditingController controller, FocusNode focus})
    >
    pumpField(
      WidgetTester tester, {
      required List<TypeaheadOption> options,
      String emptyHint = 'Aucun département. Synchronisez.',
      String text = '',
    }) async {
      final TextEditingController controller = TextEditingController(text: text);
      final FocusNode focus = FocusNode();
      addTearDown(controller.dispose);
      addTearDown(focus.dispose);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: LocalTypeahead(
              controller: controller,
              focusNode: focus,
              options: options,
              label: 'Département',
              emptyHint: emptyHint,
              onSelected: (TypeaheadOption _) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      return (controller: controller, focus: focus);
    }

    testWidgets('un référentiel vide s\'annonce, sans qu\'on touche à rien', (
      WidgetTester tester,
    ) async {
      // ═══ LE DÉFAUT ═══
      //
      // `emptyHint` était rendu dans `optionsViewBuilder`. Flutter n'ouvre le
      // panneau que si `hasFocus && _options.isNotEmpty` : quand la liste est
      // vide, c'est-à-dire exactement quand ce message a quelque chose à dire,
      // le panneau n'existe pas. Sur une installation neuve, les listes ne
      // réagissaient à rien, « Enregistrer » restait grisé pour toujours, et
      // AUCUN mot à l'écran ne l'expliquait.
      await pumpField(tester, options: const <TypeaheadOption>[]);

      expect(find.text('Aucun département. Synchronisez.'), findsOneWidget);
    });

    testWidgets('une recherche sans résultat le dit, sous le champ', (
      WidgetTester tester,
    ) async {
      final ({TextEditingController controller, FocusNode focus}) f = await pumpField(
        tester,
        options: <TypeaheadOption>[option('Dakar'), option('Thiès')],
      );

      f.focus.requestFocus();
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Bamako');
      await tester.pumpAndSettle();

      expect(find.textContaining('Aucun résultat'), findsOneWidget);
    });

    testWidgets('une recherche qui aboutit ne dit rien', (WidgetTester tester) async {
      final ({TextEditingController controller, FocusNode focus}) f = await pumpField(
        tester,
        options: <TypeaheadOption>[option('Dakar'), option('Thiès')],
      );

      f.focus.requestFocus();
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Dak');
      await tester.pumpAndSettle();

      expect(find.textContaining('Aucun résultat'), findsNothing);
    });
  });

  group('choisir une option ferme la liste', () {
    /// Un champ monté comme les quatre appelants le montent : `selectedId` est
    /// posé dans `onSelected`, effacé dès que l'utilisateur retape.
    Future<({FocusNode focus, List<String> chosen})> pumpSelectable(
      WidgetTester tester,
    ) async {
      final TextEditingController controller = TextEditingController();
      final FocusNode focus = FocusNode();
      addTearDown(controller.dispose);
      addTearDown(focus.dispose);
      final List<String> chosen = <String>[];
      String? selectedId;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: StatefulBuilder(
              builder: (BuildContext context, StateSetter setState) => LocalTypeahead(
                controller: controller,
                focusNode: focus,
                options: <TypeaheadOption>[
                  option('Tambacounda'),
                  option('Dakar'),
                  option('Thiès'),
                ],
                label: 'Département',
                selectedId: selectedId,
                onChanged: (String _) {
                  if (selectedId != null) setState(() => selectedId = null);
                },
                onSelected: (TypeaheadOption o) {
                  chosen.add(o.id);
                  setState(() => selectedId = o.id);
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      return (focus: focus, chosen: chosen);
    }

    testWidgets('après un choix, la liste est fermée et le champ rend la main', (
      WidgetTester tester,
    ) async {
      // Plainte terrain : « je tape, je complète avec le combobox, il me
      // réaffiche toute la liste encore et je dois choisir à nouveau ».
      final ({FocusNode focus, List<String> chosen}) f = await pumpSelectable(tester);

      await tester.tap(find.byType(TextField));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Tamba');
      await tester.pumpAndSettle();
      expect(find.byType(ListTile), findsOneWidget);

      await tester.tap(find.byType(ListTile));
      await tester.pumpAndSettle();

      expect(f.chosen, <String>['Tambacounda']);
      expect(find.byType(ListTile), findsNothing);
      expect(f.focus.hasFocus, isFalse);
    });

    testWidgets('revenir sur le champ sans le toucher ne rouvre pas tout', (
      WidgetTester tester,
    ) async {
      final ({FocusNode focus, List<String> chosen}) f = await pumpSelectable(tester);

      await tester.tap(find.byType(TextField));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Tamba');
      await tester.pumpAndSettle();
      await tester.tap(find.byType(ListTile));
      await tester.pumpAndSettle();

      f.focus.unfocus();
      await tester.pumpAndSettle();
      f.focus.requestFocus();
      await tester.pumpAndSettle();

      expect(find.byType(ListTile), findsOneWidget);
    });
  });
}
