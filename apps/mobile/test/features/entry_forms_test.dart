import 'dart:convert';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/features/representant/presentation/representant_picker_screen.dart';
import 'package:drift/native.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/token_store.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/utils/whatsapp.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_entry_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_form_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
// `Column` est masqué : celui de drift décrit une colonne SQL, et les finders
// de ce fichier visent celui de Flutter.
import 'package:drift/drift.dart' hide Column, isNotNull, isNull;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';

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
/// La saisie d'un champ ForUI : le libellé est posé À CÔTÉ de la zone de
/// texte au lieu d'être logé dedans, hors de portée de `find.widgetWithText`.
/// `FTextField` couvre aussi bien `CpiField` que les champs téléphone et les
/// listes assistées, qui l'emploient directement.
Finder champ(String label) => find.descendant(
  of: find.ancestor(of: find.text(label), matching: find.byType(FTextField)),
  matching: find.byType(TextField),
);

Finder bouton(String label) =>
    find.byWidgetPredicate((Widget w) => w is CpiButton && w.label == label);

/// La création d'un représentant se fait en TROIS étapes : qui est-ce, où
/// travaille-t-il, de quoi l'appeler. Un test qui vise un champ des deux
/// dernières doit franchir les précédentes, comme le commercial.
Future<void> etapeIdentite(
  WidgetTester tester, {
  String nom = 'Ousmane Fall',
  String telephone = '77 123 45 67',
}) async {
  await tester.enterText(champ('Nom complet'), nom);
  await tester.pumpAndSettle();
  await tester.enterText(champ('Téléphone'), telephone);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continuer'));
  await tester.pumpAndSettle();
}

Future<void> etapeLieu(
  WidgetTester tester, {
  String nom = 'Ousmane Fall',
  String telephone = '77 123 45 67',
  String departement = 'Dakar',
}) async {
  await etapeIdentite(tester, nom: nom, telephone: telephone);
  await tester.tap(champ('Département'));
  await tester.pumpAndSettle();
  await tester.tap(find.text(departement).last);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continuer'));
  await tester.pumpAndSettle();
}

