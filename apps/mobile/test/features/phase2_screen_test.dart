import 'dart:convert';
import 'dart:io';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/phase2/presentation/call_audio_recorder.dart';
import 'package:cpi_go/features/phase2/presentation/callback_picker.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_choice_group.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Tests d'interface de l'écran de phase 2.
///
/// Ils portent sur les propriétés qu'un commercial paie s'il les perd : une
/// cible qu'on rate au soleil, une animation qui donne la nausée à quelqu'un qui
/// a désactivé le mouvement, un écran muet pour un lecteur d'écran.
/// `testWidgets`, plus le démontage explicite de l'arbre à la fin.
///
/// Sans lui, chaque test échoue sur « A Timer is still pending even after the
/// widget tree was disposed », puis part en délai de dix minutes. La cause n'est
/// ni l'écran ni Riverpod : quand un `StreamProvider` de drift est disposé,
/// `StreamQueryStore.markAsClosed` programme un minuteur de durée nulle pour
/// libérer la requête. Le binding de test démonte l'arbre APRÈS le dernier
/// `pump`, donc ce minuteur n'a plus aucune image pour s'exécuter et reste en
/// suspens.
///
/// Remonter un arbre vide puis pomper une image rend la main au minuteur avant
/// la vérification d'invariants. C'est la seule manière de faire cohabiter des
/// flux drift et `testWidgets`, et elle est ici plutôt que recopiée quinze fois.
void phase2TestWidgets(String description, WidgetTesterCallback body) {
  testWidgets(description, (WidgetTester tester) async {
    // Surface d'un téléphone réel (360 × 780 dp), pas les 800 × 600 par défaut
    // du binding de test. Sur 600 dp de haut, l'action « Méthode non obtenue »
    // tombe hors de l'écran et les tests d'appui échouent pour une raison qui
    // n'existe sur aucun appareil.
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await body(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    // Une image de durée NON nulle : `pump(Duration.zero)` ne fait pas avancer
    // l'horloge simulée, et un minuteur programmé à « maintenant » n'est alors
    // jamais éligible. Une milliseconde suffit et ne coûte rien.
    await tester.pump(const Duration(milliseconds: 1));
  });
}

void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
    await db
        .into(db.phase2Directory)
        .insert(
          Phase2DirectoryCompanion.insert(
            prospectId: 'pros-1',
            phoneE164: '+221771234567',
            updatedAt: t0,
          ),
        );
    await db
        .into(db.phase2Directory)
        .insert(
          Phase2DirectoryCompanion.insert(
            prospectId: 'pros-2',
            phoneE164: '+221781234567',
            phase2Status: const Value<String>(Phase2Statuses.methodObtained),
            enrollmentMethod: const Value<String?>(EnrollmentMethods.physical),
            rev: const Value<int>(4),
            updatedAt: t0,
          ),
        );
  });

  tearDown(() => db.close());

  Widget host({
    bool disableAnimations = false,
    Phase2DirectorySync? directory,
    String? prefillPhone,
  }) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        if (directory != null)
          phase2DirectoryProvider.overrideWithValue(directory),
        // Session simulée. Sans elle, `recordCallAttempt` n'a pas d'auteur à
        // écrire et refuse la saisie : le test échouerait sur l'absence de
        // session, pas sur ce qu'il prétend vérifier.
        authControllerProvider.overrideWith(_SignedInController.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: disableAnimations),
          child: Phase2Screen(prefillPhone: prefillPhone),
        ),
      ),
    );
  }

  /// Tape un numéro dans le champ et laisse la recherche s'exécuter.
  Future<void> type(WidgetTester tester, String digits) async {
    await tester.enterText(find.byType(TextField).first, digits);
    await tester.pumpAndSettle();
  }

  /// Passe l'étape courante. Le bouton porte le même libellé aux étapes 1 et 2.
  Future<void> continuer(WidgetTester tester) async {
    await tester.ensureVisible(find.text('Continuer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continuer'));
    await tester.pumpAndSettle();
  }

  /// Répond à une question à deux réponses. Le libellé « Oui » se répète d'une
  /// question à l'autre : la recherche part donc du groupe.
  Future<void> repondre(WidgetTester tester, String question, Tri choix) async {
    final Finder groupe = find.byWidgetPredicate(
      (Widget w) => w is CpiChoiceGroup<Tri> && w.label == question,
    );
    final Finder option = find.descendant(
      of: groupe,
      matching: find.text(choix.label),
    );
    await tester.ensureVisible(option);
    await tester.pumpAndSettle();
    await tester.tap(option);
    await tester.pumpAndSettle();
  }

  /// Choisit une durée du système de paiement, à l'étape de la banque.
  Future<void> choisirDuree(WidgetTester tester, int mois) async {
    final Finder option = find.descendant(
      of: find.byWidgetPredicate((Widget w) => w is CpiChoiceGroup<int>),
      matching: find.text(formatDureeMois(mois)),
    );
    await tester.ensureVisible(option);
    await tester.pumpAndSettle();
    await tester.tap(option);
    await tester.pumpAndSettle();
  }

  /// Ouvre une liste assistée et y choisit une valeur du référentiel.
  Future<void> choisirDansListe(
    WidgetTester tester,
    String label,
    String valeur,
  ) async {
    final Finder field = find.descendant(
      of: find.ancestor(
        of: find.text(label),
        matching: find.byType(FTextField),
      ),
      matching: find.byType(TextField),
    );
    await tester.ensureVisible(field);
    await tester.pumpAndSettle();
    await tester.tap(field);
    await tester.pumpAndSettle();
    // La frappe et non le seul appui : c'est le changement de texte qui
    // recalcule les options de `RawAutocomplete` et ouvre la liste.
    await tester.enterText(field, valeur.split(' ').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(valeur).last);
    await tester.pumpAndSettle();
  }

  /// Écrit dans un champ nommé.
  Future<void> remplir(WidgetTester tester, String label, String value) async {
    final Finder field = find.descendant(
      of: find.ancestor(
        of: find.text(label),
        matching: find.byType(FTextField),
      ),
      matching: find.byType(TextField),
    );
    await tester.ensureVisible(field);
    await tester.pumpAndSettle();
    await tester.enterText(field, value);
    await tester.pumpAndSettle();
  }

  /// S'arrête à l'étape 2, la première des renseignements.
  Future<void> renseignements(WidgetTester tester, String digits) async {
    await type(tester, digits);
    await continuer(tester);
  }

  /// Remplit les trois blocs de renseignements, depuis l'étape 2, et s'arrête à
  /// la méthode. Depuis que l'adhésion exige le dossier entier, chaque bloc se
  /// remplit avant que « Continuer » ne s'allume.
  Future<void> dossier(WidgetTester tester) async {
    await remplir(tester, 'Nom', 'Sow');
    await remplir(tester, 'Prénom', 'Awa');
    await continuer(tester);

    await remplir(tester, 'Profession', 'Institutrice');
    await remplir(tester, 'Ancienneté', '36');
    await repondre(tester, 'Fonctionnaire', Tri.oui);
    await continuer(tester);

    await choisirDansListe(tester, 'Syndicat', 'Syndicat Test');
    await choisirDansListe(tester, 'Banque', 'Banque Test');
    await repondre(tester, 'Engagement en cours à la banque', Tri.non);
    await choisirDansListe(tester, 'Revenu mensuel', 'Revenu Test');
    await choisirDuree(tester, 24);
    await continuer(tester);
  }

  /// L'écran est en CINQ étapes : le numéro, puis les renseignements en trois
  /// blocs — qui est-ce, son travail, sa banque —, puis la méthode.
  Future<void> resultat(WidgetTester tester, String digits) async {
    await renseignements(tester, digits);
    await dossier(tester);
  }

  /// La note vocale est repliée derrière son bouton : elle n'existe dans l'arbre
  /// qu'une fois dépliée.
  Future<void> ouvrirNote(WidgetTester tester) async {
    await tester.ensureVisible(find.text('Ajouter une note vocale'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ajouter une note vocale'));
    await tester.pumpAndSettle();
  }

  /// Recule d'une étape par la flèche du bandeau.
  Future<void> reculer(WidgetTester tester) async {
    await tester.tap(find.byType(CpiHeaderAction));
    await tester.pumpAndSettle();
  }

  /// Revient de la méthode jusqu'au numéro : une flèche par étape franchie.
  Future<void> revenirAuNumero(WidgetTester tester) async {
    for (int i = 0; i < 4; i++) {
      await reculer(tester);
    }
  }

  phase2TestWidgets(
    'le champ prend le focus tout seul : aucun appui préalable',
    (WidgetTester tester) async {
      await tester.pumpWidget(host());
      await tester.pump();

      final EditableText field = tester.widget<EditableText>(
        find.descendant(
          of: find.byType(TextField).first,
          matching: find.byType(EditableText),
        ),
      );
      expect(field.focusNode.hasFocus, isTrue);
    },
  );

  // Le téléconseiller lit la fiche AVANT de dérouler le script : qui c'est,
  // ce que le dernier appel a donné, et combien de fois on a déjà essayé.
  phase2TestWidgets('un numéro connu montre la fiche avant le script', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000009');
    await insertProspect(
      db,
      id: 'pros-1',
      representantId: 'rep-1',
      phone: '+221771234567',
      nom: 'Diop',
      prenom: 'Awa',
    );
    await (db.update(
      db.prospects,
    )..where((Prospects p) => p.id.equals('pros-1'))).write(
      ProspectsCompanion(
        whatsappE164: const Value<String?>('+221771234568'),
        lastCallOutcome: const Value<String?>('CALLBACK'),
        lastCallAt: Value<DateTime?>(t0.subtract(const Duration(days: 1))),
        callAttemptCount: const Value<int>(2),
      ),
    );

    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(find.text('Awa Diop'), findsOneWidget);
    expect(find.text('+221 77 123 45 68'), findsOneWidget);
    expect(find.text('À rappeler'), findsOneWidget);
    expect(find.text('2 appels'), findsOneWidget);
    expect(find.text('À traiter'), findsOneWidget);
  });

  // Le script se remplit après avoir raccroché : la durée réelle de l'appel se
  // lit ici plutôt qu'elle ne se devine.
  phase2TestWidgets('la fiche d\'avant-script porte la preuve de l\'appel', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.preuvesAppel)
        .insert(
          PreuvesAppelCompanion.insert(
            id: 'preuve-1',
            kind: 'prospect',
            entityId: 'pros-1',
            phoneE164: '+221771234567',
            lanceAt: t0,
            mode: 'call',
            journalType: const Value<String?>('sortant'),
            journalDureeS: const Value<int?>(92),
            journalAt: Value<DateTime?>(DateTime(2026, 8, 12, 14, 2)),
            rapprocheAt: Value<DateTime?>(t0),
          ),
        );

    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(find.text('Sortant · 1 min 32 · 14:02'), findsOneWidget);
  });

  phase2TestWidgets('un numéro connu sans fiche locale dit ce qu\'il sait', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(find.text('+221 77 123 45 67'), findsOneWidget);
    expect(find.text('Jamais appelé'), findsOneWidget);
    expect(find.text('Aucun appel'), findsOneWidget);
  });

  phase2TestWidgets(
    'un numéro connu et ouvert ouvre les quatre cartes de méthode',
    (WidgetTester tester) async {
      await tester.pumpWidget(host());
      await resultat(tester, '771234567');

      expect(find.text('Prise de rendez-vous'), findsOneWidget);
      expect(find.text('Plateforme'), findsOneWidget);
      expect(find.text('Physique'), findsOneWidget);
      expect(find.text('Par appel ou message'), findsOneWidget);
      expect(find.text('L\'appel n\'a pas abouti'), findsOneWidget);
    },
  );

  // La console ouverte depuis une fiche Grand Public. L'annuaire de la phase 3
  // descend par pages, dans l'ordre des `updated_at` croissants : une base
  // fraîchement importée arrive en dernier, et la fiche qu'on vient d'ouvrir
  // n'y est donc pas encore. « Consigner l'appel » répondait « Ce numéro n'est
  // pas dans la liste » sur une fiche affichée deux gestes plus tôt.
  phase2TestWidgets(
    'une fiche Grand Public absente de l\'annuaire se consigne quand même',
    (WidgetTester tester) async {
      await db
          .into(db.prospects)
          .insert(
            ProspectsCompanion.insert(
              id: 'gp-1',
              nom: 'Ndiaye',
              prenom: 'Awa',
              phoneE164: '+221780000001',
              projet: const Value<String>('GRAND_PUBLIC'),
              createdById: 'me',
              clientCreatedAt: t0,
              localUpdatedAt: t0,
            ),
          );

      await tester.pumpWidget(host(prefillPhone: '+221780000001'));
      await tester.pumpAndSettle();

      expect(find.text('Ce numéro n\'est pas dans la liste.'), findsNothing);

      await continuer(tester);
      await dossier(tester);
      await tester.ensureVisible(find.text('Plateforme'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Plateforme'));
      await tester.pumpAndSettle();

      final CallAttempt attempt =
          (await db.select(db.callAttempts).get()).single;
      expect(attempt.prospectId, 'gp-1');
      expect(attempt.method, EnrollmentMethods.platform);
    },
  );

  // ═══ L'ÉTAPE 2 : LES RENSEIGNEMENTS ═══
  //
  // Tout y est facultatif, tout part avec l'appel, et rien ne s'y écrit dans le
  // prospect en local : c'est le serveur qui pose nom, prénom et référentiels
  // sur la fiche liée.

  /// Le seul `call_attempt` en file, décodé.
  Future<Map<String, Object?>> payload(AppDatabase db) async {
    final List<OutboxData> rows = await allOutbox(db);
    final OutboxData op = rows.singleWhere(
      (OutboxData r) => r.entityType == callAttemptEntity,
    );
    return jsonDecode(op.payload) as Map<String, Object?>;
  }

  phase2TestWidgets('les renseignements partent avec l\'appel', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await renseignements(tester, '771234567');

    expect(find.text('Qui est-ce ?'), findsOneWidget);
    // Le numéro se relit, il ne se corrige pas : le serveur refuse de l'écrire
    // depuis un appel.
    expect(
      tester
          .widget<CpiField>(find.widgetWithText(CpiField, 'Téléphone'))
          .readOnly,
      isTrue,
    );

    await remplir(tester, 'E-mail', 'awa.sow@exemple.sn');
    await dossier(tester);
    await remplir(tester, 'Commentaire', 'Rappeler après la rentrée.');
    await tester.ensureVisible(find.text('Plateforme'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Plateforme'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.email, 'awa.sow@exemple.sn');
    expect(attempt.fonctionnaire, isTrue);
    expect(attempt.engagementEnCours, isFalse);
    expect(attempt.dureeEtablissementMois, 36);
    expect(attempt.comment, 'Rappeler après la rentrée.');
    expect(attempt.rendezVousAt, isNull);

    // Le nom, le prénom et les référentiels ne sont PAS écrits en local : ils
    // vivent sur le prospect, que seul le serveur met à jour.
    final Map<String, Object?> op = await payload(db);
    expect(op['nom'], 'Sow');
    expect(op['prenom'], 'Awa');
    expect(op['email'], 'awa.sow@exemple.sn');
    expect(op['fonctionnaire'], isTrue);
    expect(op['engagementEnCours'], isFalse);
    expect(op['dureeEtablissementMois'], 36);
    expect(op['banqueId'], 'bq-1');
    expect(op['syndicatId'], 'sy-1');
    expect(op['incomeBandId'], 'rev-1');
    expect(op['dureeSystemeMois'], 24);
    expect(op['comment'], 'Rappeler après la rentrée.');
    expect(op.containsKey('rendezVousAt'), isFalse);
  });

  // « Non demandé » ne se propose plus : sur CHUES le dossier d'adhésion est
  // complet ou il n'y a pas d'adhésion. La valeur reste possible en interne,
  // pour les appels qui n'ont pas abouti.
  phase2TestWidgets('« Non demandé » n\'est plus proposé aux deux questions', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await renseignements(tester, '771234567');
    await remplir(tester, 'Nom', 'Sow');
    await remplir(tester, 'Prénom', 'Awa');
    await continuer(tester);

    expect(find.text('Non demandé', skipOffstage: false), findsNothing);
    expect(
      tester
          .widget<CpiChoiceGroup<Tri>>(
            find.byWidgetPredicate(
              (Widget w) =>
                  w is CpiChoiceGroup<Tri> && w.label == 'Fonctionnaire',
            ),
          )
          .options
          .map((CpiChoice<Tri> o) => o.label),
      <String>['Oui', 'Non'],
    );
  });

  // Une adhésion exige le dossier entier ; un appel qui n'a pas abouti, non.
  phase2TestWidgets('l\'appel qui n\'a pas abouti se consigne sans dossier', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await renseignements(tester, '771234567');

    await tester.ensureVisible(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Injoignable'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Injoignable'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.outcome, CallOutcomes.unreachable);
    expect(attempt.fonctionnaire, isNull);
    expect(attempt.engagementEnCours, isNull);
    expect(find.text('Enregistré'), findsOneWidget);

    final Map<String, Object?> op = await payload(db);
    expect(op.containsKey('incomeBandId'), isFalse);
    expect(op.containsKey('dureeSystemeMois'), isFalse);
  });

  phase2TestWidgets('un e-mail mal formé retient l\'étape et le dit', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await renseignements(tester, '771234567');
    await remplir(tester, 'Nom', 'Sow');
    await remplir(tester, 'Prénom', 'Awa');
    await remplir(tester, 'E-mail', 'awa.sow');

    // `skipOffstage: false` : ForUI rend le reproche du champ hors scène tant
    // qu'il n'a pas été atteint par le défilement.
    expect(
      find.textContaining('Adresse invalide', skipOffstage: false),
      findsOneWidget,
    );
    final CpiButton bouton = tester.widget<CpiButton>(
      find.widgetWithText(CpiButton, 'Continuer'),
    );
    expect(bouton.onPressed, isNull);
    expect(bouton.subtitle, 'Vérifiez l\'e-mail');

    await remplir(tester, 'E-mail', 'awa.sow@exemple.sn');
    expect(
      tester
          .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
          .onPressed,
      isNotNull,
    );
  });

  phase2TestWidgets('une durée hors bornes retient l\'étape', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await renseignements(tester, '771234567');
    await remplir(tester, 'Nom', 'Sow');
    await remplir(tester, 'Prénom', 'Awa');
    // La durée est à l'étape du travail, celle qui suit l'identité.
    await continuer(tester);
    await remplir(tester, 'Profession', 'Institutrice');
    await remplir(tester, 'Ancienneté', '900');

    expect(
      find.textContaining('De 0 à 600 mois', skipOffstage: false),
      findsOneWidget,
    );
    expect(
      tester
          .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
          .subtitle,
      'Vérifiez la durée en mois',
    );
  });

  phase2TestWidgets('le revenu puis la durée du système retiennent l\'étape', (
    WidgetTester tester,
  ) async {
    String? reproche() => tester
        .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
        .subtitle;

    await tester.pumpWidget(host());
    await renseignements(tester, '771234567');
    await remplir(tester, 'Nom', 'Sow');
    await remplir(tester, 'Prénom', 'Awa');
    await continuer(tester);
    await remplir(tester, 'Profession', 'Institutrice');
    await remplir(tester, 'Ancienneté', '36');
    await repondre(tester, 'Fonctionnaire', Tri.oui);
    await continuer(tester);

    await choisirDansListe(tester, 'Syndicat', 'Syndicat Test');
    await choisirDansListe(tester, 'Banque', 'Banque Test');
    await repondre(tester, 'Engagement en cours à la banque', Tri.non);
    expect(reproche(), 'Choisissez le revenu mensuel');

    await choisirDansListe(tester, 'Revenu mensuel', 'Revenu Test');
    expect(reproche(), 'Choisissez la durée du système');
    expect(
      tester
          .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
          .onPressed,
      isNull,
    );

    await choisirDuree(tester, 24);
    expect(reproche(), isNull);
    expect(
      tester
          .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
          .onPressed,
      isNotNull,
    );
  });

  phase2TestWidgets('le récapitulatif rappelle le revenu et la durée', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');

    expect(find.text('Revenu mensuel'), findsOneWidget);
    expect(find.text('Revenu Test'), findsOneWidget);
    expect(find.text('Durée du système'), findsOneWidget);
    expect(find.text('2 ans (24 mois)'), findsOneWidget);
  });

  // ═══ LA PRISE DE RENDEZ-VOUS ═══
  //
  // Le serveur EXIGE la date sur cette méthode et la refuse sur les autres :
  // l'écran ne peut donc pas enregistrer un rendez-vous sans passer par la
  // feuille, ni laisser une date sur une autre carte.

  phase2TestWidgets('la prise de rendez-vous annulée n\'enregistre rien', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');

    await tester.ensureVisible(find.text('Prise de rendez-vous'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Prise de rendez-vous'));
    await tester.pumpAndSettle();
    expect(find.text('Enregistrer le rendez-vous'), findsOneWidget);

    await tester.tap(find.text('Annuler'));
    await tester.pumpAndSettle();

    expect(await db.countMyAttempts().getSingle(), 0);
    // La carte est toujours là : l'appel n'est pas consigné et le
    // téléconseiller peut choisir une autre issue.
    expect(find.text('Plateforme'), findsOneWidget);
  });

  phase2TestWidgets('un rendez-vous confirmé part avec sa date', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');

    await tester.ensureVisible(find.text('Prise de rendez-vous'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Prise de rendez-vous'));
    await tester.pumpAndSettle();

    // La feuille s'ouvre sur aujourd'hui à 9 h ; « Demain » est la deuxième
    // puce, et `t0` vaut le 12 août 2026 à 9 h.
    await tester.ensureVisible(find.text('Demain'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Demain'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Enregistrer le rendez-vous'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer le rendez-vous'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.method, EnrollmentMethods.appointment);
    expect(attempt.rendezVousAt, DateTime.utc(2026, 8, 13, 9));

    final Map<String, Object?> op = await payload(db);
    expect(op['method'], EnrollmentMethods.appointment);
    expect(op['rendezVousAt'], '2026-08-13T09:00:00.000Z');
  });

  // La suite ne s'ouvre pas toute seule : le numéro se confirme d'abord.
  phase2TestWidgets('« Continuer » attend un numéro trouvé', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await tester.pump();

    expect(
      tester
          .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
          .onPressed,
      isNull,
    );
    expect(find.text('Plateforme'), findsNothing);

    await type(tester, '771234567');

    expect(
      tester
          .widget<CpiButton>(find.widgetWithText(CpiButton, 'Continuer'))
          .onPressed,
      isNotNull,
    );
    expect(find.text('Plateforme'), findsNothing);
  });

  phase2TestWidgets('changer de numéro efface la note vocale non enregistrée', (
    WidgetTester tester,
  ) async {
    final Directory temp = Directory.systemTemp.createTempSync(
      'cpi-recording-',
    );
    addTearDown(() {
      if (temp.existsSync()) temp.deleteSync(recursive: true);
    });
    final File recording = File('${temp.path}/attempt.m4a');
    recording.writeAsBytesSync(<int>[1, 2, 3]);
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await ouvrirNote(tester);
    tester
        .widget<CallAudioRecorder>(find.byType(CallAudioRecorder))
        .onChanged(recording.path);

    await revenirAuNumero(tester);
    await tester.enterText(find.byType(TextField).first, '781234567');

    expect(recording.existsSync(), isFalse);
  });

  phase2TestWidgets(
    'une note enregistrée reste disponible pour la synchronisation',
    (WidgetTester tester) async {
      final Directory temp = Directory.systemTemp.createTempSync(
        'cpi-recording-',
      );
      addTearDown(() {
        if (temp.existsSync()) temp.deleteSync(recursive: true);
      });
      final File recording = File('${temp.path}/attempt.m4a');
      recording.writeAsBytesSync(<int>[1, 2, 3]);
      await tester.pumpWidget(host());
      await resultat(tester, '771234567');
      await ouvrirNote(tester);
      tester
          .widget<CallAudioRecorder>(find.byType(CallAudioRecorder))
          .onChanged(recording.path);

      await tester.ensureVisible(find.text('Plateforme'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Plateforme'));
      await tester.pumpAndSettle();
      expect(await db.countMyAttempts().getSingle(), 1);
      await tester.tap(find.text('Numéro suivant'));
      await tester.pumpAndSettle();

      expect(recording.existsSync(), isTrue);
    },
  );

  phase2TestWidgets('une issue ne part pas pendant que le micro enregistre', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await ouvrirNote(tester);
    tester
        .widget<CallAudioRecorder>(find.byType(CallAudioRecorder))
        .onRecordingStateChanged('/tmp/active-recording.m4a');
    await tester.pump();

    // La carte est là, mais plus rien ne l'entoure qui prenne une touche : une
    // carte muette vaut mieux qu'un `onPress` nul qu'on oublierait de vérifier.
    expect(find.text('Plateforme'), findsOneWidget);
    expect(
      find.ancestor(
        of: find.text('Plateforme'),
        // `FTappable` est une fabrique : son type d'exécution n'est pas
        // `FTappable`, et `find.byType` compare les types à l'identique.
        matching: find.byWidgetPredicate((Widget w) => w is FTappable),
      ),
      findsNothing,
    );
    // Le retour à l'étape du numéro est fermé lui aussi : changer de numéro
    // pendant l'enregistrement effacerait le fichier en cours d'écriture.
    expect(
      tester.widget<CpiHeaderAction>(find.byType(CpiHeaderAction)).onPressed,
      isNull,
    );
  });

  phase2TestWidgets('quitter pendant la capture efface le fichier incomplet', (
    WidgetTester tester,
  ) async {
    final Directory temp = Directory.systemTemp.createTempSync(
      'cpi-recording-',
    );
    addTearDown(() {
      if (temp.existsSync()) temp.deleteSync(recursive: true);
    });
    final File recording = File('${temp.path}/active.m4a');
    recording.writeAsBytesSync(<int>[1, 2, 3]);
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await ouvrirNote(tester);
    tester
        .widget<CallAudioRecorder>(find.byType(CallAudioRecorder))
        .onRecordingStateChanged(recording.path);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();

    expect(recording.existsSync(), isFalse);
  });

  phase2TestWidgets('les cibles tactiles font au moins 48 dp', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');

    // 48 dp est le plancher, pas la cible : l'app se tient debout, au soleil,
    // souvent à une main. Une carte qui porte la décision de tout l'écran est
    // dimensionnée bien au-delà.
    for (final String label in const <String>[
      'Plateforme',
      'Physique',
      'Par appel ou message',
      'L\'appel n\'a pas abouti',
    ]) {
      final Finder tappable = find.ancestor(
        of: find.text(label),
        matching: find.byWidgetPredicate(
          (Widget w) => w is FTappable || w is FButton || w is OutlinedButton,
        ),
      );
      final Size size = tester.getSize(tappable.first);
      expect(
        size.height,
        greaterThanOrEqualTo(48),
        reason: '« $label » doit couvrir au moins 48 dp',
      );
    }
  });

  phase2TestWidgets(
    'un dossier déjà clos est en lecture seule, sans issue de saisie',
    (WidgetTester tester) async {
      await tester.pumpWidget(host());
      await type(tester, '781234567');

      expect(find.text('Déjà traité'), findsOneWidget);
      expect(find.text('Méthode obtenue'), findsOneWidget);
      expect(
        find.textContaining('Seul un responsable peut le rouvrir'),
        findsOneWidget,
      );
      // Aucune carte de saisie : le serveur refuserait l'écriture, et proposer un
      // formulaire qui ne peut pas aboutir ferait perdre du temps au commercial.
      expect(find.text('Plateforme'), findsNothing);
      expect(find.text('L\'appel n\'a pas abouti'), findsNothing);
      // Ni « Continuer » : l'étape du résultat n'a rien à consigner ici.
      expect(find.text('Continuer'), findsNothing);
    },
  );

  // Le serveur refuse l'appel hors périmètre (`PHASE2_NOT_ASSIGNED`) : le dire
  // avant l'appel, pas des heures plus tard dans « À corriger ».
  phase2TestWidgets('un numéro hors de mes campagnes est refusé d\'emblée', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.attributions)
        .insert(AttributionsCompanion.insert(kind: attributionBorne, id: '1'));

    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(
      find.textContaining('Ce numéro n\'est pas dans vos campagnes'),
      findsOneWidget,
    );
    expect(find.text('Continuer'), findsNothing);
  });

  phase2TestWidgets('une attribution rouvre le même numéro', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.attributions)
        .insert(AttributionsCompanion.insert(kind: attributionBorne, id: '1'));
    await db
        .into(db.attributions)
        .insert(AttributionsCompanion.insert(kind: 'prospect', id: 'pros-1'));

    await tester.pumpWidget(host());
    await type(tester, '771234567');

    expect(find.textContaining('Ce numéro n\'est pas dans'), findsNothing);
  });

  phase2TestWidgets('un numéro inconnu de la liste est signalé sans blocage', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '765555555');

    expect(
      find.textContaining('Ce numéro n\'est pas dans la liste'),
      findsOneWidget,
    );
    // Les deux issues sont dans le bloc : recommencer, ou mettre la liste à
    // jour parce que le numéro vient d'être ajouté côté serveur.
    expect(find.text('Effacer et recommencer'), findsOneWidget);
    expect(find.text('Mettre la liste à jour'), findsOneWidget);
  });

  phase2TestWidgets(
    'OTHER sans commentaire est refusé DANS la feuille, avant écriture',
    (WidgetTester tester) async {
      await tester.pumpWidget(host());
      await resultat(tester, '771234567');

      await tester.ensureVisible(find.text('L\'appel n\'a pas abouti'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('L\'appel n\'a pas abouti'));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Autre'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Autre'));
      await tester.pumpAndSettle();

      // La feuille est défilable et le bouton peut être sous la ligne de
      // flottaison sur un petit écran : sans ce défilement, `tap()` rate sa cible
      // et n'avertit que dans un `warnIfMissed` que rien ne lit.
      await tester.ensureVisible(find.text('Enregistrer'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Enregistrer'));
      await tester.pumpAndSettle();

      // La feuille reste ouverte avec son message : rien n'est parti en base, donc
      // rien ne sera refusé trois semaines plus tard par un CHECK PostgreSQL.
      expect(
        find.textContaining('commentaire est obligatoire'),
        findsOneWidget,
      );
      expect(await db.countMyAttempts().getSingle(), 0);
    },
  );

  phase2TestWidgets('OTHER commenté s\'enregistre et confirme', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');

    await tester.ensureVisible(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Autre'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Autre'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.widgetWithText(CpiField, 'Commentaire (obligatoire)'),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(CpiField, 'Commentaire (obligatoire)'),
      'Le numéro est celui d\'une boutique.',
    );
    await tester.pumpAndSettle();
    // La feuille est défilable et le bouton peut être sous la ligne de
    // flottaison sur un petit écran : sans ce défilement, `tap()` rate sa cible
    // et n'avertit que dans un `warnIfMissed` que rien ne lit.
    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.text('Enregistré'), findsOneWidget);
    expect(await db.countMyAttempts().getSingle(), 1);
    // La saisie est en file, pas envoyée : c'est le moteur qui décidera quand.
    expect(await db.countPhase2Pending().getSingle(), 1);
  });

  /// Ouvre la feuille des issues négatives et choisit une issue.
  Future<void> chooseOutcome(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text(label));
    await tester.pumpAndSettle();
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  // ═══ L'HEURE DE RAPPEL SE SAISIT SANS CLAVIER ═══
  //
  // Le terrain saisit debout, souvent d'une main : un clavier de date couvre la
  // moitié de l'écran et demande une frappe exacte. Les puces sont l'exigence,
  // pas le confort.
  phase2TestWidgets('« À rappeler » propose des heures, en un seul appui', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'À rappeler');

    expect(find.text('Dans 1 h'), findsOneWidget);
    expect(find.text('Demain 9 h'), findsOneWidget);
    expect(find.text('Choisir une date'), findsOneWidget);
  });

  phase2TestWidgets('une autre issue n\'offre pas d\'heure de rappel', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'Refus');

    expect(find.text('Demain 9 h'), findsNothing);
  });

  phase2TestWidgets('l\'heure choisie est enregistrée avec la tentative', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'À rappeler');

    await tester.ensureVisible(find.text('Demain 9 h'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Demain 9 h'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.outcome, CallOutcomes.callback);
    // `t0` vaut le 12 août 2026 à 9 h : « Demain 9 h » est donc le 13 à 9 h,
    // heure de Dakar, c'est-à-dire UTC toute l'année.
    expect(attempt.callbackAt, DateTime.utc(2026, 8, 13, 9));
  });

  // Le champ est FACULTATIF côté serveur pour les téléphones déjà déployés :
  // l'écran ne doit pas le rendre obligatoire dans leur dos.
  phase2TestWidgets('un rappel sans heure s\'enregistre quand même', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'À rappeler');

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.text('Enregistré'), findsOneWidget);
    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.callbackAt, isNull);
  });

  phase2TestWidgets('« Numéro suivant » vide le champ et lui rend le focus', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host());
    await type(tester, '781234567');

    await tester.ensureVisible(find.text('Numéro suivant'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Numéro suivant'));
    await tester.pumpAndSettle();

    final EditableText field = tester.widget<EditableText>(
      find.descendant(
        of: find.byType(TextField).first,
        matching: find.byType(EditableText),
      ),
    );
    expect(field.controller.text, isEmpty);
    expect(field.focusNode.hasFocus, isTrue);
    expect(find.text('Déjà traité'), findsNothing);
  });

  phase2TestWidgets(
    'mouvement réduit : les durées tombent à zéro, la logique ne change pas',
    (WidgetTester tester) async {
      await tester.pumpWidget(host(disableAnimations: true));
      await tester.pump();

      final BuildContext context = tester.element(find.byType(Phase2Screen));
      expect(CpiMotion.of(context).component, Duration.zero);

      // Toutes : l'écran en porte une par étape, et la coque en pose sur son
      // bandeau et sur l'en-tête d'étape. Une seule laissée à sa durée suffit à
      // rendre le mouvement que l'utilisateur a désactivé.
      final Iterable<AnimatedSwitcher> switchers = tester
          .widgetList<AnimatedSwitcher>(find.byType(AnimatedSwitcher));
      expect(switchers, isNotEmpty);
      for (final AnimatedSwitcher switcher in switchers) {
        expect(switcher.duration, Duration.zero);
      }

      // La logique, elle, est identique : le même numéro donne le même écran.
      await resultat(tester, '771234567');
      expect(find.text('Plateforme'), findsOneWidget);
    },
  );

  phase2TestWidgets('rien ne vibre à la frappe', (WidgetTester tester) async {
    // Une vibration par caractère transformerait la saisie d'un numéro en
    // bourdonnement continu, et userait la batterie d'une journée d'appels.
    final List<String> haptics = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (MethodCall call) async {
        if (call.method == 'HapticFeedback.vibrate') {
          haptics.add(call.arguments.toString());
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    await tester.pumpWidget(host());
    // Numéro incomplet : on tape, il ne se passe rien d'autre que de la frappe.
    await tester.enterText(find.byType(TextField).first, '7712345');
    await tester.pumpAndSettle();
    expect(haptics, isEmpty);

    // Numéro complet et connu : la recherche aboutit sans rien faire vibrer.
    await type(tester, '771234567');
    expect(haptics, isEmpty);

    // Les « Continuer » du parcours : un retour LÉGER par appui, celui que
    // `CpiButton` donne à toute action primaire. Les choix du dossier, eux,
    // rendent un retour de SÉLECTION : le parcours en compte donc les deux.
    await continuer(tester);
    await dossier(tester);
    expect(
      haptics,
      everyElement(
        anyOf(
          'HapticFeedbackType.lightImpact',
          'HapticFeedbackType.selectionClick',
        ),
      ),
      reason: 'un appui rend un retour léger ; la frappe, aucun',
    );

    // Choix d'une carte : retour de SÉLECTION, exact au moment où il est émis.
    haptics.clear();
    await tester.ensureVisible(find.text('Plateforme'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Plateforme'));
    await tester.pumpAndSettle();
    expect(haptics, isNotEmpty);
    expect(await db.countMyAttempts().getSingle(), 1);
  });

  phase2TestWidgets('l\'écran est lisible par un lecteur d\'écran', (
    WidgetTester tester,
  ) async {
    final SemanticsHandle handle = tester.ensureSemantics();
    await tester.pumpWidget(host());
    await type(tester, '771234567');

    // Étape 1 : le champ se nomme, et le rang de l'étape s'annonce. Le nœud
    // remonte aussi sur la ligne de liste qui le porte, d'où `findsWidgets`.
    expect(
      find.bySemanticsLabel(RegExp('Numéro appelé, neuf chiffres')),
      findsWidgets,
    );
    expect(find.bySemanticsLabel(RegExp('Étape 1 sur 5')), findsOneWidget);

    await continuer(tester);
    expect(find.bySemanticsLabel(RegExp('Étape 2 sur 5')), findsOneWidget);

    await remplir(tester, 'Nom', 'Sow');
    await remplir(tester, 'Prénom', 'Awa');
    await continuer(tester);

    // Étape 3 : les questions à deux réponses portent la question dans le nom
    // de chaque option, sans quoi « Oui » ne se rattache à rien.
    expect(find.bySemanticsLabel(RegExp('Étape 3 sur 5')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Fonctionnaire : Oui')), findsWidgets);

    await remplir(tester, 'Profession', 'Institutrice');
    await remplir(tester, 'Ancienneté', '36');
    await repondre(tester, 'Fonctionnaire', Tri.oui);
    await continuer(tester);

    await choisirDansListe(tester, 'Syndicat', 'Syndicat Test');
    await choisirDansListe(tester, 'Banque', 'Banque Test');
    await repondre(tester, 'Engagement en cours à la banque', Tri.non);
    await choisirDansListe(tester, 'Revenu mensuel', 'Revenu Test');
    await choisirDuree(tester, 24);
    await continuer(tester);

    expect(
      find.bySemanticsLabel(RegExp('Méthode obtenue : Plateforme')),
      findsOneWidget,
    );
    expect(
      find.bySemanticsLabel(RegExp('Méthode obtenue : Prise de rendez-vous')),
      findsOneWidget,
    );
    // Le dossier a fait défiler l'étape : l'en-tête est hors du cache
    // sémantique tant qu'on n'est pas remonté.
    await tester.drag(find.byType(ListView).first, const Offset(0, 1200));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel(RegExp('Étape 5 sur 5')), findsOneWidget);
    handle.dispose();
  });

  phase2TestWidgets('la liste vide invite à la recevoir avant de commencer', (
    WidgetTester tester,
  ) async {
    await db.delete(db.phase2Directory).go();
    await tester.pumpWidget(host());
    await tester.pumpAndSettle();

    expect(
      find.textContaining('n\'est pas encore sur ce téléphone'),
      findsOneWidget,
    );
    // L'action de premier téléchargement est ancrée en bas d'écran, en zone de
    // pouce, et non plus en tête de bandeau.
    expect(find.text('Recevoir la liste des numéros'), findsOneWidget);
  });

  phase2TestWidgets('le téléchargement rend une progression, page par page', (
    WidgetTester tester,
  ) async {
    await db.delete(db.phase2Directory).go();
    api.directoryPages.addAll(<Phase2DirectoryPage>[
      directoryPage(
        entries: <Phase2DirectoryEntry>[
          directoryEntry(prospectId: 'a', phoneE164: '+221770000001'),
          directoryEntry(prospectId: 'b', phoneE164: '+221770000002'),
        ],
        nextCursor: 'c1',
        hasMore: true,
      ),
      directoryPage(
        entries: <Phase2DirectoryEntry>[
          directoryEntry(prospectId: 'c', phoneE164: '+221770000003'),
        ],
        nextCursor: 'c2',
      ),
    ]);

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recevoir la liste des numéros'));
    await tester.pumpAndSettle();

    expect(find.textContaining('3 numéros'), findsOneWidget);
    expect(await db.countPhase2Directory().getSingle(), 3);
  });

  // Une lecture de l'annuaire ou un téléchargement qui échoue hors du réseau ne
  // remontait nulle part : la future partait en arrière-plan sans personne pour
  // en traiter l'erreur. Sur le terrain il n'y a ni console ni rapport de
  // plantage, donc l'écran doit le dire lui-même.
  phase2TestWidgets('un annuaire illisible le dit au lieu de rester muet', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      host(
        directory: _BrokenDirectory(database: db, api: api),
      ),
    );
    await tester.pumpAndSettle();
    await type(tester, '771234567');

    expect(
      find.textContaining('Lecture de l\'annuaire impossible'),
      findsOneWidget,
    );
  });

  phase2TestWidgets('un téléchargement qui casse rend la main au bouton', (
    WidgetTester tester,
  ) async {
    await db.delete(db.phase2Directory).go();
    await tester.pumpWidget(
      host(
        directory: _BrokenDirectory(database: db, api: api),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Recevoir la liste des numéros'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Téléchargement interrompu'), findsOneWidget);
    // Le compte-rendu compte moins que ceci : sans remise à zéro de l'état, le
    // bouton reste désactivé et la liste ne peut plus jamais être reçue sans
    // redémarrer l'application.
    expect(
      tester
          .widget<FButton>(
            find.widgetWithText(FButton, 'Recevoir la liste des numéros'),
          )
          .onPress,
      isNotNull,
    );
  });

  // ═══ LA FEUILLE NE CITE PLUS AUCUNE ISSUE ═══
  //
  // C'est le point du lot : l'équipe du client ajoute ses motifs depuis le web,
  // et le parc les propose sans nouvelle version de l'application.

  Future<void> seedReason({
    required String code,
    required String label,
    String effect = CallEffects.keepOpen,
    bool requiresComment = false,
    int sortOrder = 100,
  }) {
    return db
        .into(db.callOutcomeReasons)
        .insert(
          CallOutcomeReasonsCompanion.insert(
            code: code,
            label: label,
            effect: effect,
            requiresComment: Value<bool>(requiresComment),
            sortOrder: Value<int>(sortOrder),
            minPayloadVersion: const Value<int>(2),
          ),
        );
  }

  // Deux motifs qui programment tous deux un rappel : le sélecteur d'heure n'est
  // pas démonté entre les deux, sa puce reste allumée, et l'heure était pourtant
  // remise à zéro. Le rappel enregistré était vide alors que l'écran affirmait
  // le contraire.
  phase2TestWidgets('changer de motif de rappel garde l\'heure déjà choisie', (
    WidgetTester tester,
  ) async {
    await seedReason(
      code: 'NRP',
      label: 'Ne répond pas',
      effect: CallEffects.scheduleCallback,
      sortOrder: 1,
    );
    await seedReason(
      code: 'OCCUPE',
      label: 'Occupé',
      effect: CallEffects.scheduleCallback,
      sortOrder: 2,
    );

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'Ne répond pas');

    await tester.ensureVisible(find.text('Demain 9 h'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Demain 9 h'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Occupé'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Occupé'));
    await tester.pumpAndSettle();

    expect(
      tester
          .widget<CallbackPill>(find.widgetWithText(CallbackPill, 'Demain 9 h'))
          .selected,
      isTrue,
    );

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.reasonCode, 'OCCUPE');
    expect(
      attempt.callbackAt,
      DateTime.utc(2026, 8, 13, 9),
      reason: 'la puce reste allumée : l\'heure enregistrée doit la suivre',
    );
  });

  phase2TestWidgets('la feuille rend les motifs du serveur, groupés par effet', (
    WidgetTester tester,
  ) async {
    await seedReason(code: 'NRP', label: 'Ne répond pas', sortOrder: 10);
    await seedReason(code: 'OCCUPE', label: 'Occupé', sortOrder: 20);
    await seedReason(
      code: 'RDV_PRIS',
      label: 'Rendez-vous pris',
      effect: CallEffects.scheduleCallback,
      sortOrder: 30,
    );

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await resultat(tester, '771234567');

    await tester.ensureVisible(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('L\'appel n\'a pas abouti'));
    await tester.pumpAndSettle();

    expect(find.text('Ne répond pas'), findsOneWidget);
    expect(find.text('Occupé'), findsOneWidget);
    expect(find.text('Rendez-vous pris'), findsOneWidget);
    expect(find.text('Le dossier reste ouvert'), findsOneWidget);
    expect(find.text('Un rappel est à programmer'), findsOneWidget);
    // Les six motifs système ne sont plus servis : la table locale les remplace
    // en entier, sinon un motif retiré côté serveur resterait proposé à vie.
    expect(find.text('Injoignable'), findsNothing);
    expect(find.text('Autre'), findsNothing);
  });

  phase2TestWidgets('choisir un motif du serveur enregistre son code', (
    WidgetTester tester,
  ) async {
    await seedReason(code: 'NRP', label: 'Ne répond pas', sortOrder: 10);

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'Ne répond pas');

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.text('Ne répond pas'), findsOneWidget);
    final CallAttempt attempt = (await db.select(db.callAttempts).get()).single;
    expect(attempt.reasonCode, 'NRP');
    expect(attempt.effect, CallEffects.keepOpen);
    // L'issue reste celle de l'effet : `outcome` est l'énumération fermée que le
    // serveur sait encore lire.
    expect(attempt.outcome, CallOutcomes.unreachable);
  });

  phase2TestWidgets('un motif du serveur qui exige un commentaire le réclame', (
    WidgetTester tester,
  ) async {
    await seedReason(
      code: 'LITIGE',
      label: 'Litige en cours',
      requiresComment: true,
      sortOrder: 10,
    );

    await tester.pumpWidget(host());
    await tester.pumpAndSettle();
    await resultat(tester, '771234567');
    await chooseOutcome(tester, 'Litige en cours');

    await tester.ensureVisible(find.text('Enregistrer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enregistrer'));
    await tester.pumpAndSettle();

    expect(find.textContaining('commentaire est obligatoire'), findsOneWidget);
    expect(await db.countMyAttempts().getSingle(), 0);
  });
}

/// Un annuaire dont la base locale refuse aussi bien la lecture que l'écriture.
class _BrokenDirectory extends Phase2DirectorySync {
  _BrokenDirectory({required super.database, required super.api});

  @override
  Future<Phase2DirectoryData?> lookupByPhone(String phoneE164) =>
      Future<Phase2DirectoryData?>.error(StateError('base illisible'));

  @override
  Future<int> pull({
    int maxPages = 300,
    void Function(int applied, bool hasMore)? onProgress,
  }) => Future<int>.error(StateError('base illisible'));
}

/// Un commercial connecté, sans toucher au stockage sécurisé ni au réseau.
class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'commercial-test',
    fullName: 'Awa Sy',
  );
}
