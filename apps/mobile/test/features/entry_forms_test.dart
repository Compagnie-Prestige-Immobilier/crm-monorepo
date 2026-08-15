import 'dart:convert';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/features/representant/presentation/representant_picker_screen.dart';
import 'package:drift/native.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_entry_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_form_screen.dart';
// `Column` est masqué : celui de drift décrit une colonne SQL, et les finders
// de ce fichier visent celui de Flutter.
import 'package:drift/drift.dart' hide Column, isNotNull, isNull;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Écrans de saisie : reprise de brouillon et référentiels manquants.
///
/// ═══ CE QUE CES TESTS EXISTENT POUR INTERDIRE ═══
///
/// Le dispositif de brouillon était **en écriture seule**. `latestFor` n'avait
/// aucun appelant, et `_draftId` valait `widget.draftId ?? Ids.newId()` : un
/// écran ouvert depuis un bouton tirait un identifiant neuf à chaque montage et
/// relisait sous cet identifiant, qui n'avait par construction jamais rien
/// porté. La saisie était bien en base ; plus personne ne savait sous quel nom
/// la chercher.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
  });
  tearDown(() async => db.close());

  /// Un test de widget qui démonte l'arbre à la fin.
  ///
  /// Sans ce démontage, les `StreamProvider` drift laissent un minuteur de durée
  /// nulle derrière eux et chaque test échoue sur « A Timer is still pending ».
  void formTestWidgets(String description, WidgetTesterCallback body) {
    testWidgets(description, (WidgetTester tester) async {
      // 540 × 1170 logiques : plus large qu'un Tecno d'entrée de gamme, pour
      // que ces tests portent sur la reprise de brouillon et non sur les
      // débordements de mise en page, couverts ailleurs.
      tester.view.physicalSize = const Size(1080, 2340);
      tester.view.devicePixelRatio = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      // `finally` et non une suite d'instructions : sans lui, une assertion qui
      // échoue saute le démontage, le minuteur de drift reste en vol, et le
      // shell de test se bloque cinq minutes avant d'être tué par SIGTERM. On
      // perdait alors le message d'échec dans le bruit de la finalisation.
      try {
        await body(tester);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
      }
    });
  }

  Widget host(Widget screen) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        ),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: screen,
      ),
    );
  }

  /// Pose un brouillon daté, directement en base : l'âge décide de la politique
  /// de reprise, et il se compte depuis `DateTime.now()`.
  Future<void> seedDraft({
    required String draftId,
    required String formKey,
    required Map<String, Object?> values,
    Duration age = const Duration(minutes: 2),
    String? entityId,
    String? parentId,
  }) {
    return db
        .into(db.formDrafts)
        .insert(
          FormDraftsCompanion.insert(
            draftId: draftId,
            formKey: formKey,
            entityId: Value<String?>(entityId),
            parentId: Value<String?>(parentId),
            payload: jsonEncode(values),
            updatedAt: DateTime.now().subtract(age),
          ),
        );
  }

  Future<List<FormDraft>> drafts() => db.select(db.formDrafts).get();

  // ───────────────────────────────────────────────────────────────────────────
  group('reprise d\'une saisie de représentant', () {
    formTestWidgets('un écran ouvert SANS référence retrouve le dernier brouillon', (
      WidgetTester tester,
    ) async {
      // Le cas normal : le commercial tape « Nouveau représentant » depuis le
      // sélecteur. Aucun `?draft=` dans l'URL, donc un identifiant neuf, donc
      // une lecture à vide : le formulaire revenait vierge alors que la saisie
      // était intacte en base.
      await seedDraft(
        draftId: 'brouillon-1',
        formKey: 'representant.create',
        values: <String, Object?>{'fullName': 'Ousmane Fall', 'phone': '77 123 45 67'},
      );

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsOneWidget);
      expect(find.textContaining('Ousmane Fall'), findsOneWidget);
    });

    formTestWidgets('« Reprendre » remplit le formulaire et ADOPTE la ligne', (
      WidgetTester tester,
    ) async {
      await seedDraft(
        draftId: 'brouillon-1',
        formKey: 'representant.create',
        values: <String, Object?>{
          'fullName': 'Ousmane Fall',
          'phone': '77 123 45 67',
          'departementId': 'dep-1',
          'departementLabel': 'Dakar',
        },
      );

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reprendre'));
      await tester.pumpAndSettle();

      expect(find.text('Ousmane Fall'), findsOneWidget);
      expect(find.text('Dakar'), findsOneWidget);

      // Une seule ligne, et c'est l'ancienne : dupliquer laisserait la première
      // traîner sept jours et rendrait la prochaine reprise ambiguë.
      final List<FormDraft> rows = await drafts();
      expect(rows, hasLength(1));
      expect(rows.single.draftId, 'brouillon-1');
    });

    formTestWidgets('en MODIFICATION, la correction inachevée est retrouvée', (
      WidgetTester tester,
    ) async {
      // L'édition (`?id=`) écrivait des brouillons sans jamais en relire aucun :
      // une mort de processus au milieu d'une correction perdait les
      // modifications ET laissait une ligne orpheline.
      await insertRepresentant(db, id: 'rep-9', phone: '+221770000009');
      await seedDraft(
        draftId: 'brouillon-edit',
        formKey: 'representant.create',
        entityId: 'rep-9',
        values: <String, Object?>{
          'fullName': 'Nom corrigé',
          'phone': '77 000 00 09',
          'departementId': 'dep-1',
          'departementLabel': 'Dakar',
        },
      );

      await tester.pumpWidget(
        host(const RepresentantFormScreen(representantId: 'rep-9')),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsOneWidget);
      await tester.tap(find.text('Reprendre'));
      await tester.pumpAndSettle();
      expect(find.text('Nom corrigé'), findsOneWidget);
    });

    formTestWidgets('un département choisi seul est un brouillon, pas du vide', (
      WidgetTester tester,
    ) async {
      // Choisir dans une liste est le geste le plus lent d'un formulaire
      // tactile. Le compter pour rien parce que le nom n'est pas encore tapé
      // jetait exactement ce qu'on cherche à protéger.
      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(TextField, 'Département'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Dakar').last);
      await tester.pumpAndSettle();
      // La traîne de l'anti-rebond, puis l'écriture.
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      expect(await drafts(), hasLength(1));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('reprise d\'une saisie de prospect', () {
    formTestWidgets('banque et syndicat seuls suffisent à écrire un brouillon', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');

      await tester.pumpWidget(host(const ProspectEntryScreen(representantId: 'rep-1')));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(TextField, 'Banque'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Banque Test').last);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextField, 'Syndicat'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Syndicat Test').last);
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();

      final List<FormDraft> rows = await drafts();
      expect(rows, hasLength(1));
      final Map<String, Object?> values =
          jsonDecode(rows.single.payload) as Map<String, Object?>;
      expect(values['banqueId'], 'bq-1');
      expect(values['syndicatId'], 'sy-1');
    });

    formTestWidgets('un brouillon d\'un AUTRE représentant n\'est pas repris', (
      WidgetTester tester,
    ) async {
      // Rattacher les prospects d'un représentant à un autre, c'est fausser
      // l'attribution, donc la commission de fin de mois.
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
      await insertRepresentant(db, id: 'rep-2', phone: '+221770000002');
      await seedDraft(
        draftId: 'brouillon-autre',
        formKey: 'prospect.create',
        parentId: 'rep-2',
        values: <String, Object?>{
          'nom': 'Sow',
          'prenom': 'Awa',
          'representantId': 'rep-2',
        },
      );

      await tester.pumpWidget(host(const ProspectEntryScreen(representantId: 'rep-1')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsNothing);
    });

    formTestWidgets('le brouillon du MÊME représentant est proposé', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
      await seedDraft(
        draftId: 'brouillon-mien',
        formKey: 'prospect.create',
        parentId: 'rep-1',
        values: <String, Object?>{
          'nom': 'Sow',
          'prenom': 'Awa',
          'representantId': 'rep-1',
        },
      );

      await tester.pumpWidget(host(const ProspectEntryScreen(representantId: 'rep-1')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsOneWidget);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('référentiels absents', () {
    /// Base SANS référentiel : l'état d'une installation neuve dont la première
    /// synchronisation n'a pas abouti.
    Future<AppDatabase> emptyDb() async {
      final AppDatabase fresh = AppDatabase(NativeDatabase.memory());
      await fresh.customStatement('PRAGMA foreign_keys = ON;');
      addTearDown(fresh.close);
      return fresh;
    }

    formTestWidgets('le formulaire DIT pourquoi « Enregistrer » reste grisé', (
      WidgetTester tester,
    ) async {
      // Sans ce bandeau, les listes ne réagissent à rien, le bouton reste
      // inerte, et rien à l'écran ne l'explique : le commercial conclut que
      // l'application est cassée.
      db = await emptyDb();

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Référentiels non téléchargés'), findsOneWidget);
      expect(
        find.widgetWithText(TextButton, 'Synchroniser'),
        findsOneWidget,
        reason: 'un diagnostic sans action laisse l\'utilisateur au même point',
      );
    });

    formTestWidgets('rien à dire quand les référentiels sont là', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Référentiels non téléchargés'), findsNothing);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('échec d\'enregistrement : le message doit être ATTEIGNABLE', () {
    /// Un numéro déjà pris sur l'appareil.
    ///
    /// L'index `representants_phone_unique` est une copie conforme de celui du
    /// serveur : ressaisir un représentant déjà enregistré fait lever
    /// l'insertion, et c'est le chemin d'échec RÉEL le plus fréquent, pas une
    /// panne simulée. C'est aussi le seul moyen honnête de faire échouer une
    /// écriture locale : le reste du chemin n'a pas de réseau à couper.
    const String duplicatePhone = '+221771234567';
    const String typedPhone = '77 123 45 67';
    const String expected = 'Ce numéro est déjà enregistré sur cet appareil.';

    Future<void> fillAndSave(WidgetTester tester) async {
      await tester.enterText(
        find.widgetWithText(TextField, 'Nom complet'),
        'Ousmane Fall',
      );
      await tester.pumpAndSettle();
      // Le département AVANT le téléphone : saisir le numéro fait apparaître le
      // bandeau de doublon, qui décale la liste déroulante en cours d'ouverture.
      await tester.tap(find.widgetWithText(TextField, 'Département'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Dakar').last);
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, 'Téléphone'), typedPhone);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      // Des images comptées plutôt que `pumpAndSettle` : l'appui allume
      // l'indicateur de progression du bouton, dont l'animation replanifie une
      // image sans fin. `pumpAndSettle` attendrait alors ses dix minutes de
      // garde pour rien. Trois cents millisecondes suffisent à l'écriture
      // locale, à son échec, et au rendu du message.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    }

    formTestWidgets('il s\'affiche dans la barre épinglée, HORS de la liste', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'rep-existant', phone: duplicatePhone);

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await fillAndSave(tester);

      // Deux exemplaires du même texte, et c'est voulu : la barre épinglée et
      // l'infobulle. On isole celui de la barre par sa colonne : celle qui
      // porte aussi le bouton d'enregistrement.
      final Finder saveBarColumn = find
          .ancestor(
            of: find.widgetWithText(FilledButton, 'Enregistrer et saisir des prospects'),
            matching: find.byType(Column),
          )
          .first;
      final Finder message = find.descendant(
        of: saveBarColumn,
        matching: find.text(expected),
      );
      expect(message, findsOneWidget);

      // ═══ LE POINT DE TOUT LE TEST ═══
      //
      // Rendu en dernier enfant de la `ListView`, le message existait bien dans
      // l'arbre : `findsOneWidget` passait déjà. Il n'était simplement VISIBLE
      // que si l'utilisateur se trouvait par hasard au bas du formulaire.
      // L'assertion porte donc sur la position, pas sur l'existence.
      expect(
        find.ancestor(of: message, matching: find.byType(ListView)),
        findsNothing,
        reason: 'dans la liste, il défile hors de vue avec le reste',
      );

      final Rect list = tester.getRect(find.byType(ListView));
      final Rect banner = tester.getRect(message);
      expect(
        banner.top,
        greaterThanOrEqualTo(list.bottom),
        reason: 'il doit être SOUS la zone défilante, au contact du bouton',
      );
      expect(
        banner.bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(Scaffold)).bottom),
        reason: 'sous le bas de l\'écran, il n\'est pas plus lisible que dans la liste',
      );
    });

    formTestWidgets('il est ANNONCÉ : région vivante et annonce assertive', (
      WidgetTester tester,
    ) async {
      // Pendant une dictée, les yeux sont sur la liste de noms et pas sur
      // l'écran : un message seulement peint n'est perçu par personne.
      final SemanticsHandle semantics = tester.ensureSemantics();

      // `SemanticsService.sendAnnouncement` sort par `flutter/accessibility` ;
      // c'est le seul endroit où l'on peut constater qu'elle a bien été émise.
      final List<Map<Object?, Object?>> announcements = <Map<Object?, Object?>>[];
      tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler<Object?>(
        SystemChannels.accessibility,
        (Object? message) async {
          announcements.add(message! as Map<Object?, Object?>);
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockDecodedMessageHandler<Object?>(
          SystemChannels.accessibility,
          null,
        ),
      );

      await insertRepresentant(db, id: 'rep-existant', phone: duplicatePhone);
      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await fillAndSave(tester);

      final Finder pinned = find.descendant(
        of: find
            .ancestor(
              of: find.widgetWithText(
                FilledButton,
                'Enregistrer et saisir des prospects',
              ),
              matching: find.byType(Column),
            )
            .first,
        matching: find.text(expected),
      );
      expect(
        tester.getSemantics(pinned),
        matchesSemantics(label: expected, isLiveRegion: true),
        reason:
            'sans région vivante, TalkBack ne relit rien : le message reste '
            'muet pour qui ne regarde pas l\'écran',
      );

      final Iterable<Map<Object?, Object?>> announced = announcements.where(
        (Map<Object?, Object?> event) => event['type'] == 'announce',
      );
      expect(announced, isNotEmpty, reason: 'aucune annonce n\'est partie');
      final Map<Object?, Object?> data = announced.last['data']! as Map<Object?, Object?>;
      expect(data['message'], expected);
      expect(
        data['assertiveness'],
        Assertiveness.assertive.index,
        reason:
            'un échec d\'enregistrement interrompt la lecture en cours ; mis en '
            'file d\'attente, il arrive après que le commercial est passé au suivant',
      );

      // Le second canal : l'infobulle, qui passe par-dessus le clavier ouvert.
      expect(find.widgetWithText(SnackBar, expected), findsOneWidget);

      // Le contrôle de fin de test exige que la poignée soit rendue AVANT les
      // `tearDown` ; `addTearDown` arriverait trop tard et ferait échouer un
      // test par ailleurs vert.
      semantics.dispose();
    });

    formTestWidgets('la saisie N\'EST PAS enregistrée quand l\'écriture échoue', (
      WidgetTester tester,
    ) async {
      // Un message d'erreur au-dessus d'une ligne partie quand même serait pire
      // que pas de message du tout.
      await insertRepresentant(db, id: 'rep-existant', phone: duplicatePhone);

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await fillAndSave(tester);

      expect(await db.select(db.representants).get(), hasLength(1));
      expect(await db.select(db.outbox).get(), isEmpty);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('bandeau de contexte de la saisie de prospects', () {
    /// La hauteur du bandeau est MESURÉE, et cette mesure doit tenir à 1,8.
    ///
    /// Elle était figée à 28 px : une ligne de `bodySmall` à l'échelle 1,0. À
    /// « Très grand », la même ligne en réclame près de 40 et le texte sortait
    /// du bas de la barre. Le balayage de débordement ne voit pas ce défaut :
    /// un texte coupé par une hauteur trop courte ne lève aucun `RenderFlex`.
    testWidgets('le texte reste entièrement dans la barre à 1,8', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(320 * 3, 780 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Mamadou Diallo Ndiaye',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            apiPortProvider.overrideWithValue(api),
            tokenStoreProvider.overrideWithValue(
              InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
            ),
            syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: Builder(
              builder: (BuildContext context) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(1.8)),
                child: const ProspectEntryScreen(representantId: 'rep-1'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final Finder strip = find.textContaining('Mamadou Diallo Ndiaye');
      expect(strip, findsOneWidget);
      expect(
        tester.getRect(strip).bottom,
        lessThanOrEqualTo(tester.getRect(find.byType(AppBar)).bottom),
        reason: 'une hauteur figée coupe la dernière ligne sans rien signaler',
      );

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('sélecteur de représentant', () {
    formTestWidgets('la recherche survit à un aller-retour', (WidgetTester tester) async {
      // Le terme vivait dans un `Notifier` de portée racine pendant que le
      // `TextField` repartait vide : on revenait sur une boîte de recherche
      // vide au-dessus d'une liste toujours filtrée, souvent accompagnée d'un
      // « Aucun résultat » que rien n'expliquait.
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');

      final ProviderContainer container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        ],
      );
      addTearDown(container.dispose);
      container.read(representantPickerSearchProvider.notifier).set('Ousmane');

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: const RepresentantPickerScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.widgetWithText(TextField, 'Ousmane'),
        findsOneWidget,
        reason: 'le champ doit refléter le filtre réellement appliqué',
      );
    });

    formTestWidgets('créer après une recherche vaine EMPORTE la recherche', (
      WidgetTester tester,
    ) async {
      // Chercher « Ousmane », ne pas le trouver, puis retaper « Ousmane » dans
      // l'écran suivant : un geste de plus juste après en avoir fait un pour
      // rien.
      expect(Routes.newRepresentantPrefilled('Ousmane Fall'), contains('nom=Ousmane'));
      // Une recherche par numéro atterrit dans le champ téléphone, pas dans le
      // nom.
      expect(Routes.newRepresentantPrefilled('77 123 45 67'), contains('tel='));
      expect(Routes.newRepresentantPrefilled('   '), Routes.newRepresentant);

      await tester.pumpWidget(
        host(const RepresentantFormScreen(prefillName: 'Ousmane Fall')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Ousmane Fall'), findsOneWidget);

      await tester.pumpWidget(
        host(const RepresentantFormScreen(prefillPhone: '77 123 45 67')),
      );
      await tester.pumpAndSettle();
      expect(find.text('77 123 45 67'), findsOneWidget);
    });
  });
}

/// Coordinateur à l'arrêt : le vrai branche un minuteur de 60 s et un écouteur
/// de connectivité, et ne se stabilise jamais dans un test de widget.
class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
