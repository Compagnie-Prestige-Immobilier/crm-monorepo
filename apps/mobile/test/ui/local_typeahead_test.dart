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
  }) => TypeaheadOption(
    id: label,
    label: label,
    secondary: secondary,
    keywords: keywords,
  );

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
      expect(
        option('Kédougou', secondary: 'KE-KED').matches('Kedougou'),
        isTrue,
      );
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
  // Le champ Syndicat est le DERNIER de la saisie de prospects : clavier ouvert,
  // une liste qui s'ouvre systématiquement vers le bas tombe hors de l'écran et
  // le référentiel devient inatteignable.
  testWidgets('en bas de l\'écran, la liste s\'ouvre vers le haut', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final TextEditingController controller = TextEditingController();
    final FocusNode focus = FocusNode();
    addTearDown(controller.dispose);
    addTearDown(focus.dispose);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Column(
            children: <Widget>[
              const Spacer(),
              LocalTypeahead(
                controller: controller,
                focusNode: focus,
                options: <TypeaheadOption>[option('SUDES'), option('SAEMSS')],
                label: 'Syndicat',
                onSelected: (TypeaheadOption _) {},
              ),
            ],
          ),
        ),
      ),
    );
    focus.requestFocus();
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'S');
    await tester.pumpAndSettle();

    expect(
      tester.getTopLeft(find.byType(ListView)).dy,
      lessThan(tester.getTopLeft(find.byType(TextField)).dy),
      reason: 'la liste doit s\'ouvrir du côté où il reste de la place',
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('message d\'état : il DOIT être à l\'écran', () {
    /// Monte un champ isolé, avec les options qu'on lui donne.
    Future<({TextEditingController controller, FocusNode focus})> pumpField(
      WidgetTester tester, {
      required List<TypeaheadOption> options,
      String emptyHint = 'Aucun département. Synchronisez.',
      String text = '',
    }) async {
      final TextEditingController controller = TextEditingController(
        text: text,
      );
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
      final ({TextEditingController controller, FocusNode focus}) f =
          await pumpField(
            tester,
            options: <TypeaheadOption>[option('Dakar'), option('Thiès')],
          );

      f.focus.requestFocus();
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Bamako');
      await tester.pumpAndSettle();

      expect(find.textContaining('Aucun résultat'), findsOneWidget);
    });

    testWidgets(
      'le choix ne rouvre pas la liste quand le formulaire retrecit les options',
      (WidgetTester tester) async {
        // ═══ LE DÉFAUT, SIGNALÉ SUR L'APK ═══
        //
        // Choisir « Tambacounda » en département en fait DÉDUIRE la région, ce
        // qui retrecit la liste passee au widget. Le widget se reconstruit,
        // `RawAutocomplete` recalcule ses options avec le libelle deja pose, et
        // en trouve UNE : la liste se rouvre sur le choix qu'on vient de faire,
        // et il faut le retaper. Une liste vide est la seule chose qui ferme le
        // panneau.
        const List<TypeaheadOption> tout = <TypeaheadOption>[
          TypeaheadOption(id: 'tamba', label: 'Tambacounda'),
          TypeaheadOption(id: 'dakar', label: 'Dakar'),
          TypeaheadOption(id: 'thies', label: 'Thiès'),
        ];
        const List<TypeaheadOption> region = <TypeaheadOption>[
          TypeaheadOption(id: 'tamba', label: 'Tambacounda'),
          TypeaheadOption(id: 'bakel', label: 'Bakel'),
        ];

        final TextEditingController controller = TextEditingController();
        final FocusNode focus = FocusNode();
        addTearDown(controller.dispose);
        addTearDown(focus.dispose);

        String? selectedId;
        List<TypeaheadOption> options = tout;

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: StatefulBuilder(
                builder: (BuildContext context, StateSetter setState) {
                  return LocalTypeahead(
                    controller: controller,
                    focusNode: focus,
                    options: options,
                    selectedId: selectedId,
                    label: 'Département',
                    onSelected: (TypeaheadOption o) {
                      // Ce que fait le vrai formulaire : il pose la valeur ET
                      // deduit la region, donc il change la liste.
                      setState(() {
                        selectedId = o.id;
                        options = region;
                      });
                    },
                  );
                },
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        await tester.tap(find.byType(TextField));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), 'Tamba');
        await tester.pumpAndSettle();
        expect(find.widgetWithText(ListTile, 'Tambacounda'), findsOneWidget);

        await tester.tap(find.widgetWithText(ListTile, 'Tambacounda'));
        await tester.pumpAndSettle();

        expect(controller.text, 'Tambacounda');
        expect(focus.hasFocus, isFalse);

        // Le geste qui revele le defaut : revenir sur le champ. La liste est
        // desormais celle de la region deduite, et le libelle pose y figure
        // encore : sans la branche « pose », elle se rouvre sur ce seul choix.
        focus.requestFocus();
        await tester.pumpAndSettle();

        expect(
          find.byType(ListTile),
          findsNothing,
          reason: 'un choix pose ne se represente pas comme une liste',
        );
      },
    );

    testWidgets('une recherche qui aboutit ne dit rien', (
      WidgetTester tester,
    ) async {
      final ({TextEditingController controller, FocusNode focus}) f =
          await pumpField(
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
              builder: (BuildContext context, StateSetter setState) =>
                  LocalTypeahead(
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

    testWidgets(
      'après un choix, la liste est fermée et le champ rend la main',
      (WidgetTester tester) async {
        // Plainte terrain : « je tape, je complète avec le combobox, il me
        // réaffiche toute la liste encore et je dois choisir à nouveau ».
        final ({FocusNode focus, List<String> chosen}) f = await pumpSelectable(
          tester,
        );

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
      },
    );

    testWidgets('revenir sur le champ sans le toucher ne rouvre RIEN', (
      WidgetTester tester,
    ) async {
      final ({FocusNode focus, List<String> chosen}) f = await pumpSelectable(
        tester,
      );

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

      // Une seule ligne suffisait a faire croire a l'utilisateur qu'il doit
      // choisir une seconde fois: c'est le libelle qu'il vient de poser.
      expect(find.byType(ListTile), findsNothing);
    });
  });
}
