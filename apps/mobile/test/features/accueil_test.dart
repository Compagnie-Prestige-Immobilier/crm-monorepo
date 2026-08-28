import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:crm_api_client/crm_api_client.dart';
import 'package:drift/drift.dart' show Value;
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/connectivity.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/draft_repository.dart';
import 'package:cpi_go/data/repositories/visites_repository.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/accueil/presentation/visite_champs.dart';
import 'package:cpi_go/features/accueil/presentation/visite_form_screen.dart';
import 'package:cpi_go/features/accueil/visites_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:cpi_go/ui/widgets/local_typeahead.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:forui/forui.dart';
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
/// numéro de téléphone reformaté en route, une recherche ou une période qui ne
/// borne pas réellement ce que l'accueil voit, et une correction qui laisserait
/// deux visites là où le comptoir n'en a reçu qu'une.
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
    await poser('t1', 'destinataires', 'MME. NDOYE (Directrice commerciale)');
    await poser('t2', 'destinataires', 'AUTRE');
    await poser('o1', 'objets', 'ACHAT TERRAIN');
    await poser('o2', 'objets', 'SUIVI DE DOSSIER');
  }

  Widget host(
    Widget screen, {
    WriteRepository? writes,
    bool horsLigne = false,
    String role = 'ACCUEIL',
    SyncCoordinator Function() envois = _IdleSyncCoordinator.new,
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
        syncCoordinatorProvider.overrideWith(envois),
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

  /// La colonne du formulaire est plus haute que l'écran de test : un champ
  /// jamais amené à l'image n'est pas construit, et `enterText` ne le voit pas.
  ///
  /// `ListView` ne garde un `RenderObject` attaché que dans le viewport et sa
  /// marge de cache : un champ défilé loin au-dessus devient « offstage » pour
  /// les finders (`find.text` l'ignore par défaut). Les assertions qui portent
  /// sur un champ resté en haut de l'écran passent donc `skipOffstage: false`.
  Future<void> amener(WidgetTester tester, String champ) async {
    await tester.scrollUntilVisible(
      find.byKey(ValueKey<String>(champ)),
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
  }

  /// Après chaque frappe, le temps du rappel visiteur : sans lui, la minuterie
  /// du nom resterait en vol jusqu'à la fin du test.
  Future<void> saisir(WidgetTester tester, String champ, String texte) async {
    await amener(tester, champ);
    await tester.enterText(find.byKey(ValueKey<String>(champ)), texte);
    await tester.pump(const Duration(milliseconds: 400));
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

  /// Le message de confirmation s'efface tout seul : il faut le lire avant
  /// que `pumpAndSettle` ne le laisse expirer.
  Future<void> laisserEcrire(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pump(const Duration(milliseconds: 300));
  }

  /// Le texte d'un champ, quelle que soit la primitive qui le porte :
  /// `CpiField` pour du texte libre, `PhoneField` pour le numéro.
  String? texteDe(WidgetTester tester, String champ) => tester
      .widget<TextField>(
        find.descendant(
          of: find.byKey(ValueKey<String>(champ), skipOffstage: false),
          matching: find.byType(TextField, skipOffstage: false),
        ),
      )
      .controller
      ?.text;

  Future<void> continuer(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey<String>('visite-continuer')));
    await tester.pumpAndSettle();
  }

  /// Étape 1 sur 3 : qui se présente.
  Future<void> etapeQui(
    WidgetTester tester, {
    String nom = 'Awa Ndiaye',
    String? venuDe,
    String telephone = '77 000 00 01',
  }) async {
    await saisir(tester, 'visite-nom', nom);
    if (venuDe != null) await saisir(tester, 'visite-venu-de', venuDe);
    await saisir(tester, 'visite-telephone', telephone);
    await continuer(tester);
  }

  /// Étape 2 sur 3 : pour qui, pourquoi.
  Future<void> etapePourQui(
    WidgetTester tester, {
    String entreprise = 'CPI',
    String objet = 'ACHAT TERRAIN',
    String? destinataire,
    String? direction,
  }) async {
    await choisir(tester, 'champ-entreprise', entreprise);
    if (destinataire != null) {
      await choisir(tester, 'champ-destinataire', destinataire);
    }
    if (direction != null) {
      await choisir(tester, 'champ-direction', direction);
    }
    await choisir(tester, 'champ-objet', objet);
    await continuer(tester);
  }

  /// Les deux premières étapes, jusqu'à la note et au bouton d'enregistrement.
  Future<void> jusquALaNote(
    WidgetTester tester, {
    String nom = 'Awa Ndiaye',
    String? venuDe,
    String telephone = '77 000 00 01',
    String entreprise = 'CPI',
    String objet = 'ACHAT TERRAIN',
    String? destinataire,
    String? direction,
  }) async {
    await etapeQui(tester, nom: nom, venuDe: venuDe, telephone: telephone);
    await etapePourQui(
      tester,
      entreprise: entreprise,
      objet: objet,
      destinataire: destinataire,
      direction: direction,
    );
  }

  Future<void> enregistrer(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey<String>('visite-enregistrer')));
    await laisserEcrire(tester);
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
      expect(find.text('1 visite aujourd\'hui'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('la ligne dit société, personne demandée et objet', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v1',
        date: jour,
        time: '09:12',
        entrepriseLabel: 'CPI',
        objetLabel: 'Suivi de dossier',
        destinataireId: 't1',
        destinataireLabel: 'Mme Ndoye',
        directionId: 'd1',
        directionLabel: 'COMMERCIALE',
      );
      // Sans personne demandée, l'étage prend sa place.
      await insertVisite(
        db,
        id: 'v2',
        date: jour,
        time: '09:20',
        visitorName: 'Moussa Fall',
        entrepriseLabel: 'CPI',
        objetLabel: 'Achat terrain',
        directionId: 'd1',
        directionLabel: 'COMMERCIALE',
      );
      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();

      expect(
        find.text('CPI · Mme Ndoye · Suivi de dossier', skipOffstage: false),
        findsOneWidget,
      );
      expect(
        find.text('CPI · COMMERCIALE · Achat terrain', skipOffstage: false),
        findsOneWidget,
      );

      await teardownTree(tester);
    });

    testWidgets('un registre vide dit quoi faire ensuite', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Aucune visite pour cette période'), findsOneWidget);
      expect(find.text('Touchez « Inscrire un visiteur ».'), findsOneWidget);

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

        // Le mot d'état vient de `SyncStatus.label` : une seule grammaire
        // pour tout l'écran.
        expect(find.text('À corriger'), findsOneWidget);
        expect(find.text('Pas encore envoyé'), findsNothing);

        await teardownTree(tester);
      },
    );

    testWidgets('une saisie refusée par le serveur mène aux corrections', (
      WidgetTester tester,
    ) async {
      await insertVisite(db, id: 'v1', reference: null, date: jour);
      await queueOp(
        db,
        id: 'op-1',
        entityType: 'visite',
        entityId: 'v1',
        status: 'conflict',
      );
      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();

      expect(find.text('1 saisie refusée par le serveur.'), findsOneWidget);
      expect(find.widgetWithText(CpiButton, 'Voir'), findsOneWidget);

      await teardownTree(tester);
    });

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
      Future<void> chercher(WidgetTester tester, String motif) async {
        await tester.enterText(find.byType(TextField).first, motif);
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pumpAndSettle();
      }

      testWidgets(
        'trouve par nom, entreprise, étage, référence, phone et phone_e164',
        (WidgetTester tester) async {
          await insertVisite(
            db,
            id: 'v1',
            date: jour,
            time: '09:00',
            visitorName: 'Awa Ndiaye',
            entrepriseLabel: 'CPI',
            directionId: 'd1',
            directionLabel: 'MARKETING',
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

          await chercher(tester, 'moussa');
          expect(find.text('Moussa Fall'), findsOneWidget);
          expect(find.text('Awa Ndiaye'), findsNothing);

          await chercher(tester, 'santargile');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher(tester, 'v-2026-000500');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher(tester, '770000002');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher(tester, '77 000 00 02');
          expect(find.text('Moussa Fall'), findsOneWidget);

          await chercher(tester, 'marketing');
          expect(find.text('Awa Ndiaye'), findsOneWidget);

          await teardownTree(tester);
        },
      );

      testWidgets('l\'en-tête dit ce qui est cherché, et rend tout', (
        WidgetTester tester,
      ) async {
        await insertVisite(db, id: 'v1', date: jour, visitorName: 'Awa Ndiaye');
        await insertVisite(
          db,
          id: 'v2',
          date: jour,
          time: '10:00',
          visitorName: 'Moussa Fall',
        );
        await tester.pumpWidget(host(const RegistreScreen()));
        await tester.pumpAndSettle();

        expect(find.text('2 visites aujourd\'hui'), findsOneWidget);

        await chercher(tester, 'awa');
        expect(
          find.text('1 résultat pour « awa » · aujourd\'hui'),
          findsOneWidget,
        );

        await tester.tap(find.widgetWithText(CpiButton, 'Tout afficher'));
        await tester.pumpAndSettle();

        expect(find.text('2 visites aujourd\'hui'), findsOneWidget);
        expect(
          tester
              .widget<TextField>(find.byType(TextField).first)
              .controller
              ?.text,
          '',
          reason: 'le champ suit la recherche qu\'on vient de vider',
        );

        await teardownTree(tester);
      });

      testWidgets('sans résultat, l\'état vide offre d\'effacer', (
        WidgetTester tester,
      ) async {
        await insertVisite(db, id: 'v1', date: jour, visitorName: 'Awa Ndiaye');
        await tester.pumpWidget(host(const RegistreScreen()));
        await tester.pumpAndSettle();

        await chercher(tester, 'zzz');
        expect(find.text('Aucun résultat'), findsOneWidget);

        await tester.tap(
          find.widgetWithText(CpiButton, 'Effacer la recherche'),
        );
        await tester.pumpAndSettle();

        expect(find.text('Awa Ndiaye'), findsOneWidget);

        await teardownTree(tester);
      });
    });

    group('période', () {
      testWidgets('chaque puce borne la liste sous horloge fixée', (
        WidgetTester tester,
      ) async {
        // La surface de test par défaut (800 × 600) ne tient pas quatre
        // cartes à la taille de texte de l'app : un vrai téléphone, si.
        tester.view.physicalSize = const Size(1080, 3600);
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

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

        // Les cartes sont hautes : au-delà de la première, une ligne est
        // construite hors du viewport peint, que `skipOffstage` ignorerait.
        await tester.tap(find.widgetWithText(CpiButton, '7 jours'));
        await tester.pumpAndSettle();
        expect(
          find.text('Visiteur du jour', skipOffstage: false),
          findsOneWidget,
        );
        expect(find.text('Cette semaine', skipOffstage: false), findsOneWidget);
        expect(find.text('Ce mois', skipOffstage: false), findsNothing);
        expect(find.text('2 visites sur 7 jours'), findsOneWidget);

        await tester.tap(find.widgetWithText(CpiButton, '30 jours'));
        await tester.pumpAndSettle();
        expect(find.text('Ce mois', skipOffstage: false), findsOneWidget);
        expect(
          find.text('Il y a longtemps', skipOffstage: false),
          findsNothing,
        );

        await tester.tap(find.widgetWithText(CpiButton, 'Tout'));
        await tester.pumpAndSettle();
        expect(
          find.text('Il y a longtemps', skipOffstage: false),
          findsOneWidget,
        );
        expect(find.text('4 visites depuis le début'), findsOneWidget);

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
      expect(
        find.widgetWithText(CpiButton, 'Voir aujourd\'hui seulement'),
        findsOneWidget,
      );

      await teardownTree(tester);
    });
  });

  group('correction d\'une visite', () {
    setUp(seedListes);

    /// La feuille porte les huit champs : sur les 600 dp de la surface de test
    /// par défaut, son bouton tombe hors de l'écran et aucun geste ne
    /// l'atteint. Un vrai téléphone la fait défiler ; ce test lui donne la
    /// hauteur plutôt que de simuler dix glissés.
    void ecranHaut(WidgetTester tester) {
      tester.view.physicalSize = const Size(1080, 6000);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
    }

    Future<void> ouvrir(WidgetTester tester) async {
      await tester.tap(find.text('Awa Ndiaye'));
      await tester.pumpAndSettle();
    }

    testWidgets('pas encore envoyée : tout se change, hors ligne compris', (
      WidgetTester tester,
    ) async {
      ecranHaut(tester);
      final String id = await WriteRepository(db, clock: FakeClock(midi))
          .inscrireVisite(
            visitorName: 'Awa Ndiaye',
            date: jour,
            time: '09:12',
            entrepriseId: 'e1',
            entrepriseLabel: 'CPI',
            objetId: 'o1',
            objetLabel: 'ACHAT TERRAIN',
            createdById: 'me',
          );

      await tester.pumpWidget(host(const RegistreScreen(), horsLigne: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await ouvrir(tester);

      expect(
        find.text('Pas encore envoyée. Vous pouvez tout changer.'),
        findsOneWidget,
      );

      await choisir(tester, 'champ-objet', 'SUIVI DE DOSSIER');
      await tester.tap(
        find.byKey(const ValueKey<String>('correction-enregistrer')),
      );
      await laisserEcrire(tester);

      final Visite ligne = (await db.select(db.visites).get()).single;
      expect(
        ligne.id,
        isNot(id),
        reason: 'la fautive a été retirée de la file',
      );
      expect(ligne.objetId, 'o2');
      expect(await db.select(db.outbox).get(), hasLength(1));
      expect(api.visitesCorrigees, isEmpty);
      expect(find.text('Visite corrigée.'), findsOneWidget);

      await tester.pumpAndSettle();
      await teardownTree(tester);
    });

    testWidgets('déjà envoyée et en ligne : le serveur d\'abord, la base '
        'ensuite', (WidgetTester tester) async {
      ecranHaut(tester);
      await insertVisite(
        db,
        id: 'v-partie',
        date: jour,
        time: '09:15',
        visitorName: 'Awa Ndiaye',
        reference: 'V-2026-000412',
        destinataireId: 't1',
        destinataireLabel: 'MME. NDOYE (Directrice commerciale)',
      );

      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();
      await ouvrir(tester);

      expect(
        find.text('Déjà envoyée le 12/08 à 09:15. La date ne change pas.'),
        findsOneWidget,
      );

      await effacer(tester, 'champ-destinataire');
      await saisir(tester, 'visite-venu-de', 'BICIS');
      await tester.tap(
        find.byKey(const ValueKey<String>('correction-enregistrer')),
      );
      await laisserEcrire(tester);

      final VisiteCorrigee envoyee = api.visitesCorrigees.single;
      expect(envoyee.id, 'v-partie');
      expect(envoyee.visitorName, 'Awa Ndiaye');
      expect(
        envoyee.destinataireId,
        isNull,
        reason: 'un nul explicite efface, côté serveur comme ici',
      );
      expect(envoyee.comment, 'Venu de : BICIS');

      final Visite ligne = (await db.select(db.visites).get()).single;
      expect(ligne.destinataireId, isNull);
      expect(ligne.comment, 'Venu de : BICIS');
      expect(ligne.date, jour, reason: 'la date ne se corrige pas d\'ici');
      expect(ligne.reference, 'V-2026-000412');
      expect(find.text('Visite corrigée.'), findsOneWidget);

      await tester.pumpAndSettle();
      await teardownTree(tester);
    });

    testWidgets('déjà envoyée et hors ligne : lecture seule', (
      WidgetTester tester,
    ) async {
      ecranHaut(tester);
      await insertVisite(
        db,
        id: 'v-partie',
        date: jour,
        time: '09:15',
        visitorName: 'Awa Ndiaye',
        reference: 'V-2026-000412',
      );

      await tester.pumpWidget(host(const RegistreScreen(), horsLigne: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      await ouvrir(tester);

      expect(
        find.textContaining(
          'Cette visite est déjà envoyée. Il faut du réseau pour la corriger.',
        ),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('correction-enregistrer')),
        findsNothing,
      );
      expect(find.widgetWithText(CpiButton, 'Fermer'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un refus du serveur reste dans la feuille, avec Réessayer', (
      WidgetTester tester,
    ) async {
      ecranHaut(tester);
      await insertVisite(
        db,
        id: 'v-partie',
        date: jour,
        time: '09:15',
        visitorName: 'Awa Ndiaye',
        reference: 'V-2026-000412',
      );
      api.failNextUpdateVisite = const ApiException(
        'SERVER_ERROR',
        message: 'Le serveur a refusé.',
      );

      await tester.pumpWidget(host(const RegistreScreen()));
      await tester.pumpAndSettle();
      await ouvrir(tester);

      await tester.tap(
        find.byKey(const ValueKey<String>('correction-enregistrer')),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('La correction n\'est pas passée.'),
        findsOneWidget,
      );
      expect(find.widgetWithText(CpiButton, 'Réessayer'), findsOneWidget);

      // Le second essai passe : la feuille se referme sur un compte rendu.
      await tester.tap(find.widgetWithText(CpiButton, 'Réessayer'));
      await laisserEcrire(tester);
      expect(api.visitesCorrigees, hasLength(1));

      await tester.pumpAndSettle();
      await teardownTree(tester);
    });
  });

  group('inscription d\'un visiteur', () {
    setUp(seedListes);

    testWidgets('trois étapes, chacune avec sa question et ses champs', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      // Étape 1 : qui se présente.
      expect(find.text('Étape 1 sur 3'), findsOneWidget);
      expect(find.text('Qui se présente ?'), findsOneWidget);
      for (final String champ in <String>[
        'visite-nom',
        'visite-venu-de',
        'visite-telephone',
      ]) {
        expect(find.byKey(ValueKey<String>(champ)), findsOneWidget);
      }
      expect(
        find.byKey(const ValueKey<String>('champ-entreprise')),
        findsNothing,
      );
      expect(find.byKey(const ValueKey<String>('visite-note')), findsNothing);

      await etapeQui(tester);

      // Étape 2 : pour qui, pourquoi.
      expect(find.text('Étape 2 sur 3'), findsOneWidget);
      expect(find.text('Pour qui, pourquoi ?'), findsOneWidget);
      for (final String champ in <String>[
        'champ-entreprise',
        'champ-destinataire',
        'champ-direction',
        'champ-objet',
      ]) {
        expect(
          find.byKey(ValueKey<String>(champ), skipOffstage: false),
          findsOneWidget,
        );
      }
      expect(find.byKey(const ValueKey<String>('visite-nom')), findsNothing);

      await etapePourQui(tester);

      // Étape 3 : la note, l'heure, le récapitulatif, l'enregistrement.
      expect(find.text('Étape 3 sur 3'), findsOneWidget);
      expect(find.text('Une note ?'), findsOneWidget);
      expect(find.byKey(const ValueKey<String>('visite-note')), findsOneWidget);
      expect(find.text('Arrivé à 09:12', skipOffstage: false), findsOneWidget);
      final Finder recap = find.byKey(
        const ValueKey<String>('visite-recapitulatif'),
        skipOffstage: false,
      );
      for (final String ligne in <String>[
        'Awa Ndiaye',
        'CPI',
        'ACHAT TERRAIN',
        // Rien n'a été demandé nommément : le récapitulatif le dit plutôt que
        // de sauter la ligne.
        'Non renseigné',
      ]) {
        expect(
          find.descendant(
            of: recap,
            matching: find.text(ligne, skipOffstage: false),
          ),
          findsOneWidget,
          reason: ligne,
        );
      }
      expect(
        find.byKey(const ValueKey<String>('visite-enregistrer')),
        findsOneWidget,
      );

      await teardownTree(tester);
    });

    testWidgets('chaque étape dit ce qui lui manque avant de laisser passer', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      CpiButton bouton(String cle) =>
          tester.widget<CpiButton>(find.byKey(ValueKey<String>(cle)));

      expect(bouton('visite-continuer').onPressed, isNull);
      expect(bouton('visite-continuer').subtitle, 'Écrivez le nom du visiteur');

      await etapeQui(tester);

      expect(bouton('visite-continuer').onPressed, isNull);
      expect(
        bouton('visite-continuer').subtitle,
        'Choisissez la société visitée et l\'objet',
      );
      await choisir(tester, 'champ-entreprise', 'CPI');
      expect(
        bouton('visite-continuer').subtitle,
        'Choisissez l\'objet de la visite',
      );
      await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
      expect(bouton('visite-continuer').onPressed, isNotNull);
      await continuer(tester);

      // La dernière étape ne demande rien : le bouton est prêt.
      expect(bouton('visite-enregistrer').onPressed, isNotNull);
      expect(await db.select(db.visites).get(), isEmpty);

      await teardownTree(tester);
    });

    testWidgets('le téléphone est exigé, au Sénégal par défaut', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      CpiButton continuerBouton() => tester.widget<CpiButton>(
        find.byKey(const ValueKey<String>('visite-continuer')),
      );

      await saisir(tester, 'visite-nom', 'Awa Ndiaye');
      expect(
        continuerBouton().subtitle,
        'Écrivez le numéro de téléphone',
        reason: 'un visiteur a un numéro : il n\'est plus facultatif',
      );
      expect(continuerBouton().onPressed, isNull);

      // Incomplet : toujours pas.
      await saisir(tester, 'visite-telephone', '77 12');
      expect(continuerBouton().onPressed, isNull);

      await saisir(tester, 'visite-telephone', '771234567');
      expect(
        texteDe(tester, 'visite-telephone'),
        '77 123 45 67',
        reason: 'le masque groupe 2-3-2-2 à la frappe',
      );
      expect(continuerBouton().onPressed, isNotNull);

      // L'indicatif du pays vit dans le décor du champ, pas dans son texte.
      expect(find.text('+221'), findsOneWidget);
      expect(find.text('Facultatif. Noté tel qu\'il est donné.'), findsNothing);

      await teardownTree(tester);
    });

    testWidgets('un numéro étranger passe, écrit tel qu\'il est dicté', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      await jusquALaNote(tester, telephone: '+33 6 12 34 56 78');
      await enregistrer(tester);
      await tester.pumpAndSettle();

      final Visite ligne = (await db.select(db.visites).get()).single;
      expect(
        ligne.phone,
        '+33 6 12 34 56 78',
        reason: 'ni regroupé ni normalisé : le registre note ce qu\'on dicte',
      );

      await teardownTree(tester);
    });

    testWidgets('la flèche et le retour système remontent d\'une étape', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      await etapeQui(tester, nom: 'Awa Ndiaye');
      expect(find.text('Étape 2 sur 3'), findsOneWidget);

      await tester.tap(find.bySemanticsLabel('Étape précédente'));
      await tester.pumpAndSettle();

      expect(find.text('Étape 1 sur 3'), findsOneWidget);
      expect(
        texteDe(tester, 'visite-nom'),
        'Awa Ndiaye',
        reason: 'revenir en arrière ne perd pas la saisie',
      );

      await teardownTree(tester);
    });

    testWidgets(
      'la visite part hors ligne, avec le jour, l\'heure et le numéro tel quel',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();

        // Un numéro étranger : la normalisation sénégalaise le refuserait, le
        // registre le garde.
        await jusquALaNote(
          tester,
          nom: '  Awa Ndiaye  ',
          venuDe: 'BICIS',
          telephone: '+33 6 12 34 56 78',
        );
        await saisir(tester, 'visite-note', 'reçu par Mme Ndoye');
        await enregistrer(tester);

        expect(find.text('Inscrit. 1 visiteur aujourd\'hui.'), findsOneWidget);
        await tester.pumpAndSettle();

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
        // « Venu de » et la note tiennent dans le seul champ que le serveur a.
        expect(ligne.comment, 'Venu de : BICIS · reçu par Mme Ndoye');
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
        expect(payload['comment'], 'Venu de : BICIS · reçu par Mme Ndoye');
        expect(payload.containsKey('directionId'), isFalse);
        expect(payload.containsKey('destinataireId'), isFalse);

        await teardownTree(tester);
      },
    );

    testWidgets('après l\'enregistrement, le visiteur suivant repart net', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      await jusquALaNote(
        tester,
        venuDe: 'BICIS',
        telephone: '77 000 00 01',
        destinataire: 'MME. NDOYE',
        direction: 'COMMERCIALE',
      );
      await saisir(tester, 'visite-note', 'à revoir');
      await enregistrer(tester);
      await tester.pumpAndSettle();

      expect(
        (await db.select(db.visites).get()).single.phone,
        '+221 77 000 00 01',
        reason: 'le registre écrit le numéro tel qu\'il est montré',
      );

      // Retour à la première étape, vidée de ce visiteur-ci.
      expect(find.text('Étape 1 sur 3'), findsOneWidget);
      expect(texteDe(tester, 'visite-nom'), '');
      expect(texteDe(tester, 'visite-telephone'), '');
      expect(texteDe(tester, 'visite-venu-de'), '');

      // Ce qui reste toute la journée, retrouvé à l'étape suivante.
      await etapeQui(tester, nom: 'Moussa Fall');
      expect(find.text('CPI', skipOffstage: false), findsOneWidget);
      expect(find.text('MME. NDOYE', skipOffstage: false), findsOneWidget);
      expect(find.text('COMMERCIALE', skipOffstage: false), findsOneWidget);
      expect(find.text('ACHAT TERRAIN', skipOffstage: false), findsNothing);
      expect(
        find.textContaining(
          'Société visitée, personne demandée et étage restent posés',
          skipOffstage: false,
        ),
        findsOneWidget,
      );

      await teardownTree(tester);
    });

    testWidgets('« Vider et repartir à zéro » ne garde rien', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      await jusquALaNote(tester, destinataire: 'MME. NDOYE');
      await amener(tester, 'visite-vider');
      await tester.tap(find.byKey(const ValueKey<String>('visite-vider')));
      await tester.pumpAndSettle();

      expect(find.text('Étape 1 sur 3'), findsOneWidget);
      expect(texteDe(tester, 'visite-nom'), '');

      await etapeQui(tester, nom: 'Moussa Fall');
      expect(find.text('CPI', skipOffstage: false), findsNothing);
      expect(find.text('MME. NDOYE', skipOffstage: false), findsNothing);

      await teardownTree(tester);
    });

    testWidgets('une inscription hors ligne part quand même en file', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen(), horsLigne: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      await jusquALaNote(tester);

      // Le mot du hors-ligne est là où l'on enregistre, pas ailleurs.
      expect(
        find.text(
          'Hors ligne. La visite sera envoyée dès le retour du réseau.',
          skipOffstage: false,
        ),
        findsOneWidget,
      );

      await enregistrer(tester);

      expect(await db.select(db.visites).get(), hasLength(1));
      expect(await db.select(db.outbox).get(), hasLength(1));
      expect(find.textContaining('Inscrit.'), findsOneWidget);
      await tester.pumpAndSettle();

      await teardownTree(tester);
    });

    testWidgets(
      'une direction choisie puis effacée ne laisse pas d\'identifiant fantôme',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();

        await etapeQui(tester);
        await choisir(tester, 'champ-entreprise', 'CPI');
        await choisir(tester, 'champ-objet', 'ACHAT TERRAIN');
        await choisir(tester, 'champ-direction', 'COMMERCIALE');
        await effacer(tester, 'champ-direction');
        await continuer(tester);
        await enregistrer(tester);
        await tester.pumpAndSettle();

        expect((await db.select(db.visites).get()).single.directionId, isNull);
        final Map<String, Object?> payload =
            jsonDecode((await db.select(db.outbox).get()).single.payload)
                as Map<String, Object?>;
        expect(payload.containsKey('directionId'), isFalse);

        await teardownTree(tester);
      },
    );

    testWidgets('« −15 min » recule l\'arrivée et le dit', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      await jusquALaNote(tester);
      expect(find.text('Arrivé à 09:12'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey<String>('visite-moins-15')));
      await tester.pumpAndSettle();

      expect(find.text('Arrivé à 08:57 (saisi à 09:12)'), findsOneWidget);

      await enregistrer(tester);
      await tester.pumpAndSettle();

      expect((await db.select(db.visites).get()).single.time, '08:57');

      await teardownTree(tester);
    });

    testWidgets(
      'le choix de l\'heure s\'ouvre et laisse l\'heure intacte s\'il est annulé',
      (WidgetTester tester) async {
        await tester.pumpWidget(host(const VisiteFormScreen()));
        await tester.pumpAndSettle();
        await jusquALaNote(tester);

        await tester.tap(
          find.byKey(const ValueKey<String>('visite-autre-heure')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Annuler'));
        await tester.pumpAndSettle();

        expect(find.text('Arrivé à 09:12'), findsOneWidget);

        await teardownTree(tester);
      },
    );

    /// La roue ne se règle qu'au GLISSÉ (WCAG 2.5.7) et son relevé sémantique
    /// ne montrait que des nombres nus : « 07 », « 08 », sans nom ni valeur.
    testWidgets('l\'heure se saisit au clavier, sans glisser la roue', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();
      await jusquALaNote(tester);

      await tester.tap(
        find.byKey(const ValueKey<String>('visite-autre-heure')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(CpiButton, 'Saisir au clavier'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey<String>('visite-heure')),
          matching: find.byType(TextField),
        ),
        '07',
      );
      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey<String>('visite-minute')),
          matching: find.byType(TextField),
        ),
        '05',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(CpiButton, 'Valider'));
      await tester.pumpAndSettle();

      expect(find.text('Arrivé à 07:05 (saisi à 09:12)'), findsOneWidget);

      await enregistrer(tester);
      await tester.pumpAndSettle();

      expect((await db.select(db.visites).get()).single.time, '07:05');

      await teardownTree(tester);
    });

    testWidgets('une heure impossible est refusée sur le champ fautif', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();
      await jusquALaNote(tester);

      await tester.tap(
        find.byKey(const ValueKey<String>('visite-autre-heure')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(CpiButton, 'Saisir au clavier'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.descendant(
          of: find.byKey(const ValueKey<String>('visite-heure')),
          matching: find.byType(TextField),
        ),
        '99',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(CpiButton, 'Valider'));
      await tester.pumpAndSettle();

      expect(find.text('Entre 00 et 23.'), findsOneWidget);
      expect(
        find.widgetWithText(CpiButton, 'Valider'),
        findsOneWidget,
        reason: 'la feuille reste ouverte tant que l\'heure est impossible',
      );

      await tester.tap(find.widgetWithText(CpiButton, 'Annuler'));
      await tester.pumpAndSettle();
      expect(find.text('Arrivé à 09:12'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('la roue porte un nom, une valeur et de quoi l\'ajuster', (
      WidgetTester tester,
    ) async {
      final SemanticsHandle semantics = tester.ensureSemantics();
      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();
      await jusquALaNote(tester);

      await tester.tap(
        find.byKey(const ValueKey<String>('visite-autre-heure')),
      );
      await tester.pumpAndSettle();

      expect(
        tester.getSemantics(find.byType(FTimePicker)),
        isSemantics(
          label: 'Heure choisie',
          value: '09:12',
          increasedValue: '09:13',
          decreasedValue: '09:11',
          hasIncreaseAction: true,
          hasDecreaseAction: true,
        ),
      );

      tester.semantics.increase(find.semantics.byLabel('Heure choisie'));
      await tester.pumpAndSettle();

      expect(
        tester.getSemantics(find.byType(FTimePicker)),
        isSemantics(value: '09:13'),
      );

      await tester.tap(find.widgetWithText(CpiButton, 'Valider'));
      await tester.pumpAndSettle();
      expect(find.text('Arrivé à 09:13 (saisi à 09:12)'), findsOneWidget);

      semantics.dispose();
      await teardownTree(tester);
    });

    testWidgets('un échec d\'écriture s\'affiche et rend le bouton', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        host(const VisiteFormScreen(), writes: _BrokenWrites(db)),
      );
      await tester.pumpAndSettle();

      await jusquALaNote(tester);
      await enregistrer(tester);
      await tester.pumpAndSettle();

      expect(
        find.textContaining('La visite n\'a pas été enregistrée.'),
        findsOneWidget,
      );
      expect(find.textContaining('base en lecture seule'), findsOneWidget);
      expect(
        tester
            .widget<CpiButton>(
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

        await jusquALaNote(tester);

        // Deux appuis dans la MÊME image : l'arbre n'a pas encore été
        // reconstruit, le bouton est donc toujours actif au second. Sans la
        // garde d'entrée, deux visites partent.
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
    // la société visitée et l'objet ne peuvent pas être choisis : le formulaire
    // le dit et bloque, au lieu de laisser enregistrer une fiche incomplète.
    testWidgets('des listes pas encore descendues bloquent l\'envoi', (
      WidgetTester tester,
    ) async {
      await db.delete(db.visiteReferentiels).go();

      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(
          'Les listes de l\'accueil ne sont pas encore sur ce téléphone.',
        ),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('visite-nom')),
        findsNothing,
        reason: 'sans listes, aucun clavier ne s\'ouvre',
      );
      final CpiButton bloque = tester.widget<CpiButton>(
        find.byKey(const ValueKey<String>('visite-continuer')),
      );
      expect(bloque.onPressed, isNull);
      expect(bloque.subtitle, 'Les listes de l\'accueil manquent');

      // La réception en cours se dit, et le bouton ne se retouche pas.
      await tester.tap(find.widgetWithText(CpiButton, 'Recevoir les listes'));
      await tester.pumpAndSettle();
      expect(find.text('Réception des listes…'), findsOneWidget);

      // Le pull les dépose : l'écran suit la base, sans qu'on le relance.
      await seedListes();
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey<String>('visite-nom')), findsOneWidget);
      expect(
        tester
            .widget<CpiButton>(
              find.byKey(const ValueKey<String>('visite-continuer')),
            )
            .subtitle,
        'Écrivez le nom du visiteur',
      );

      await teardownTree(tester);
    });

    testWidgets('une réception qui ne ramène rien le dit', (
      WidgetTester tester,
    ) async {
      await db.delete(db.visiteReferentiels).go();

      await tester.pumpWidget(
        host(const VisiteFormScreen(), envois: _MuetSyncCoordinator.new),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(CpiButton, 'Recevoir les listes'));
      await tester.pumpAndSettle();

      expect(
        find.textContaining(
          'Toujours rien reçu. Vérifiez le réseau, ou appelez '
          'l\'administrateur.',
        ),
        findsOneWidget,
      );

      // Le temps que la pression du bouton finisse son animation : démonter
      // l'arbre dessus laisserait sa minuterie en vol.
      await tester.pump(const Duration(seconds: 1));
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
        find.textContaining('ne sont pas encore sur ce téléphone'),
        findsNothing,
      );
      expect(find.byKey(const ValueKey<String>('visite-nom')), findsOneWidget);
      expect(
        tester
            .widget<CpiButton>(
              find.byKey(const ValueKey<String>('visite-continuer')),
            )
            .subtitle,
        'Écrivez le nom du visiteur',
      );

      await teardownTree(tester);
    });

    testWidgets('une entrée désactivée n\'est plus proposée', (
      WidgetTester tester,
    ) async {
      await db
          .into(db.visiteReferentiels)
          .insert(
            VisiteReferentielsCompanion.insert(
              id: 'e-retiree',
              kind: 'entreprises',
              code: 'ANCIENNE',
              label: 'ANCIENNE SOCIÉTÉ',
              isActive: const Value<bool>(false),
              localUpdatedAt: midi,
            ),
          );

      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();
      await etapeQui(tester);

      await amener(tester, 'champ-entreprise');
      await tester.tap(champTexte('champ-entreprise'));
      await tester.pumpAndSettle();

      expect(find.text('CPI'), findsWidgets);
      expect(
        find.text('ANCIENNE SOCIÉTÉ'),
        findsNothing,
        reason: 'ce que le classeur a retiré ne se choisit plus',
      );

      await teardownTree(tester);
    });

    testWidgets('les cinq intitulés les plus fréquents passent devant', (
      WidgetTester tester,
    ) async {
      // SUIVI DE DOSSIER est l'objet le plus fréquent du mois : il doit
      // s'offrir avant ACHAT TERRAIN, qui le précède au référentiel.
      for (int i = 0; i < 3; i++) {
        await insertVisite(
          db,
          id: 'v-$i',
          date: '2026-08-0${i + 1}',
          objetId: 'o2',
          objetLabel: 'SUIVI DE DOSSIER',
        );
      }

      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();
      await etapeQui(tester);

      await amener(tester, 'champ-objet');
      await tester.tap(champTexte('champ-objet'));
      await tester.pumpAndSettle();

      final double frequent = tester
          .getTopLeft(find.text('SUIVI DE DOSSIER').last)
          .dy;
      final double reste = tester
          .getTopLeft(find.text('ACHAT TERRAIN').last)
          .dy;
      expect(frequent, lessThan(reste));
      expect(find.text('Toute la liste'), findsOneWidget);

      await teardownTree(tester);
    });
  });

  group('rappel visiteur', () {
    setUp(seedListes);

    testWidgets('un habitué se reprend en un geste', (
      WidgetTester tester,
    ) async {
      await insertVisite(
        db,
        id: 'v-ancienne',
        date: '2026-08-01',
        time: '11:00',
        visitorName: 'Awa Ndiaye',
        entrepriseId: 'e1',
        entrepriseLabel: 'CPI',
        objetId: 'o2',
        objetLabel: 'SUIVI DE DOSSIER',
        destinataireId: 't1',
        destinataireLabel: 'MME. NDOYE (Directrice commerciale)',
        directionId: 'd1',
        directionLabel: 'COMMERCIALE',
        phone: '77 000 00 01',
      );

      await tester.pumpWidget(host(const VisiteFormScreen()));
      await tester.pumpAndSettle();

      // Deux lettres : rien. Le rappel ne devine pas sur un début de nom.
      await saisir(tester, 'visite-nom', 'Aw');
      expect(find.textContaining('Déjà venu le'), findsNothing);

      await saisir(tester, 'visite-nom', 'Awa');
      expect(
        find.text(
          'Déjà venu le 1 août : MME. NDOYE (Directrice commerciale) '
          '· SUIVI DE DOSSIER',
        ),
        findsOneWidget,
      );

      await tester.ensureVisible(
        find.byKey(const ValueKey<String>('visite-reprendre')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('visite-reprendre')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(
        find.text('Repris de la visite du 1 août. Vérifiez l\'objet.'),
        findsOneWidget,
      );
      await tester.pumpAndSettle();

      // Le nom tapé reste, tout le reste est repris.
      expect(texteDe(tester, 'visite-nom'), 'Awa');
      expect(texteDe(tester, 'visite-telephone'), '77 000 00 01');

      // Les listes reprises attendent à l'étape suivante, déjà remplies.
      await continuer(tester);
      expect(find.text('CPI', skipOffstage: false), findsOneWidget);
      expect(find.text('MME. NDOYE', skipOffstage: false), findsOneWidget);
      expect(find.text('COMMERCIALE', skipOffstage: false), findsOneWidget);
      expect(
        find.text('SUIVI DE DOSSIER', skipOffstage: false),
        findsOneWidget,
      );

      await continuer(tester);
      await enregistrer(tester);
      await tester.pumpAndSettle();

      final Visite ecrite = (await db.select(db.visites).get()).firstWhere(
        (Visite v) => v.id != 'v-ancienne',
      );
      expect(ecrite.visitorName, 'Awa');
      expect(ecrite.objetId, 'o2');
      expect(ecrite.destinataireId, 't1');
      expect(
        ecrite.destinataireLabel,
        'MME. NDOYE (Directrice commerciale)',
        reason: 'le registre garde l\'intitulé entier du classeur',
      );
      expect(
        ecrite.time,
        '09:12',
        reason: 'l\'heure reste celle de MAINTENANT',
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

    testWidgets('un brouillon de plantage restaure les listes et les deux '
        'moitiés du commentaire', (WidgetTester tester) async {
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
          'telephone': '77 000 00 01',
          'commentaire': 'Venu de : BICIS · reçu par Mme Ndoye',
          'entrepriseId': 'e1',
          'objetId': 'o1',
          'directionId': 'd1',
          'destinataireId': 't1',
        },
      );

      await tester.pumpWidget(
        host(const VisiteFormScreen(draftId: 'draft-crash')),
      );
      await tester.pumpAndSettle();

      // Première étape : le nom et l'employeur, tels qu'ils étaient.
      expect(find.text('Étape 1 sur 3'), findsOneWidget);
      expect(texteDe(tester, 'visite-nom'), 'Fatou Sy');
      expect(texteDe(tester, 'visite-venu-de'), 'BICIS');
      expect(texteDe(tester, 'visite-telephone'), '77 000 00 01');

      await continuer(tester);
      for (final String libelle in <String>[
        'CPI',
        'MME. NDOYE',
        'COMMERCIALE',
        'ACHAT TERRAIN',
      ]) {
        expect(find.text(libelle, skipOffstage: false), findsOneWidget);
      }

      await continuer(tester);
      expect(texteDe(tester, 'visite-note'), 'reçu par Mme Ndoye');

      await teardownTree(tester);
    });

    /// Un nœud de rectangle vide fait tomber l'arbre d'accessibilité ENTIER
    /// (« Invisible SemanticsNodes should not be added to the tree »). Le
    /// bouton « Effacer » d'un champ à cheval sur la lisière du cache
    /// sémantique de la liste en produisait un : le formulaire rempli n'était
    /// plus lisible au lecteur d'écran, à une hauteur de défilement près.
    testWidgets('aucun nœud d\'accessibilité vide, à toute hauteur', (
      WidgetTester tester,
    ) async {
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
          'objetId': 'o1',
          'directionId': 'd1',
          'destinataireId': 't1',
        },
      );

      final SemanticsHandle semantics = tester.ensureSemantics();
      await tester.pumpWidget(
        host(const VisiteFormScreen(draftId: 'draft-crash')),
      );
      await tester.pumpAndSettle();

      final ScrollableState liste = tester.state(find.byType(Scrollable).first);
      for (double hauteur = 0; ; hauteur += 8) {
        liste.position.jumpTo(
          hauteur.clamp(0, liste.position.maxScrollExtent).toDouble(),
        );
        await tester.pump();
        expect(
          noeudsVides(tester.semantics.find(find.byType(VisiteFormScreen))),
          isEmpty,
          reason: 'défilé de $hauteur',
        );
        if (hauteur >= liste.position.maxScrollExtent) break;
      }

      semantics.dispose();
      await teardownTree(tester);
    });
  });

  group('composition des listes', () {
    VisiteReferentielDto entree(String id, String label) =>
        VisiteReferentielDto(
          id: id,
          code: id.toUpperCase(),
          label: label,
          isActive: true,
          isSystem: false,
          sortOrder: 0,
          updatedAt: midi,
        );

    List<String> libelles(List<TypeaheadOption> options) =>
        options.map((TypeaheadOption o) => o.label).toList(growable: false);

    /// Le défaut vu au comptoir : « CPI · CPI · SANTARGILE · SANTARGILE ». Une
    /// entrée qui est à la fois fréquente ET au référentiel ne doit paraître
    /// qu'une fois, et un référentiel entièrement fréquent n'a rien à séparer.
    test('trois entrées toutes servies : trois options, sans séparateur', () {
      final List<TypeaheadOption> options = optionsVisite(
        <VisiteReferentielDto>[
          entree('e1', 'CPI'),
          entree('e2', 'SANTARGILE'),
          entree('e3', 'MAKE-UP ADDICTION'),
        ],
        const <LabelCompte>[
          LabelCompte(libelle: 'CPI', total: 12),
          LabelCompte(libelle: 'SANTARGILE', total: 4),
          LabelCompte(libelle: 'MAKE-UP ADDICTION', total: 2),
        ],
      );

      expect(libelles(options), <String>[
        'CPI',
        'SANTARGILE',
        'MAKE-UP ADDICTION',
      ]);
      expect(options.where((TypeaheadOption o) => o.separator), isEmpty);
    });

    test('douze entrées, deux servies : deux, un trait, puis les dix '
        'autres', () {
      final List<VisiteReferentielDto> liste = <VisiteReferentielDto>[
        for (int i = 0; i < 12; i++) entree('o$i', 'Objet $i'),
      ];

      final List<TypeaheadOption> options =
          optionsVisite(liste, const <LabelCompte>[
            LabelCompte(libelle: 'Objet 7', total: 9),
            LabelCompte(libelle: 'Objet 2', total: 3),
          ]);

      expect(options, hasLength(13));
      expect(libelles(options).take(3), <String>[
        'Objet 7',
        'Objet 2',
        'Toute la liste',
      ]);
      expect(options[2].separator, isTrue);
      expect(
        libelles(options.sublist(3)),
        isNot(contains('Objet 7')),
        reason: 'ce qui est monté en tête ne reste pas dans le reste',
      );
      expect(libelles(options.sublist(3)), hasLength(10));
    });

    test('un intitulé écrit autrement se rapproche quand même', () {
      final List<TypeaheadOption> options = optionsVisite(
        <VisiteReferentielDto>[entree('e1', 'CPI'), entree('e2', 'SANTARGILE')],
        const <LabelCompte>[LabelCompte(libelle: 'Cpi', total: 5)],
      );

      expect(libelles(options), <String>[
        'CPI',
        'Toute la liste',
        'SANTARGILE',
      ]);
    });

    test('un intitulé en double au classeur ne se propose qu\'une fois', () {
      final List<TypeaheadOption> options = optionsVisite(
        <VisiteReferentielDto>[
          entree('e1', 'CPI'),
          entree('e-doublon', 'CPI'),
          entree('e2', 'SANTARGILE'),
        ],
        const <LabelCompte>[],
      );

      expect(libelles(options), <String>['CPI', 'SANTARGILE']);
    });

    test('« AUTRE » descend en dernier, avec ce qu\'il veut dire', () {
      final List<TypeaheadOption> options = optionsVisite(
        <VisiteReferentielDto>[
          entree('t0', 'AUTRE'),
          entree('t1', 'MME. NDOYE (Directrice)'),
        ],
        const <LabelCompte>[],
        roleEnSousTitre: true,
        sousTitreAutre: 'quelqu\'un qui n\'est pas dans la liste',
      );

      expect(libelles(options), <String>['MME. NDOYE', 'AUTRE']);
      expect(options.first.secondary, 'Directrice');
      expect(options.last.secondary, 'quelqu\'un qui n\'est pas dans la liste');
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

/// Les nœuds d'accessibilité sans surface, tels que Flutter les cherche avant
/// de publier l'arbre (`SemanticsOwner.sendSemanticsUpdate`).
List<SemanticsNode> noeudsVides(SemanticsNode noeud) {
  if (noeud.rect.isEmpty) return <SemanticsNode>[noeud];
  if (noeud.mergeAllDescendantsIntoThisNode) return <SemanticsNode>[];
  final List<SemanticsNode> vides = <SemanticsNode>[];
  noeud.visitChildren((SemanticsNode enfant) {
    vides.addAll(noeudsVides(enfant));
    return true;
  });
  return vides;
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

/// Un coordinateur qui ne part JAMAIS : la demande de listes reste sans
/// réponse, ce qui est exactement l'état à peindre.
class _MuetSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();

  @override
  void nudge() {}
}