/// La MODIFICATION suit les mêmes trois étapes que la création : la fiche est
/// déjà remplie, il n'y a donc rien à saisir pour les franchir.
Future<void> jusquAuContact(WidgetTester tester) async {
  await tester.tap(find.text('Continuer'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continuer'));
  await tester.pumpAndSettle();
}

/// La saisie d'un prospect CHUES se fait en DEUX étapes : qui est-ce, puis sa
/// banque et son syndicat. Un test qui vise la banque doit franchir la
/// première, comme le téléconseiller.
Future<void> etapeProspectQui(
  WidgetTester tester, {
  String prenom = 'Awa',
  String nom = 'Sow',
  String telephone = '77 123 45 67',
}) async {
  await tester.enterText(champ('Prénom'), prenom);
  await tester.pumpAndSettle();
  await tester.enterText(champ('Nom'), nom);
  await tester.pumpAndSettle();
  await tester.enterText(champ('Téléphone'), telephone);
  await tester.pumpAndSettle();
  await tester.tap(find.text('Continuer'));
  await tester.pumpAndSettle();
}

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

  Widget host(Widget screen, {WriteRepository? writes}) {
    return ProviderScope(
      overrides: [
        if (writes != null) writeRepositoryProvider.overrideWithValue(writes),
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

  /// Le même hôte, mais routé : un enregistrement qui aboutit enchaîne sur la
  /// saisie de prospects, et `pushReplacement` exige un routeur.
  Widget hostRouted(Widget screen) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        ),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        routerConfig: GoRouter(
          initialLocation: Routes.newRepresentant,
          routes: <RouteBase>[
            GoRoute(
              path: Routes.newRepresentant,
              builder: (BuildContext context, GoRouterState state) => screen,
            ),
            GoRoute(
              path: Routes.newProspect,
              builder: (BuildContext context, GoRouterState state) =>
                  const Scaffold(body: Text('prospects')),
            ),
          ],
        ),
      ),
    );
  }

  /// L'annuaire et la fiche sur le même routeur : c'est l'enchaînement réel,
  /// et il ne s'observe pas sur un écran monté seul.
  Widget hostPicker() {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore(refreshToken: 'r', userId: 'me'),
        ),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        routerConfig: GoRouter(
          initialLocation: Routes.representants,
          routes: <RouteBase>[
            GoRoute(
              path: Routes.representants,
              builder: (BuildContext context, GoRouterState state) =>
                  const RepresentantPickerScreen(),
            ),
            GoRoute(
              path: Routes.newRepresentant,
              builder: (BuildContext context, GoRouterState state) =>
                  RepresentantFormScreen(
                    draftId: state.uri.queryParameters[Routes.draftParam],
                    representantId: state.uri.queryParameters['id'],
                    prefillName:
                        state.uri.queryParameters[Routes.prefillNameParam],
                    prefillPhone:
                        state.uri.queryParameters[Routes.prefillPhoneParam],
                  ),
            ),
            GoRoute(
              path: Routes.representantDetail,
              builder: (BuildContext context, GoRouterState state) =>
                  const Scaffold(body: Text('fiche')),
            ),
            GoRoute(
              path: Routes.newProspect,
              builder: (BuildContext context, GoRouterState state) =>
                  const Scaffold(body: Text('prospects')),
            ),
          ],
        ),
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
    formTestWidgets(
      'un écran ouvert SANS référence retrouve le dernier brouillon',
      (WidgetTester tester) async {
        // Le cas normal : le commercial tape « Nouveau représentant » depuis le
        // sélecteur. Aucun `?draft=` dans l'URL, donc un identifiant neuf, donc
        // une lecture à vide : le formulaire revenait vierge alors que la saisie
        // était intacte en base.
        await seedDraft(
          draftId: 'brouillon-1',
          formKey: 'representant.create',
          values: <String, Object?>{
            'fullName': 'Ousmane Fall',
            'phone': '77 123 45 67',
          },
        );

        await tester.pumpWidget(host(const RepresentantFormScreen()));
        await tester.pumpAndSettle();

        expect(find.textContaining('Saisie non terminée'), findsOneWidget);
        expect(find.textContaining('Ousmane Fall'), findsOneWidget);
      },
    );

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
      // Le département est à l'étape suivante : la reprise le rapporte aussi.
      await tester.tap(find.text('Continuer'));
      await tester.pumpAndSettle();
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

    /// ═══ LE BROUILLON D'UNE CORRECTION DANS UN FORMULAIRE NEUF ═══
    ///
    /// `latestFor` ne filtre que sur `formKey`, et création comme modification
    /// écrivent sous `representant.create`. Deux gestes ordinaires suffisaient :
    /// sortir d'une correction de la fiche R, puis appuyer sur « Nouveau
    /// représentant » dans la minute. À moins de 60 secondes, `DraftAge.crash`
    /// appliquait le brouillon de R **sans rien demander** : le formulaire neuf
    /// se remplissait de son nom et de son numéro, l'écran adoptait son
    /// `draftId`, et l'enregistrement supprimait la correction de R tout en
    /// tentant une fiche en doublon.
    formTestWidgets(
      'une correction inachevée ne remonte PAS dans une création',
      (WidgetTester tester) async {
        await insertRepresentant(db, id: 'rep-9', phone: '+221770000009');
        await seedDraft(
          draftId: 'brouillon-edit',
          formKey: 'representant.create',
          entityId: 'rep-9',
          // Dans la fenêtre de reprise silencieuse : c'est ce qui rendait le
          // défaut invisible, l'utilisateur n'avait rien à confirmer.
          age: const Duration(seconds: 5),
          values: <String, Object?>{
            'fullName': 'Nom corrigé',
            'phone': '77 000 00 09',
            'departementId': 'dep-1',
            'departementLabel': 'Dakar',
          },
        );

        await tester.pumpWidget(host(const RepresentantFormScreen()));
        await tester.pumpAndSettle();

        expect(find.text('Nom corrigé'), findsNothing);
        expect(find.text('Dakar'), findsNothing);
        expect(find.textContaining('Saisie non terminée'), findsNothing);

        // Et la correction est toujours là, intacte, pour la fiche à qui elle
        // appartient.
        final List<FormDraft> rows = await drafts();
        expect(rows, hasLength(1));
        expect(rows.single.draftId, 'brouillon-edit');
        expect(rows.single.entityId, 'rep-9');
      },
    );

    /// Le pendant : un brouillon de CRÉATION abandonné doit, lui, toujours
    /// remonter. Le garde sépare les deux, il n'éteint pas la reprise.
    formTestWidgets('un brouillon de création abandonné remonte toujours', (
      WidgetTester tester,
    ) async {
      await seedDraft(
        draftId: 'brouillon-create',
        formKey: 'representant.create',
        // Un identifiant d'entité qu'aucune fiche ne réclame : la transaction
        // d'enregistrement supprime le brouillon au moment où la fiche
        // apparaît, donc les deux ne coexistent jamais.
        entityId: 'rep-jamais-enregistre',
        values: <String, Object?>{
          'fullName': 'Ousmane Fall',
          'phone': '77 123 45 67',
        },
      );

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsOneWidget);
      expect(find.textContaining('Ousmane Fall'), findsOneWidget);
    });

    /// ═══ « SUPPRIMER » NE SUPPRIMAIT RIEN ═══
    ///
    /// L'adoption de l'identifiant retrouvé n'a lieu que dans `_apply`. Sur le
    /// chemin `latestFor`, `_draftId` est donc encore l'identifiant neuf tiré au
    /// montage, et `delete(_draftId)` ne touchait aucune ligne : la bannière
    /// disparaissait, le brouillon survivait, et la même saisie périmée revenait
    /// à chaque ouverture pendant sept jours.
    formTestWidgets('« Supprimer » efface le brouillon RETROUVÉ', (
      WidgetTester tester,
    ) async {
      await seedDraft(
        draftId: 'brouillon-1',
        formKey: 'representant.create',
        values: <String, Object?>{
          'fullName': 'Ousmane Fall',
          'phone': '77 123 45 67',
        },
      );

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Supprimer'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsNothing);
      expect(await drafts(), isEmpty);
    });

    // ═══ LA CASCADE RÉGION → DÉPARTEMENT ═══
    //
    // « Elle a tapé Tambacounda pour le département » : la liste plate de 46
    // entrées demande le nom exact d'un découpage que personne ne récite.
    formTestWidgets('choisir une région ne laisse que ses départements', (
      WidgetTester tester,
    ) async {
      await seedRegion(db, regionId: 'reg-tc', regionName: 'Tambacounda');

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeIdentite(tester);

      await tester.tap(champ('Région'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tambacounda').last);
      await tester.pumpAndSettle();

      await tester.tap(champ('Département'));
      await tester.pumpAndSettle();

      expect(find.text('Bakel'), findsOneWidget);
      // Le département de la région restée en dehors ne doit plus être offert.
      expect(find.text('Dakar'), findsNothing);
    });

    // Le même geste que « département → IEF » : garder l'ancien choix laisserait
    // une fiche rattachée à un département qui n'est plus dans la région
    // affichée, et personne ne le verrait à la relecture.
    formTestWidgets('changer de région remet le département à zéro', (
      WidgetTester tester,
    ) async {
      await seedRegion(db, regionId: 'reg-tc', regionName: 'Tambacounda');

      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeIdentite(tester);

      await tester.tap(champ('Département'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Dakar').last);
      await tester.pumpAndSettle();

      await tester.tap(champ('Région'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tambacounda').last);
      await tester.pumpAndSettle();

      final TextField departement = tester.widget<TextField>(
        champ('Département'),
      );
      expect(departement.controller?.text, isEmpty);
    });

    formTestWidgets(
      'un département choisi seul est un brouillon, pas du vide',
      (WidgetTester tester) async {
        // Choisir dans une liste est le geste le plus lent d'un formulaire
        // tactile. Le compter pour rien parce que le nom n'est pas encore tapé
        // jetait exactement ce qu'on cherche à protéger.
        await tester.pumpWidget(host(const RepresentantFormScreen()));
        await tester.pumpAndSettle();
        await etapeIdentite(tester);

        await tester.tap(champ('Département'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Dakar').last);
        await tester.pumpAndSettle();
        // La traîne de l'anti-rebond, puis l'écriture.
        await tester.pump(const Duration(seconds: 1));
        await tester.pumpAndSettle();

        final List<FormDraft> rows = await drafts();
        expect(rows, hasLength(1));
        expect(
          jsonDecode(rows.single.payload) as Map<String, Object?>,
          containsPair('departementId', 'dep-1'),
        );
      },
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('reprise d\'une saisie de prospect', () {
    formTestWidgets('banque et syndicat choisies partent dans le brouillon', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();
      await etapeProspectQui(tester);

      await tester.tap(champ('Banque'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Banque Test').last);
      await tester.pumpAndSettle();
      await tester.tap(champ('Syndicat'));
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

    // Le Grand Public n'exige que le nom, le numéro et la situation. Rendre un
    // champ de plus obligatoire, c'est une fiche abandonnée sur le terrain.
    formTestWidgets('le Grand Public attend la situation, et rien de plus', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const ProspectEntryScreen(projet: 'GRAND_PUBLIC')),
      );
      await tester.pumpAndSettle();

      await tester.enterText(champ('Nom'), 'Ndiaye');
      await tester.enterText(champ('Téléphone'), '77 000 00 42');
      await tester.pumpAndSettle();

      // Étape 1 sur 3 : « Continuer » reste éteint tant que la situation manque,
      // et il DIT lequel.
      final Finder continuer = bouton('Continuer');
      expect(tester.widget<CpiButton>(continuer).onPressed, isNull);
      expect(
        tester.widget<CpiButton>(continuer).subtitle,
        'Choisissez la situation',
      );

      await tester.tap(find.text('Informel'));
      await tester.pumpAndSettle();

      expect(tester.widget<CpiButton>(continuer).onPressed, isNotNull);

      // Les deux étapes suivantes sont facultatives : rien n'y retient.
      await tester.tap(continuer);
      await tester.pumpAndSettle();
      expect(find.text('Activité'), findsOneWidget);
      await tester.tap(bouton('Continuer'));
      await tester.pumpAndSettle();
      expect(find.text('Banque de domiciliation'), findsNothing);
      expect(find.text('Syndicat'), findsNothing);
      expect(find.text('Provenance'), findsOneWidget);

      expect(
        tester.widget<CpiButton>(bouton('Enregistrer et suivant')).onPressed,
        isNotNull,
      );
    });

    formTestWidgets('la fiche Grand Public emporte ses champs propres', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const ProspectEntryScreen(projet: 'GRAND_PUBLIC')),
      );
      await tester.pumpAndSettle();

      await tester.enterText(champ('Nom'), 'Ndiaye');
      await tester.enterText(champ('Téléphone'), '77 000 00 42');
      await tester.tap(find.text('Fonctionnaire'));
      await tester.pumpAndSettle();
      // Le travail est à l'étape 2, la banque et la provenance à l'étape 3.
      await tester.tap(bouton('Continuer'));
      await tester.pumpAndSettle();
      await tester.enterText(champ('Profession'), 'Instituteur');
      await tester.enterText(champ('Ancienneté'), '24');
      await tester.pumpAndSettle();
      await tester.tap(bouton('Continuer'));
      await tester.pumpAndSettle();
      // Le libellé ForUI est posé AU-DESSUS du champ et les cibles tactiles
      // font 48 dp au plancher : le formulaire est plus haut qu'avec les
      // étiquettes flottantes de Material, et la `ListView` ne construit même
      // plus le dernier champ tant qu'on ne l'a pas amené à l'image.
      await tester.scrollUntilVisible(
        find.text('Provenance'),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(champ('Provenance'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Parrainage').last);
      await tester.pumpAndSettle();

      await tester.tap(bouton('Enregistrer et suivant'));
      // Des images comptées plutôt que `pumpAndSettle` : l'appui allume
      // l'indicateur de progression du bouton, dont l'animation replanifie une
      // image sans fin.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final Prospect fiche = (await db.select(db.prospects).get()).single;
      expect(fiche.projet, 'GRAND_PUBLIC');
      expect(fiche.type, 'FONCTIONNAIRE');
      expect(fiche.profession, 'Instituteur');
      expect(fiche.dureeSystemeMois, 24);
      expect(fiche.canalProvenanceId, 'cn-1');
      // Le parcours s'ouvre à la saisie : sans lui la fiche n'apparaîtrait dans
      // aucune liste de projet tant que le serveur ne l'a pas rendue.
      expect(
        (await db.select(db.prospectJourneys).get()).single.projet,
        'GRAND_PUBLIC',
      );
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

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
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

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Saisie non terminée'), findsOneWidget);
    });

    /// Même défaut que sur le formulaire de représentant : l'adoption de
    /// l'identifiant retrouvé n'a lieu que dans `_apply`, donc « Supprimer »
    /// visait l'identifiant neuf du montage et ne touchait aucune ligne.
    formTestWidgets('« Supprimer » efface le brouillon RETROUVÉ', (
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

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Supprimer'));
      await tester.pumpAndSettle();
      // L'appui de ForUI arme un minuteur de 150 ms qui ne programme aucune
      // image : `pumpAndSettle` s'arrête avant lui, et le démontage échoue
      // alors sur « A Timer is still pending ».
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.textContaining('Saisie non terminée'), findsNothing);
      expect(await drafts(), isEmpty);
    });
  });

  // Le brouillon se jetait APRÈS l'écriture. Le minuteur de 400 ms armé par la
  // dernière frappe se déclenchait pendant l'attente et réécrivait la ligne que
  // la transaction venait de supprimer : au retour, « Saisie non terminée »
  // proposait un prospect DÉJÀ enregistré, et le téléconseiller le ressaisissait.
  formTestWidgets('un enregistrement lent ne laisse pas le brouillon revenir', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');

    await tester.pumpWidget(
      host(
        const ProspectEntryScreen(representantId: 'rep-1'),
        writes: _SlowWrites(db),
      ),
    );
    await tester.pumpAndSettle();

    await etapeProspectQui(tester, telephone: '771234567');
    await tester.tap(champ('Banque'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Banque Test').last);
    await tester.pumpAndSettle();
    await tester.tap(champ('Syndicat'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Syndicat Test').last);
    await tester.pumpAndSettle();

    // Une frappe juste avant l'appui : le minuteur du brouillon est armé et n'a
    // pas encore tiré.
    await tester.enterText(champ('Syndicat'), 'Syndicat Tes');
    await tester.pump();
    await tester.tap(find.text('Enregistrer et terminer'));
    // Des images comptées : « et terminer » quitte l'écran, et sans navigateur
    // pour l'emmener l'indicateur du bouton tourne indéfiniment. `pumpAndSettle`
    // attendrait alors ses dix minutes de garde pour rien.
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    expect(await db.select(db.prospects).get(), hasLength(1));
    expect(await drafts(), isEmpty);
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

      expect(
        find.textContaining('Les listes ne sont pas encore'),
        findsOneWidget,
      );
      expect(
        find.widgetWithText(FButton, 'Recevoir les listes'),
        findsOneWidget,
        reason: 'un diagnostic sans action laisse l\'utilisateur au même point',
      );
    });

    formTestWidgets('rien à dire quand les référentiels sont là', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Les listes ne sont pas encore'),
        findsNothing,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('ce que le système sait déjà, le téléconseiller ne le tape pas', () {
    formTestWidgets('les notes saisies suivent le représentant', (
      WidgetTester tester,
    ) async {
      // Le champ manquait à l'application : la colonne existait, le panneau web
      // l'affichait, et aucun écran mobile ne pouvait l'écrire.
      await tester.pumpWidget(hostRouted(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeLieu(tester);

      await tester.enterText(champ('Notes (facultatif)'), 'Absent le vendredi');
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final Representant row = await db.select(db.representants).getSingle();
      expect(row.notes, 'Absent le vendredi');
      final OutboxData op = await db.select(db.outbox).getSingle();
      expect(
        (jsonDecode(op.payload) as Map<String, Object?>)['notes'],
        'Absent le vendredi',
      );
    });

    /// Un téléconseiller ne tape pas. « Le même que son téléphone » et une
    /// profession fréquente sont DEUX appuis, pas neuf chiffres ressaisis.
    formTestWidgets('WhatsApp et profession se posent sans rien ressaisir', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(hostRouted(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeLieu(tester);

      await tester.tap(find.text('Même numéro'));
      await tester.pumpAndSettle();
      await tester.tap(champ('Profession (facultatif)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Instituteur').last);
      await tester.pumpAndSettle();

      // Aucun second champ de numéro n'apparaît : il n'y a rien à taper.
      expect(champ('Numéro WhatsApp'), findsNothing);

      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final Representant row = await db.select(db.representants).getSingle();
      expect(row.whatsappStatus, 'MEME_NUMERO');
      expect(row.profession, 'Instituteur');
      // Le numéro n'est pas dupliqué : la correction du téléphone n'aurait
      // aucune copie à tenir d'accord.
      expect(row.whatsappE164, isNull);
    });

    formTestWidgets('un état WhatsApp venu du serveur n\'est pas rétrogradé', (
      WidgetTester tester,
    ) async {
      // Corriger le nom d'une fiche ne doit pas repasser en « non demandé » un
      // état que le serveur a ajouté après cette version de l'application.
      await insertRepresentant(
        db,
        id: 'rep-9',
        phone: '+221770000009',
        whatsappStatus: 'NUMERO_PROFESSIONNEL',
      );

      await tester.pumpWidget(
        hostRouted(const RepresentantFormScreen(representantId: 'rep-9')),
      );
      await tester.pumpAndSettle();

      await tester.enterText(champ('Nom complet'), 'Ousmane Fall');
      await tester.pumpAndSettle();
      await jusquAuContact(tester);

      expect(
        find.widgetWithText(FTile, 'NUMERO_PROFESSIONNEL'),
        findsOneWidget,
      );

      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final Representant row = await db.select(db.representants).getSingle();
      expect(row.whatsappStatus, 'NUMERO_PROFESSIONNEL');
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
      // Le doublon se signale dès l'étape de l'identité ; le département vient
      // à l'étape suivante, où plus aucun bandeau ne décale la liste.
      await etapeLieu(tester, telephone: typedPhone);

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
            of: find.widgetWithText(
              FButton,
              'Enregistrer et saisir des prospects',
            ),
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
        lessThanOrEqualTo(tester.getRect(find.byType(CpiScaffold)).bottom),
        reason:
            'sous le bas de l\'écran, il n\'est pas plus lisible que dans la liste',
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
      final List<Map<Object?, Object?>> announcements =
          <Map<Object?, Object?>>[];
      tester.binding.defaultBinaryMessenger
          .setMockDecodedMessageHandler<Object?>(SystemChannels.accessibility, (
            Object? message,
          ) async {
            announcements.add(message! as Map<Object?, Object?>);
            return null;
          });
      addTearDown(
        () => tester.binding.defaultBinaryMessenger
            .setMockDecodedMessageHandler<Object?>(
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
                FButton,
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
      final Map<Object?, Object?> data =
          announced.last['data']! as Map<Object?, Object?>;
      expect(data['message'], expected);
      expect(
        data['assertiveness'],
        Assertiveness.assertive.index,
        reason:
            'un échec d\'enregistrement interrompt la lecture en cours ; mis en '
            'file d\'attente, il arrive après que le commercial est passé au suivant',
      );

      // Le second canal : l'infobulle, qui passe par-dessus le clavier ouvert.
      // Elle porte le même texte que la barre épinglée, d'où les deux
      // exemplaires.
      expect(find.text(expected), findsNWidgets(2));

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
    /// Le bandeau a longtemps vécu sous une hauteur MESURÉE, puis figée à 28 px
    /// — une ligne de `bodySmall` à l'échelle 1,0. À « Très grand », la même
    /// ligne en réclame près de 40 et le texte sortait du bas de la barre. Le
    /// balayage de débordement ne voit pas ce défaut : un texte coupé par une
    /// hauteur trop courte ne lève aucun `RenderFlex`.
    ///
    /// Le bandeau défile désormais avec le formulaire, sans hauteur imposée :
    /// ce qui reste à tenir est qu'il coiffe le corps et qu'il prenne toute la
    /// hauteur qu'il demande. La comparaison avec le premier champ n'est plus
    /// possible : à 320 dp et 1,8, le bandeau à lui seul dépasse la hauteur du
    /// corps, et la bascule « le représentant lui-même » s'intercale ensuite.
    testWidgets('le texte prend toute sa hauteur, en tête du corps, à 1,8', (
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

      // Le champ « Nom » s'autofocalise et fait défiler la liste jusqu'à lui :
      // à 320 dp et 1,8, la bascule « le représentant lui-même » suffit à
      // pousser le bandeau hors du viewport. Ce qui se vérifie ici est sa mise
      // en page, pas sa position après un défilement : on revient en haut.
      tester
          .state<ScrollableState>(
            find
                .descendant(
                  of: find.byType(CustomScrollView),
                  matching: find.byType(Scrollable),
                )
                .first,
          )
          .position
          .jumpTo(0);
      await tester.pumpAndSettle();

      final Finder strip = find.textContaining('Mamadou Diallo Ndiaye');
      expect(strip, findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(
        tester.getRect(strip).top,
        tester.getRect(find.byType(CustomScrollView)).top,
        reason: 'le bandeau coiffe le formulaire, il ne se glisse pas dedans',
      );
      expect(
        tester.getSize(strip).height,
        greaterThan(28),
        reason:
            'la hauteur figée à 28 px coupait la dernière ligne sans rien '
            'signaler : le bandeau prend désormais la place qu\'il demande',
      );

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Le représentant qui vend le produit finit souvent par y souscrire : il
  // devient alors un prospect chez lui-même. Sans cette bascule, le
  // téléconseiller retapait un nom et un numéro qu'il avait sous les yeux.
  group('le représentant lui-même', () {
    formTestWidgets('la bascule remplit le nom et verrouille le numéro', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Le représentant lui-même est intéressé'));
      await tester.pumpAndSettle();

      expect(find.text('Ousmane'), findsOneWidget);
      expect(find.text('Fall'), findsOneWidget);
      expect(find.text('77 000 00 01'), findsOneWidget);
      expect(
        tester.widget<TextField>(champ('Téléphone')).enabled,
        isFalse,
        reason: 'le numéro vient de la fiche : le retoucher casserait le lien',
      );
      // La première étape est complète du seul fait de la bascule : rien à
      // taper avant de passer à la banque.
      expect(
        tester.widget<CpiButton>(bouton('Continuer')).onPressed,
        isNotNull,
      );

      await tester.tap(bouton('Continuer'));
      await tester.pumpAndSettle();

      expect(
        tester.widget<CpiButton>(bouton('Enregistrer et suivant')).onPressed,
        isNotNull,
      );
    });

    formTestWidgets('elle enregistre un prospect ordinaire chez lui', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Le représentant lui-même est intéressé'));
      await tester.pumpAndSettle();
      await tester.tap(bouton('Continuer'));
      await tester.pumpAndSettle();
      await tester.tap(bouton('Enregistrer et suivant'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final List<Prospect> saisis = await db.select(db.prospects).get();
      expect(saisis, hasLength(1));
      expect(saisis.single.nom, 'Fall');
      expect(saisis.single.prenom, 'Ousmane');
      expect(saisis.single.phoneE164, '+221770000001');
      expect(saisis.single.representantId, 'rep-1');
      expect(saisis.single.projet, 'CHUES');
    });

    // Le représentant a déjà été saisi comme prospect : le même bandeau que
    // pour n'importe quel doublon, et rien de plus.
    formTestWidgets('un numéro déjà saisi porte le bandeau « Déjà saisi »', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await insertProspect(
        db,
        id: 'pro-1',
        representantId: 'rep-1',
        phone: '+221770000001',
        nom: 'Fall',
        prenom: 'Ousmane',
      );

      await tester.pumpWidget(
        host(const ProspectEntryScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Le représentant lui-même est intéressé'));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.text('Déjà saisi : Ousmane Fall'), findsOneWidget);
    });

    // Rien de tout cela dans le Grand Public : il n'y a pas de représentant.
    formTestWidgets('le Grand Public n\'a pas de bascule', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const ProspectEntryScreen(projet: 'GRAND_PUBLIC')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Le représentant lui-même est intéressé'), findsNothing);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('sélecteur de représentant', () {
    formTestWidgets('la recherche survit à un aller-retour', (
      WidgetTester tester,
    ) async {
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
        champ('Ousmane'),
        findsOneWidget,
        reason: 'le champ doit refléter le filtre réellement appliqué',
      );
    });

    // L'annuaire ne crée pas de représentant à partir d'une recherche vide.
    formTestWidgets('aucune création de représentant depuis l\'annuaire', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(hostPicker());
      await tester.pumpAndSettle();

      expect(find.text('Cherchez un représentant'), findsOneWidget);
      expect(find.text('Tapez son nom ou son numéro.'), findsOneWidget);
      expect(bouton('Créer un représentant'), findsNothing);

      await tester.enterText(find.byType(EditableText).first, 'Ousmane');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.text('Aucun résultat'), findsOneWidget);
      expect(bouton('Créer « Ousmane »'), findsNothing);
    });

    formTestWidgets('le représentant peut être passé', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(hostPicker());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Continuer sans représentant'));
      await tester.pumpAndSettle();

      expect(find.text('prospects'), findsOneWidget);
    });

    // Le formulaire de création reste routable pour la MODIFICATION d'une fiche
    // importée (`?id=`) ; plus aucun bouton n'y mène en création.
    formTestWidgets('un pré-remplissage arrive intact dans le formulaire', (
      WidgetTester tester,
    ) async {
      expect(
        Routes.newRepresentantPrefilled('Ousmane Fall'),
        contains('nom=Ousmane'),
      );
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

    formTestWidgets('choisir un représentant ouvre la saisie sans détour', (
      WidgetTester tester,
    ) async {
      // La feuille « Que voulez-vous faire ? » posait une question dont la
      // réponse était toujours la même. Le résultat de l'appel se consigne
      // depuis la fiche, où il a sa place.
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
        profession: 'Instituteur',
        relationStatus: 'AMBASSADEUR',
      );

      await tester.pumpWidget(hostPicker());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(EditableText).first, 'Ousmane');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Ousmane Fall'));
      await tester.pumpAndSettle();

      expect(find.text('prospects'), findsOneWidget);
    });

    // Le commercial est celui qui sait qu'un représentant vient d'accepter :
    // sans chemin d'écriture, l'information restait sur le terrain.
    formTestWidgets('la bascule de relation part avec son lot', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        serverUpdatedAt: DateTime.utc(2026, 8, 12),
      );

      await tester.pumpWidget(
        hostRouted(const RepresentantFormScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Ambassadeur'));
      await tester.pumpAndSettle();
      await jusquAuContact(tester);
      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final List<OutboxData> file = await allOutbox(db);
      final Map<String, Object?> envoi =
          jsonDecode(file.last.payload) as Map<String, Object?>;
      expect(envoi['relationStatus'], 'AMBASSADEUR');
    });

    // Un enregistrement qui ne touche pas à la relation ne doit pas la
    // reposter : le serveur écrirait une ligne d'histoire sans geste derrière.
    formTestWidgets('sans bascule, le statut n\'est pas renvoyé', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        relationStatus: 'AMBASSADEUR',
        serverUpdatedAt: DateTime.utc(2026, 8, 12),
      );

      await tester.pumpWidget(
        hostRouted(const RepresentantFormScreen(representantId: 'rep-1')),
      );
      await tester.pumpAndSettle();
      await jusquAuContact(tester);
      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final List<OutboxData> file = await allOutbox(db);
      final Map<String, Object?> envoi =
          jsonDecode(file.last.payload) as Map<String, Object?>;
      expect(envoi.containsKey('relationStatus'), isFalse);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  group('profession : une liste, pas une frappe libre', () {
    formTestWidgets('elle se choisit parmi les valeurs connues', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(hostRouted(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeLieu(tester);

      await tester.tap(champ('Profession (facultatif)'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Instituteur').last);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final Representant row = await db.select(db.representants).getSingle();
      expect(row.profession, 'Instituteur');
    });

    /// La liste ASSISTE la saisie, elle ne la borne pas : un métier absent du
    /// référentiel s'enregistre tel quel, et sans « Aucun résultat » qui ferait
    /// croire à un refus.
    formTestWidgets('un métier hors liste s\'enregistre quand même', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(hostRouted(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeLieu(tester);

      await tester.enterText(
        champ('Profession (facultatif)'),
        'Surveillant général',
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('Aucun résultat'), findsNothing);

      await tester.tap(find.text('Enregistrer et saisir des prospects'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final Representant row = await db.select(db.representants).getSingle();
      expect(row.profession, 'Surveillant général');
    });

    /// Le serveur plafonne la profession à 120 caractères, et un champ trop
    /// long fait refuser le LOT de synchronisation entier, pas cette fiche.
    formTestWidgets('la saisie s\'arrête au plafond du serveur', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RepresentantFormScreen()));
      await tester.pumpAndSettle();
      await etapeLieu(tester);

      await tester.enterText(champ('Profession (facultatif)'), 'a' * 400);
      await tester.pumpAndSettle();

      expect(
        tester
            .widget<TextField>(champ('Profession (facultatif)'))
            .controller!
            .text
            .length,
        kProfessionMaxLength,
      );
    });
  });
}

/// Une écriture lente : le temps que le minuteur du brouillon se déclenche.
class _SlowWrites extends WriteRepository {
  _SlowWrites(super.db);

  @override
  Future<String> createProspect({
    required String nom,
    required String prenom,
    required String phoneE164,
    required String createdById,
    String? banqueId,
    String? syndicatId,
    String? representantId,
    String? projet,
    String? type,
    String? profession,
    int? dureeSystemeMois,
    String? canalProvenanceId,
    String? id,
    String? draftId,
  }) async {
    final String created = await super.createProspect(
      nom: nom,
      prenom: prenom,
      phoneE164: phoneE164,
      banqueId: banqueId,
      syndicatId: syndicatId,
      representantId: representantId,
      createdById: createdById,
      id: id,
      draftId: draftId,
    );
    // La transaction a déjà supprimé le brouillon ; ce qui suit tient lieu du
    // reste d'un enregistrement lent sur un appareil d'entrée de gamme.
    await Future<void>.delayed(const Duration(milliseconds: 800));
    return created;
  }
}

/// Coordinateur à l'arrêt : le vrai branche un minuteur de 60 s et un écouteur
/// de connectivité, et ne se stabilise jamais dans un test de widget.
class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
