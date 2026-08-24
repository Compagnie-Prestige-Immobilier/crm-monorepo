import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/accueil/presentation/visite_form_screen.dart';
import 'package:cpi_go/features/accueil/visites_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le registre des visites sur mobile, hors ligne d'abord.
///
/// Ce que ces tests interdisent de perdre : une inscription qui part au
/// serveur avant que le réseau soit revenu, un registre illisible sans
/// connexion, un bouton d'enregistrement qui reste grisé après une erreur, un
/// numéro de téléphone reformaté en route, et une recherche ou une période
/// qui ne borne pas réellement ce que l'accueil voit.
void main() {
  final DateTime midi = DateTime.utc(2026, 8, 12, 9, 12);
  const String jour = '2026-08-12';

  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  /// Les listes vivent en base, comme en production : c'est le pull qui les
  /// dépose, plus aucun appel réseau ne les sert.
  Future<void> seedListes() async {
    Future<void> poser(String id, String kind, String label) => db
        .into(db.visiteReferentiels)
        .insert(
          VisiteReferentielsCompanion.insert(
            id: id,
            kind: kind,
            code: label.toUpperCase().replaceAll(' ', '_'),
            label: label,
            localUpdatedAt: midi,
          ),
        );

    await poser('e1', 'entreprises', 'CPI');
    await poser('e2', 'entreprises', 'SANTARGILE');
    await poser('d1', 'directions', 'COMMERCIALE');
    await poser('t1', 'destinataires', 'MME. NDOYE');
    await poser('o1', 'objets', 'ACHAT TERRAIN');
    await poser('o2', 'objets', 'SUIVI DE DOSSIER');
  }

  Widget host(
    Widget screen, {
    WriteRepository? writes,
    bool horsLigne = false,
    String role = 'ACCUEIL',
  }) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        if (writes != null) writeRepositoryProvider.overrideWithValue(writes),
        clockProvider.overrideWithValue(FakeClock(midi)),
        connectivitySourceProvider.overrideWithValue(
          _FakeSource(
            horsLigne ? ConnectivityResult.none : ConnectivityResult.wifi,
          ),
        ),
        networkValidationProvider.overrideWithValue(
          const _FakeValidation(true),
        ),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(() => _SignedIn(role)),
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

  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  group('registre', () {
    testWidgets('les visites déjà en base sont listées, pour le jour courant', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        date: jour,
        time: '09:12',
        visitorName: 'Awa Ndiaye',
      );
      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Awa Ndiaye'), findsOneWidget);
      expect(find.text('09:12'), findsOneWidget);
      expect(find.text('V-2026-000412'), findsOneWidget);
      expect(find.text('1 visite'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un registre vide dit quoi faire ensuite', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Aucune visite pour cette période'), findsOneWidget);
      expect(
        find.text('Inscrivez le premier visiteur avec le bouton du bas.'),
        findsOneWidget,
      );

      await teardownTree(tester);
    });

    testWidgets(
      'une visite refusée ou en conflit ne se dit pas « en attente »',
      (WidgetTester tester) async {
        await insertVisite(
          db,
          id: 'v1',
          reference: null,
          date: jour,
          time: '09:12',
          visitorName: 'Awa Ndiaye',
        );
        await queueOp(
          db,
          id: 'op-1',
          entityType: 'visite',
          entityId: 'v1',
          status: 'failed',
        );
        await tester.pumpWidget(host(const RegistreScreen()));
        await tester.pumpAndSettle();

        expect(find.text('Échec d\'envoi'), findsOneWidget);
        expect(find.text('En attente d\'envoi'), findsNothing);

        await teardownTree(tester);
      },
    );

    testWidgets('hors ligne, le registre reste lisible', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        date: jour,
        time: '09:12',
        visitorName: 'Awa Ndiaye',
      );
      await tester.pumpWidget(host(const RegistreScreen(), horsLigne: true));
      // Pas de pumpAndSettle : le pouls de l'indicateur hors ligne tourne en
      // continu et ne se stabilise jamais.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Awa Ndiaye'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un compte sans le registre est renvoyé vers la direction', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RegistreScreen(), role: 'COMMERCIAL'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Ce compte ne tient pas le registre des visites.'),
        findsOneWidget,
      );

      await teardownTree(tester);
    });

    testWidgets('une inscription hors ligne apparaît immédiatement', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RegistreScreen(), horsLigne: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('Aucune visite pour cette période'), findsOneWidget);

      await insertVisite(
        db,
        id: 'v-neuve',
        reference: null,
        date: jour,
        time: '10:00',
        visitorName: 'Moussa Fall',
      );
      await queueOp(
        db,
        id: 'op-neuve',
        entityType: 'visite',
        entityId: 'v-neuve',
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Moussa Fall'), findsOneWidget);

      await teardownTree(tester);
    });

    group('recherche', () {
      testWidgets(
        'trouve par nom, entreprise, référence, phone et phone_e164',
        (WidgetTester tester) async {
          await insertVisite(
            db,
            id: 'v1',
            date: jour,
            time: '09:00',
            visitorName: 'Awa Ndiaye',
            entrepriseLabel: 'CPI',
          );
          await insertVisite(
            db,
            id: 'v2',
            date: jour,
            time: '09:05',
            reference: 'V-2026-000500',
            visitorName: 'Moussa Fall',
            entrepriseLabel: 'SANTARGILE',
            phone: '77 000 00 02',
            phoneE164: '+221770000002',
          );
          await insertVisite(
            db,
            id: 'v3',
            date: jour,
            time: '09:10',
            visitorName: 'Ibrahima Sarr',
            entrepriseLabel: 'AUTRE',
          );
          await tester.pumpWidget(host(const RegistreScreen()));
          await tester.pumpAndSettle();

          Future<void> chercher(String motif) async {
            await tester.enterText(find.byType(TextField).first, motif);
            await tester.pump(const Duration(milliseconds: 350));
            await tester.pumpAndSettle();
          }

          await chercher('moussa');
          expect(find.text('Moussa Fall'), findsOneWidget);
          expect(find.text('Awa Ndiaye'), findsNothing);

          await chercher('santargile');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher('v-2026-000500');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher('770000002');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher('77 000 00 02');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await teardownTree(tester);
        },
      );

      testWidgets('sans résultat, l\'état vide dit « aucun résultat »', (
        WidgetTester tester,
      ) async {
        await insertVisite(db, id: 'v1', date: jour, visitorName: 'Awa Ndiaye');
        await tester.pumpWidget(host(const RegistreScreen()));
        await tester.pumpAndSettle();

        await tester.enterText(find.byType(TextField).first, 'zzz');
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pumpAndSettle();

        expect(find.text('Aucun résultat'), findsOneWidget);

        await teardownTree(tester);
      });
    });

    group('période', () {
      testWidgets('chaque puce borne la liste sous horloge fixée', (
        WidgetTester tester,
      ) async {
        await insertVisite(
          db,
          id: 'v-jour',
          date: jour,
          visitorName: 'Visiteur du jour',
        );
        await insertVisite(
          db,
          id: 'v-semaine',
          date: '2026-08-08',
          visitorName: 'Cette semaine',
        );
        await insertVisite(
          db,
          id: 'v-mois',
          date: '2026-07-25',
          visitorName: 'Ce mois',
        );
        await insertVisite(
          db,
          id: 'v-vieux',
          date: '2026-01-01',
          visitorName: 'Il y a longtemps',
        );

        await tester.pumpWidget(host(const RegistreScreen()));
        await tester.pumpAndSettle();

        expect(find.text('Visiteur du jour'), findsOneWidget);
        expect(find.text('Cette semaine'), findsNothing);

        await tester.tap(find.widgetWithText(ChoiceChip, '7 jours'));
        await tester.pumpAndSettle();
        expect(find.text('Visiteur du jour'), findsOneWidget);
        expect(find.text('Cette semaine'), findsOneWidget);
        expect(find.text('Ce mois'), findsNothing);

        await tester.tap(find.widgetWithText(ChoiceChip, '30 jours'));
        await tester.pumpAndSettle();
        expect(find.text('Ce mois'), findsOneWidget);
        expect(find.text('Il y a longtemps'), findsNothing);

        await tester.tap(find.widgetWithText(ChoiceChip, 'Tout'));
        await tester.pumpAndSettle();
        // Le plus ancien des quatre : dernière ligne de la liste, construite
        // par `ListView.builder` mais hors du viewport peint : `skipOffstage`
        // par défaut l'ignorerait.
        expect(
          find.text('Il y a longtemps', skipOffstage: false),
          findsOneWidget,
        );

        await teardownTree(tester);
      });
    });

    testWidgets('la coupure à 300 lignes est annoncée par l\'écran', (
      WidgetTester tester,
    ) async {
      for (int i = 0; i < 305; i++) {
        await insertVisite(
          db,
          id: 'v-$i',
          date: jour,
          time: '${(i % 24).toString().padLeft(2, '0')}:00',
          visitorName: 'Visiteur $i',
        );
      }
      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('300 visites les plus récentes sont affichées'),
        findsOneWidget,
      );

      await teardownTree(tester);
    });
  });

  group('inscription d\'un visiteur', () {
    setUp(seedListes);

    // La colonne du formulaire est plus haute que l'écran de test : un champ
    // jamais amené à l'image n'est pas construit, et `enterText` ne le voit pas.
    //
    // `ListView` ne garde un `RenderObject` attaché que dans le viewport et sa
    // marge de cache : un champ défilé loin au-dessus devient « offstage » pour
    // les finders (`find.text` l'ignore par défaut). Les assertions qui portent
    // sur un champ resté en haut de l'écran passent donc `skipOffstage: false`.
    Future<void> amener(WidgetTester tester, String champ) async {
      await tester.scrollUntilVisible(
        find.byKey(ValueKey<String>(champ)),
        120,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
    }

    Future<void> saisir(WidgetTester tester, String champ, String texte) async {
      await amener(tester, champ);
      await tester.enterText(find.byKey(ValueKey<String>(champ)), texte);
      await tester.pumpAndSettle();
    }

    Finder champTexte(String champ) => find.descendant(
      of: find.byKey(ValueKey<String>(champ)),
      matching: find.byType(TextField),
    );

    Future<void> choisir(
      WidgetTester tester,
      String champ,
      String libelle,
    ) async {
      await amener(tester, champ);
      await tester.tap(champTexte(champ));
      await tester.pumpAndSettle();
      await tester.tap(find.text(libelle).last);
      await tester.pumpAndSettle();
    }

    /// Efface un champ de type liste par son bouton « Effacer », plutôt que
    /// par un choix « Aucun » qui n'existe plus avec `LocalTypeahead`.
    Future<void> effacer(WidgetTester tester, String champ) async {
      await amener(tester, champ);
      await tester.tap(
        find.descendant(
          of: find.byKey(ValueKey<String>(champ)),
          matching: find.byIcon(PhosphorIconsRegular.xCircle),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> remonter(WidgetTester tester) async {
      await tester.drag(find.byType(Scrollable).first, const Offset(0, 1200));
      await tester.pumpAndSettle();
    }

    testWidgets(
      'les trois champs obligatoires sont réclamés avant tout envoi',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();

        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.pumpAndSettle();

        expect(find.text('À renseigner.'), findsOneWidget);
        expect(find.text('À choisir dans la liste.'), findsNWidgets(2));
        expect(await db.select(db.visites).get(), isEmpty);

        // Les deux listes renseignées, le nom toujours vide : c'est le seul
        // moment où l'absence de nom est ce qui retient la visite. Le champ
        // nom a défilé hors du cache du `ListView` pendant les deux `choisir` :
        // `skipOffstage: false` l'y retrouve quand même.
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.pumpAndSettle();

        expect(await db.select(db.visites).get(), isEmpty);
        expect(find.text('À renseigner.', skipOffstage: false), findsOneWidget);

        await teardownTree(tester);
      },
    );

    testWidgets(
      'la visite part hors ligne, avec le jour, l\'heure et le numéro tel quel',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();

        await saisir(tester, 'visite-nom', '  Awa Ndiaye  ');
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
        // Un numéro étranger : la normalisation sénégalaise le refuserait, le
        // registre le garde.
        await saisir(tester, 'visite-telephone', '+33 6 12 34 56 78');
        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.pumpAndSettle();
        await remonter(tester);

        final List<Visite> lignes = await db.select(db.visites).get();
        expect(lignes, hasLength(1));
        final Visite ligne = lignes.single;
        expect(ligne.date, jour);
        expect(ligne.time, '09:12');
        expect(ligne.visitorName, 'Awa Ndiaye');
        expect(ligne.phone, '+33 6 12 34 56 78');
        expect(ligne.entrepriseId, 'e1');
        expect(ligne.objetId, 'o1');
        expect(ligne.directionId, isNull);
        expect(ligne.destinataireId, isNull);
        expect(ligne.comment, isNull);
        expect(ligne.reference, isNull);

        final List<OutboxData> file = await db.select(db.outbox).get();
        expect(file, hasLength(1));
        expect(file.single.entityType, 'visite');
        expect(file.single.op, 'create');
        final Map<String, Object?> payload =
            jsonDecode(file.single.payload) as Map<String, Object?>;
        expect(payload['visitorName'], 'Awa Ndiaye');
        expect(payload['visitDate'], jour);
        expect(payload['visitTime'], '09:12');
        expect(payload['phone'], '+33 6 12 34 56 78');
        expect(payload['entrepriseId'], 'e1');
        expect(payload['objetId'], 'o1');
        expect(payload.containsKey('directionId'), isFalse);
        expect(payload.containsKey('destinataireId'), isFalse);

        expect(find.textContaining('inscrit(e) au registre'), findsOneWidget);
        // Le comptoir enchaîne : le nom repart vide, l'entreprise reste.
        expect(
          tester
              .widget<TextField>(
                find.byKey(const ValueKey<String>('visite-nom')),
              )
              .controller
              ?.text,
          '',
        );
        expect(find.text('CPI'), findsOneWidget);

        await teardownTree(tester);
      },
    );

    testWidgets('une inscription hors ligne part quand même en file', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen(), horsLigne: true));
      await tester.pumpAndSettle();

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await tester.tap(
        find.byKey(const ValueKey<String>('visite-enregistrer')),
      );
      await tester.pumpAndSettle();

      expect(await db.select(db.visites).get(), hasLength(1));
      expect(await db.select(db.outbox).get(), hasLength(1));
      expect(find.textContaining('inscrit(e) au registre'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets(
      'une direction choisie puis effacée ne laisse pas d\'identifiant fantôme',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();

        await saisir(tester, 'visite-nom', 'Awa Ndiaye');
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
        await choisir(tester, 'champ-direction', 'COMMERCIALE');
        await effacer(tester, 'champ-direction');
        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.pumpAndSettle();

        expect((await db.select(db.visites).get()).single.directionId, isNull);
        final Map<String, Object?> payload =
            jsonDecode((await db.select(db.outbox).get()).single.payload)
                as Map<String, Object?>;
        expect(payload.containsKey('directionId'), isFalse);

        await teardownTree(tester);
      },
    );

    testWidgets(
      'le choix de l\'heure s\'ouvre et laisse l\'heure intacte s\'il est annulé',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();

        await tester.tap(find.widgetWithText(TextButton, 'Changer'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Annuler'));
        await tester.pumpAndSettle();

        expect(find.text('Aujourd\'hui, 09:12'), findsOneWidget);

        await saisir(tester, 'visite-nom', 'Awa Ndiaye');
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.pumpAndSettle();

        expect((await db.select(db.visites).get()).single.time, '09:12');

        await teardownTree(tester);
      },
    );

    testWidgets('un échec d\'écriture s\'affiche et rend le bouton', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const VisiteFormScreen(), writes: _BrokenWrites(db)),
      );
      await tester.pumpAndSettle();

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      await choisir(tester, 'champ-entreprise', 'CPI');
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      await tester.tap(
        find.byKey(const ValueKey<String>('visite-enregistrer')),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('La visite n\'a pas été enregistrée.'),
        findsOneWidget,
      );
      expect(find.textContaining('base en lecture seule'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNotNull,
      );

      await teardownTree(tester);
    });

    testWidgets(
      'deux appuis sur une écriture lente n\'inscrivent qu\'une visite',
      (WidgetTester tester) async {
        final Completer<String> lent = Completer<String>();
        await tester.pumpWidget(
          host(const VisiteFormScreen(), writes: _LenteEcriture(db, lent)),
        );
        await tester.pumpAndSettle();

        await saisir(tester, 'visite-nom', 'Awa Ndiaye');
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');

        // Deux appuis dans la MÊME image : l'arbre n'a pas encore été reconstruit,
        // le bouton est donc toujours actif au second. Sans la garde d'entrée,
        // deux visites partent.
        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.tap(
          find.byKey(const ValueKey<String>('visite-enregistrer')),
        );
        await tester.pump();

        lent.complete('v-neuve');
        await tester.pumpAndSettle();

        expect(await db.select(db.visites).get(), hasLength(1));

        await teardownTree(tester);
      },
    );

    // Les listes descendent par le pull. Tant qu'elles ne sont pas là,
    // l'entreprise et l'objet ne peuvent pas être choisis : le formulaire le
    // dit et bloque, au lieu de laisser enregistrer une fiche incomplète.
    testWidgets('des listes pas encore descendues bloquent l\'envoi', (
      WidgetTester tester,
    ) async {
      await db.delete(db.visiteReferentiels).go();

      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(
          'Les listes de l\'accueil ne sont pas encore descendues.',
        ),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNull,
      );

      // Le pull les dépose : l'écran suit la base, sans qu'on le relance.
      await seedListes();
      await tester.pumpAndSettle();

      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNotNull,
      );

      await teardownTree(tester);
    });

    // Le point de tout ce dispositif : sans réseau, l'accueil doit pouvoir
    // inscrire. Les listes viennent de la base, pas d'un appel.
    testWidgets('hors ligne, le formulaire propose quand même ses listes', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen(), horsLigne: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(
        find.textContaining(
          'Les listes de l\'accueil ne sont pas encore descendues.',
        ),
        findsNothing,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey<String>('visite-enregistrer')),
            )
            .onPressed,
        isNotNull,
      );

      await teardownTree(tester);
    });
  });

  group('brouillon', () {
    setUp(seedListes);

    testWidgets(
      'un brouillon simplement interrompu est supprimé, pas restauré',
      (WidgetTester tester) async {
        // Plus vieux que la fenêtre de restauration silencieuse (60 s) : ce
        // brouillon est « resumable », pas « crash ».
        final DraftRepository ecriture = DraftRepository(
          db,
          clock: FakeClock(midi.subtract(const Duration(minutes: 5))),
        );
        await ecriture.save(
          draftId: 'draft-1',
          formKey: 'visite.create',
          values: <String, Object?>{'nom': 'Fatou Sy'},
        );

        await tester.pumpWidget(
          host(const VisiteFormScreen(draftId: 'draft-1')),
        );
        await tester.pumpAndSettle();

        expect(find.text('Fatou Sy'), findsNothing);
        final DraftRepository lecture = DraftRepository(
          db,
          clock: FakeClock(midi),
        );
        expect(await lecture.exists('draft-1'), isFalse);

        await teardownTree(tester);
      },
    );

    testWidgets('un brouillon de plantage restaure les quatre listes', (
      WidgetTester tester,
    ) async {
      // Dans la fenêtre de restauration silencieuse : un plantage.
      final DraftRepository ecriture = DraftRepository(
        db,
        clock: FakeClock(midi.subtract(const Duration(seconds: 5))),
      );
      await ecriture.save(
        draftId: 'draft-crash',
        formKey: 'visite.create',
        values: <String, Object?>{
          'nom': 'Fatou Sy',
          'entrepriseId': 'e1',
          'entrepriseLabel': 'CPI',
          'objetId': 'o1',
          'objetLabel': 'ACHAT TERRAIN',
          'directionId': 'd1',
          'directionLabel': 'COMMERCIALE',
          'destinataireId': 't1',
          'destinataireLabel': 'MME. NDOYE',
        },
      );

      await tester.pumpWidget(
        host(const VisiteFormScreen(draftId: 'draft-crash')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Fatou Sy'), findsOneWidget);
      expect(find.text('CPI'), findsOneWidget);
      expect(find.text('ACHAT TERRAIN'), findsOneWidget);
      expect(find.text('COMMERCIALE'), findsOneWidget);
      expect(find.text('MME. NDOYE'), findsOneWidget);

      await teardownTree(tester);
    });
  });

  group('accès au registre', () {
    /// La DIRECTION relit le registre au PANNEAU. `/sync` lui est fermé côté
    /// serveur, en toutes lettres (`role-routes.test.ts`) : lui ouvrir la
    /// tuile ici lui promettrait une saisie qui ne remonterait jamais.
    test('le comptoir et l\'administration, personne d\'autre', () {
      expect(peutTenirLeRegistre('ACCUEIL'), isTrue);
      expect(peutTenirLeRegistre('ADMIN'), isTrue);
      expect(peutTenirLeRegistre('DIRECTION'), isFalse);
      expect(peutTenirLeRegistre('SUPERVISEUR'), isFalse);
      expect(peutTenirLeRegistre('COMMERCIAL'), isFalse);
      expect(peutTenirLeRegistre(null), isFalse);
    });
  });
}

/// Une base qui refuse l'inscription.
class _BrokenWrites extends WriteRepository {
  _BrokenWrites(super.db);

  @override
  Future<String> inscrireVisite({
    required String visitorName,
    required String date,
    required String entrepriseId,
    required String entrepriseLabel,
    required String objetId,
    required String objetLabel,
    required String createdById,
    String? time,
    String? phone,
    String? directionId,
    String? directionLabel,
    String? destinataireId,
    String? destinataireLabel,
    String? comment,
    String? id,
  }) => Future<String>.error(StateError('base en lecture seule'));
}

/// Une inscription dont l'écriture locale ne se termine qu'à la demande du test.
class _LenteEcriture extends WriteRepository {
  _LenteEcriture(super.db, this._gate);

  final Completer<String> _gate;

  @override
  Future<String> inscrireVisite({
    required String visitorName,
    required String date,
    required String entrepriseId,
    required String entrepriseLabel,
    required String objetId,
    required String objetLabel,
    required String createdById,
    String? time,
    String? phone,
    String? directionId,
    String? directionLabel,
    String? destinataireId,
    String? destinataireLabel,
    String? comment,
    String? id,
  }) async {
    final String entityId = await _gate.future;
    return super.inscrireVisite(
      visitorName: visitorName,
      date: date,
      entrepriseId: entrepriseId,
      entrepriseLabel: entrepriseLabel,
      objetId: objetId,
      objetLabel: objetLabel,
      createdById: createdById,
      time: time,
      phone: phone,
      directionId: directionId,
      directionLabel: directionLabel,
      destinataireId: destinataireId,
      destinataireLabel: destinataireLabel,
      comment: comment,
      id: entityId,
    );
  }
}

class _FakeSource implements ConnectivitySource {
  const _FakeSource(this._result);

  final ConnectivityResult _result;

  @override
  Future<List<ConnectivityResult>> current() async => <ConnectivityResult>[
    _result,
  ];

  @override
  Stream<List<ConnectivityResult>> changes() =>
      const Stream<List<ConnectivityResult>>.empty();
}

class _FakeValidation implements NetworkValidation {
  const _FakeValidation(this._verdict);

  final bool? _verdict;

  @override
  Future<bool?> isValidated() async => _verdict;
}

class _SignedIn extends AuthController {
  _SignedIn(this._role);

  final String _role;

  @override
  AuthState build() => AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Fatou Sarr',
    role: _role,
    email: 'fatou.sarr@cpi.sn',
  );
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
