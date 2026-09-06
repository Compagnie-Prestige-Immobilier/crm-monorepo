import 'dart:convert';

import 'package:cpi_go/core/notifications/rep_callback_notifications.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/representant/presentation/representant_qualification_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_choice_group.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le résultat d'un appel à un représentant, en étapes : la fiche avant
/// d'appeler, le résultat et son statut, les renseignements seulement quand le
/// statut les exige, puis le rappel, la personne proposée et l'envoi.
///
/// Le bouton ne ment pas : il reste éteint et DIT ce qui manque, au lieu de
/// laisser taper puis de reprocher.
void main() {
  late AppDatabase db;
  late FakeApi api;
  late _WritesEspion writes;
  late _AlarmesEspion alarmes;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    writes = _WritesEspion(db);
    alarmes = _AlarmesEspion();
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await semerLesStatuts(db);
  });

  tearDown(() => db.close());

  // Le serveur dérive la même issue et REFUSE celle qui le contredit
  // (`REP_OUTCOME_STATUT_MISMATCH`) : les cinq correspondances sont le contrat.
  test('l\'issue se dérive de l\'effet du statut', () {
    expect(issueDuStatut('REACHED'), 'REACHED');
    expect(issueDuStatut('REFUSED'), 'REFUSED');
    expect(issueDuStatut('SCHEDULE_CALLBACK'), 'CALLBACK');
    expect(issueDuStatut('UNREACHABLE'), 'UNREACHABLE');
    expect(issueDuStatut('WRONG_NUMBER'), 'WRONG_NUMBER');
    expect(issueDuStatut('AUTRE_CHOSE'), isNull);
  });

  Future<void> pomper(WidgetTester tester) async {
    await tester.pump();
    // 150 ms : la durée de l'animation d'appui de ForUI. Écourtée, elle laisse
    // un minuteur en vol et le démontage échoue sur l'invariant.
    await tester.pump(const Duration(milliseconds: 300));
  }

  /// Monte l'écran sur la fiche ; [surLaFiche] à faux passe au résultat.
  Future<void> ouvrir(WidgetTester tester, {bool surLaFiche = false}) async {
    // Surface haute : le corps est un `ListView`, qui ne construit pas ce qui
    // sort du viewport.
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          writeRepositoryProvider.overrideWithValue(writes),
          repCallbackNotificationsProvider.overrideWithValue(alarmes),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const RepresentantQualificationScreen(representantId: 'rep-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    if (surLaFiche) return;
    await tester.tap(find.text('Consigner l\'appel'));
    await pomper(tester);
  }

  Future<void> demonter(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  CpiButton bouton(WidgetTester tester, String label) =>
      tester.widget<CpiButton>(
        find.byWidgetPredicate(
          (Widget w) => w is CpiButton && w.label == label,
        ),
      );

  CpiButton enregistrer(WidgetTester tester) => bouton(tester, 'Enregistrer');

  CpiButton continuer(WidgetTester tester) => bouton(tester, 'Continuer');

  Future<void> etapeSuivante(WidgetTester tester) async {
    await tester.tap(find.text('Continuer'));
    await pomper(tester);
  }

  Future<void> etapePrecedente(WidgetTester tester) async {
    await tester.tap(find.bySemanticsLabel('Étape précédente'));
    await pomper(tester);
  }

  Future<void> envoyer(WidgetTester tester) async {
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  /// La feuille « Déjà qualifié », qui coiffe l'envoi sur une fiche qui porte
  /// déjà un appel. Son bouton est le second « Enregistrer » de l'arbre.
  Future<void> confirmerLeNouvelAppel(WidgetTester tester) async {
    await tester.tap(find.text('Enregistrer').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  /// Le corps défile : une tuile hors du viewport ne reçoit aucun geste.
  Future<void> taper(WidgetTester tester, Finder cible) async {
    await tester.ensureVisible(cible);
    await tester.pump();
    await tester.tap(cible);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  Finder champ(String label) => find.descendant(
    of: find.ancestor(of: find.text(label), matching: find.byType(FTextField)),
    matching: find.byType(TextField),
  );

  /// La tuile [reponse] de la question [question] : plusieurs « Oui »/« Non »
  /// coexistent, il faut viser dans le bon groupe.
  Finder tuile(String question, String reponse) => find.descendant(
    of: find.byWidgetPredicate(
      (Widget w) => w is CpiChoiceGroup && w.label == question,
    ),
    matching: find.text(reponse),
  );

  Future<void> statut(WidgetTester tester, String label) =>
      taper(tester, tuile('Statut de qualification', label));

  /// La fiche importée est exacte : l'étape de vérification se passe d'un
  /// geste.
  Future<void> ficheExacte(WidgetTester tester) async {
    await tester.tap(find.text('Tout est exact'));
    await pomper(tester);
  }

  /// Les deux premiers renseignements du script, posés quelle que soit la
  /// réponse à la question CHUES.
  Future<void> renseignements(WidgetTester tester) async {
    await taper(tester, tuile('Avez-vous été contacté ?', 'Oui'));
    await taper(tester, tuile('Connaissez-vous l\'UES ?', 'Oui'));
  }

  /// Joignable, fiche exacte, question CHUES à oui : le chemin le plus long,
  /// jusqu'à la dernière étape.
  Future<void> accepteComplet(WidgetTester tester) async {
    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);
    await ficheExacte(tester);
    await renseignements(tester);
    await taper(tester, tuile(kQuestionCHUES, 'Oui'));
    await etapeSuivante(tester);
  }

  testWidgets('la fiche se lit avant de composer le numéro', (
    WidgetTester tester,
  ) async {
    await db.customStatement('DELETE FROM representants');
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      prenom: 'Ousmane',
      whatsappStatus: 'MEME_NUMERO',
      etablissement: 'Lycée de Bakel',
      lastCallOutcome: 'CALLBACK',
      lastCallAt: t0.subtract(const Duration(days: 2)),
      callAttemptCount: 3,
    );
    await ouvrir(tester, surLaFiche: true);

    expect(find.text('Avant l\'appel'), findsOneWidget);
    expect(find.text('+221 77 000 00 01'), findsOneWidget);
    expect(find.text('Même numéro'), findsOneWidget);
    expect(find.text('Lycée de Bakel'), findsOneWidget);
    // Le résultat en ligne, et la pastille qui le reprend faute de statut.
    expect(find.text('À rappeler'), findsNWidgets(2));
    expect(find.text('3 appels'), findsOneWidget);
    expect(find.text('Pas encore contacté'), findsNothing);
    expect(find.text('Joignable'), findsNothing);

    await tester.tap(find.text('Consigner l\'appel'));
    await pomper(tester);
    expect(find.text('Joignable'), findsOneWidget);

    await demonter(tester);
  });

  // La fiche d'avant-appel est lue APRÈS avoir raccroché : ce que le téléphone
  // a enregistré s'y lit, sinon la durée se saisit de mémoire.
  testWidgets('la fiche d\'avant-appel montre la preuve du dernier appel', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.preuvesAppel)
        .insert(
          PreuvesAppelCompanion.insert(
            id: 'preuve-1',
            kind: 'representant',
            entityId: 'rep-1',
            phoneE164: '+221770000001',
            lanceAt: t0,
            mode: 'call',
            journalType: const Value<String?>('sortant'),
            journalDureeS: const Value<int?>(92),
            journalAt: Value<DateTime?>(DateTime(2026, 8, 12, 14, 2)),
            rapprocheAt: Value<DateTime?>(t0),
          ),
        );

    await ouvrir(tester, surLaFiche: true);

    expect(
      find.text('+221 77 000 00 01\nSortant · 1 min 32 · 14:02'),
      findsOneWidget,
    );

    await demonter(tester);
  });

  testWidgets('une fiche jamais appelée le dit, sans WhatsApp inventé', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, surLaFiche: true);

    // La ligne « Dernière interaction » et la pastille disent la même chose.
    expect(find.text('Jamais appelé'), findsNWidgets(2));
    expect(find.text('Aucun appel'), findsOneWidget);
    expect(find.text('WhatsApp'), findsNothing);

    await demonter(tester);
  });

  testWidgets('le bouton reste éteint et suit l\'ordre des étapes', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    expect(continuer(tester).onPressed, isNull);
    expect(continuer(tester).subtitle, 'Choisissez d\'abord le résultat');

    await taper(tester, find.text('Joignable'));
    expect(continuer(tester).onPressed, isNotNull);
    expect(continuer(tester).subtitle, isNull);

    await etapeSuivante(tester);
    expect(find.text('Vérifier la fiche'), findsOneWidget);
    expect(bouton(tester, 'Tout est exact').onPressed, isNotNull);

    await ficheExacte(tester);
    expect(find.text('Ce qu\'il vous a dit'), findsOneWidget);
    expect(continuer(tester).subtitle, 'Dites s\'il a été contacté');

    await taper(tester, tuile('Avez-vous été contacté ?', 'Oui'));
    expect(continuer(tester).subtitle, 'Dites s\'il connaît l\'UES');

    await taper(tester, tuile('Connaissez-vous l\'UES ?', 'Oui'));
    expect(continuer(tester).subtitle, kQuestionManquante);

    await taper(tester, tuile(kQuestionCHUES, 'Oui'));
    expect(continuer(tester).onPressed, isNotNull);

    await etapeSuivante(tester);
    expect(find.text('Pour finir'), findsOneWidget);
    expect(enregistrer(tester).onPressed, isNotNull);
    expect(enregistrer(tester).subtitle, isNull);

    await demonter(tester);
  });

  // Un refus saute les renseignements : la personne proposée se note à la
  // dernière étape, et un « non » n'est pas une impasse.
  testWidgets('un refus va droit à la fin et ouvre la personne proposée', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'Hors cible');
    await etapeSuivante(tester);

    expect(find.text('Vérifier la fiche'), findsNothing);
    expect(find.text('Pour finir'), findsOneWidget);
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsOneWidget,
    );

    await tester.enterText(champ('Son numéro'), '77 123 45 67');
    await tester.pump();
    await tester.enterText(
      champ('Son nom et prénom (facultatif)'),
      'Fatou Sarr',
    );
    await tester.pump();
    await tester.enterText(
      champ('Sa remarque (facultatif)'),
      'Elle est déléguée du personnel.',
    );
    await tester.pump();

    await envoyer(tester);

    expect(writes.suggestedPhone, '+221771234567');
    expect(writes.suggestedName, 'Fatou Sarr');
    expect(writes.suggestedNote, 'Elle est déléguée du personnel.');
    expect(writes.outcome, 'REFUSED');
    expect(writes.statutQualificationId, 'sq-hors-cible');
    // Aucune question posée : c'est le statut qui tranche, côté serveur.
    expect(writes.relationStatus, isNull);

    await demonter(tester);
  });

  // Un « non » à la question CHUES est un refus, avec la personne proposée en
  // fin de parcours.
  testWidgets('un « non » à la question CHUES propose aussi quelqu\'un', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);
    await ficheExacte(tester);
    await renseignements(tester);
    await taper(tester, tuile(kQuestionCHUES, 'Non'));
    await etapeSuivante(tester);

    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsOneWidget,
    );
    await envoyer(tester);

    // Le « non » pose Refusé : c'est lui, et non le script, qui donne l'issue.
    expect(writes.relationStatus, 'REFUS');
    expect(writes.outcome, 'REFUSED');
    expect(writes.statutQualificationId, 'sq-refuse');

    await demonter(tester);
  });

  // Le serveur jette le nom et la remarque sans numéro : les demander avant lui
  // faisait saisir pour rien.
  testWidgets('le nom et la remarque n\'arrivent qu\'après le numéro', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'Hors cible');
    await etapeSuivante(tester);

    expect(find.text('Son numéro'), findsOneWidget);
    expect(find.text('Son nom et prénom (facultatif)'), findsNothing);
    expect(find.text('Sa remarque (facultatif)'), findsNothing);

    await tester.enterText(champ('Son numéro'), '77 123 45 67');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Son nom et prénom (facultatif)'), findsOneWidget);
    expect(find.text('Sa remarque (facultatif)'), findsOneWidget);

    await demonter(tester);
  });

  // La date de rappel est exigée par le STATUT : elle n'apparaît qu'avec lui,
  // à la dernière étape.
  testWidgets('le sélecteur de date ne suit que le statut qui l\'exige', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await accepteComplet(tester);
    expect(find.text('Demain 9 h'), findsNothing);
    expect(find.text('Rappel'), findsNothing);

    await demonter(tester);
  });

  // Un numéro faux a été composé et a répondu : il est joint. Un rappel promis
  // se prend en parlant : il ne se propose plus à qui n'a pas décroché. Le
  // serveur dérive les mêmes familles et refuse une issue qui les contredit.
  testWidgets('les deux familles suivent l\'effet du statut', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    expect(tuile('Statut de qualification', 'Pas de réponse'), findsOneWidget);
    expect(
      tuile('Statut de qualification', 'Injoignable définitif'),
      findsOneWidget,
    );
    expect(tuile('Statut de qualification', 'À rappeler'), findsNothing);
    expect(tuile('Statut de qualification', 'Faux numéro'), findsNothing);

    await taper(tester, find.text('Joignable'));
    expect(tuile('Statut de qualification', 'À rappeler'), findsOneWidget);
    expect(tuile('Statut de qualification', 'Faux numéro'), findsOneWidget);
    expect(tuile('Statut de qualification', 'Hors cible'), findsOneWidget);
    expect(tuile('Statut de qualification', 'Pas de réponse'), findsNothing);

    await demonter(tester);
  });

  // EB-02 : la question pose le statut, mais qui ne l'a pas vue le cherche
  // dans la liste. Les deux y restent.
  testWidgets('Accepté et Refusé se proposent aussi en tuile', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    expect(tuile('Statut de qualification', 'Accepté'), findsOneWidget);
    expect(tuile('Statut de qualification', 'Refusé'), findsOneWidget);

    await demonter(tester);
  });

  // Le serveur refuse une relation qui contredit le statut posé
  // (`REP_RELATION_STATUT_MISMATCH`), et hors ligne ce refus est définitif :
  // choisir le statut dans la liste doit répondre à la question.
  testWidgets('le statut choisi dans la liste répond à la question', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'Refusé');
    await etapeSuivante(tester);
    await envoyer(tester);

    expect(writes.statutQualificationId, 'sq-refuse');
    expect(writes.relationStatus, 'REFUS');
    expect(writes.outcome, 'REFUSED');

    await demonter(tester);
  });

  // La réponse déjà donnée suit le statut : « Oui » puis « Refusé » enverrait
  // sinon un rattachement que le statut contredit.
  testWidgets('le statut de la liste corrige la réponse déjà donnée', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);
    await accepteComplet(tester);
    await etapePrecedente(tester);
    await etapePrecedente(tester);
    await etapePrecedente(tester);
    await statut(tester, 'Refusé');
    await etapeSuivante(tester);
    await envoyer(tester);

    expect(writes.statutQualificationId, 'sq-refuse');
    expect(writes.relationStatus, 'REFUS');

    await demonter(tester);
  });

  // Les deux « Autre » portent leur famille en base parce que le libellé y est
  // unique ; sous une branche déjà choisie, la répéter serait redondant.
  testWidgets('les deux « Autre » s\'affichent sans leur famille', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    expect(tuile('Statut de qualification', 'Autre'), findsOneWidget);
    expect(tuile('Statut de qualification', 'Autre joint'), findsNothing);

    await taper(tester, find.text('Injoignable'));
    expect(tuile('Statut de qualification', 'Autre'), findsOneWidget);
    expect(tuile('Statut de qualification', 'Autre non joint'), findsNothing);

    await demonter(tester);
  });

  // EB-02 : le statut découle de la réponse. Le poser au vu du seul script
  // laisserait la fiche sans le vocabulaire que la campagne exploite.
  testWidgets('un oui à la question CHUES pose le statut Accepté', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);
    await accepteComplet(tester);

    expect(find.text('Accepté'), findsOneWidget);

    await envoyer(tester);

    expect(writes.statutQualificationId, 'sq-accepte');
    expect(writes.relationStatus, 'AMBASSADEUR');
    expect(writes.outcome, 'REACHED');

    await demonter(tester);
  });

  // EB-04 : le serveur refuse la tentative sans motif, et un refus hors ligne
  // est définitif. Le bouton doit donc retenir la saisie ici.
  testWidgets('« Autre » retient l\'enregistrement tant que le motif manque', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'Autre');
    await etapeSuivante(tester);

    expect(champ('Motif'), findsOneWidget);
    expect(find.text('Commentaire (facultatif)'), findsNothing);
    expect(enregistrer(tester).onPressed, isNull);
    expect(enregistrer(tester).subtitle, 'Écrivez le motif');

    await tester.enterText(champ('Motif'), 'Il rappellera lui-même.');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(enregistrer(tester).onPressed, isNotNull);

    await envoyer(tester);

    expect(writes.statutQualificationId, 'sq-autre-joint');
    expect(writes.outcome, 'REACHED');

    await demonter(tester);
  });

  // La date, elle, reste exigée : c'est elle qui arme l'alarme.
  testWidgets('« À rappeler » se passe du script mais pas de la date', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'À rappeler');
    expect(continuer(tester).onPressed, isNotNull);

    await etapeSuivante(tester);
    expect(find.text('Vérifier la fiche'), findsNothing);
    expect(enregistrer(tester).onPressed, isNull);
    expect(enregistrer(tester).subtitle, 'Choisissez quand rappeler');

    await taper(tester, find.text('Demain 9 h'));
    expect(enregistrer(tester).onPressed, isNotNull);
    expect(find.text('Rappel'), findsOneWidget);

    await envoyer(tester);

    expect(writes.outcome, 'CALLBACK');
    expect(writes.callbackAt, isNotNull);
    expect(alarmes.posees.single.at.hour, 9);

    await demonter(tester);
  });

  // La question CHUES sans réponse ne vaut pas un refus : marquer REFUS
  // quelqu'un à qui l'on n'a rien demandé ferme sa fiche pour de bon.
  testWidgets('sans réponse à la question CHUES, aucune relation ne part', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'À rappeler');
    await etapeSuivante(tester);
    await taper(tester, find.text('Demain 9 h'));
    await envoyer(tester);

    expect(writes.relationStatus, isNull);

    final OutboxData op = (await db.select(db.outbox).get()).singleWhere(
      (OutboxData o) => o.entityType == 'rep_call_attempt',
    );
    expect(
      (jsonDecode(op.payload) as Map<String, Object?>)['relationStatus'],
      isNull,
    );

    await demonter(tester);
  });

  // Aucun statut choisi à part : c'est le script qui tranche, et sa dernière
  // question pose le statut.
  testWidgets('sans statut choisi, la branche jointe pose tout le script', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);
    await ficheExacte(tester);
    expect(continuer(tester).onPressed, isNull);
    expect(continuer(tester).subtitle, 'Dites s\'il a été contacté');

    await renseignements(tester);
    expect(continuer(tester).subtitle, kQuestionManquante);

    await taper(tester, tuile(kQuestionCHUES, 'Oui'));
    expect(continuer(tester).onPressed, isNotNull);

    await demonter(tester);
  });

  // Sans statut, rien ne part : le vocabulaire est ce que la campagne exploite.
  testWidgets(
    'l\'enregistrement est retenu tant qu\'aucun statut n\'est pris',
    (WidgetTester tester) async {
      await ouvrir(tester);

      await taper(tester, find.text('Injoignable'));
      expect(continuer(tester).onPressed, isNull);
      expect(continuer(tester).subtitle, 'Choisissez un statut');

      await statut(tester, 'Pas de réponse');
      expect(continuer(tester).onPressed, isNotNull);

      await demonter(tester);
    },
  );

  // Un téléphone dont le référentiel n'est pas encore descendu doit pouvoir
  // qualifier : le champ est facultatif dans le contrat.
  testWidgets('sans référentiel descendu, la qualification reste possible', (
    WidgetTester tester,
  ) async {
    await db.customStatement('DELETE FROM statuts_qualification');
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    expect(continuer(tester).onPressed, isNotNull);

    await etapeSuivante(tester);
    await envoyer(tester);

    expect(writes.outcome, 'UNREACHABLE');
    expect(writes.statutQualificationId, isNull);

    await demonter(tester);
  });

  // FOR-06 : deux appuis rapprochés consignaient deux appels, le verrou
  // n'existait pas et `saving` se posait APRÈS l'attente d'autorisation.
  testWidgets('deux appuis rapprochés ne consignent qu\'un appel', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'À rappeler');
    await etapeSuivante(tester);
    await taper(tester, find.text('Demain 9 h'));

    await tester.tap(find.text('Enregistrer'));
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(writes.appels, 1);

    await demonter(tester);
  });

  // Le sélecteur qu'on quitte laissait sa date derrière lui : un « injoignable »
  // repartait avec l'heure choisie sur la branche précédente.
  testWidgets('changer de résultat efface l\'heure déjà choisie', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    await statut(tester, 'Pas de réponse');
    await etapeSuivante(tester);
    await taper(tester, find.text('Demain 9 h'));

    // Revenir changer de résultat rouvre la question du statut : l'heure du
    // statut qu'on quitte ne doit pas suivre.
    await etapePrecedente(tester);
    await accepteComplet(tester);
    expect(find.text('Rappel'), findsNothing);

    await envoyer(tester);

    expect(writes.outcome, 'REACHED');
    expect(writes.callbackAt, isNull);

    await demonter(tester);
  });

  testWidgets('un numéro proposé incomplet éteint le bouton', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await statut(tester, 'Hors cible');
    await etapeSuivante(tester);
    expect(enregistrer(tester).onPressed, isNotNull);

    await tester.enterText(champ('Son numéro'), '77 12');
    await tester.pump();

    expect(enregistrer(tester).onPressed, isNull);
    expect(
      enregistrer(tester).subtitle,
      'Numéro de la personne proposée incomplet',
    );

    await demonter(tester);
  });

  testWidgets('un oui à la question CHUES n\'envoie aucune suggestion', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await accepteComplet(tester);
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsNothing,
    );

    await envoyer(tester);

    expect(writes.outcome, 'REACHED');
    expect(writes.suggestedPhone, isNull);
    expect(writes.suggestedName, isNull);
    expect(writes.suggestedNote, isNull);

    await demonter(tester);
  });

  // Le script complet, avec les branches « non » qui portent une nouvelle
  // valeur, et l'assertion qui compte : le payload d'outbox réellement produit
  // porte les clés exactes que la sync décode ensuite en CreateRepCallAttemptDto.
  testWidgets('le script complet produit le bon payload d\'outbox', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);
    await tester.enterText(champ('Établissement'), 'Lycée Blaise Diagne');
    await tester.pump();
    await tester.enterText(champ('Syndicat (facultatif)'), 'Syndicat');
    await tester.pump();
    await tester.tap(find.text('Syndicat Test').last);
    await tester.pump();
    await taper(tester, tuile('WhatsApp', 'Même numéro'));
    await etapeSuivante(tester);
    await taper(tester, tuile('Avez-vous été contacté ?', 'Non'));
    await taper(tester, tuile('Connaissez-vous l\'UES ?', 'Oui'));
    await taper(tester, tuile(kQuestionCHUES, 'Oui'));
    await etapeSuivante(tester);
    await envoyer(tester);

    final OutboxData op = (await db.select(db.outbox).get()).singleWhere(
      (OutboxData o) => o.entityType == 'rep_call_attempt',
    );
    final Map<String, Object?> payload =
        jsonDecode(op.payload) as Map<String, Object?>;
    expect(payload['outcome'], 'REACHED');
    expect(payload['relationStatus'], 'AMBASSADEUR');
    expect(payload['etablissementConfirme'], false);
    expect(payload['etablissement'], 'Lycée Blaise Diagne');
    expect(payload['contacte'], false);
    expect(payload['connaitUES'], true);
    expect(payload['syndicat'], 'Syndicat Test');
    expect(payload['whatsappStatus'], 'MEME_NUMERO');
    expect(payload['statutQualificationId'], 'sq-accepte');

    // La fiche locale a suivi : nouvel établissement, syndicat, et un appel de
    // plus au compteur.
    final Representant rep = await (db.select(
      db.representants,
    )..where((Representants r) => r.id.equals('rep-1'))).getSingle();
    expect(rep.etablissement, 'Lycée Blaise Diagne');
    expect(rep.syndicat, 'Syndicat Test');
    expect(rep.connaitUes, isTrue);
    expect(rep.contacte, isFalse);
    expect(rep.callAttemptCount, 1);

    await demonter(tester);
  });

  // Le rappel promis la semaine dernière est tenu par l'appel qu'on vient de
  // consigner : il doit quitter la liste ET son alarme doit être désarmée,
  // sinon elle sonne pour un appel déjà passé.
  testWidgets('l\'appel consigné honore le rappel promis et éteint l\'alarme', (
    WidgetTester tester,
  ) async {
    final String promis = await writes.recordRepCallAttempt(
      representantId: 'rep-1',
      createdById: 'u-1',
      outcome: 'CALLBACK',
      callbackAt: t0.add(const Duration(hours: 2)),
    );

    await ouvrir(tester);
    await accepteComplet(tester);
    await envoyer(tester);
    // La fiche porte déjà l'appel promis : l'envoi passe par la confirmation.
    await confirmerLeNouvelAppel(tester);

    expect(await db.select(db.repCallbackReminders).get(), isEmpty);
    expect(alarmes.annulees, <String>[promis]);
    // Un seul appel d'annulation, mais DEUX alarmes derrière : le pré-rappel
    // et l'heure convenue partagent l'identifiant du rappel.
    final (int preAlerte, int heure) =
        RepCallbackNotifications.notificationIdsFor(promis);
    expect(preAlerte, isNot(heure));

    await demonter(tester);
  });

  // Le rappel promis arme l'alarme avec le numéro : c'est ce qu'on lit sur
  // l'écran verrouillé, sans ouvrir l'application.
  testWidgets('un rappel promis arme l\'alarme avec le nom et le numéro', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);
    await taper(tester, find.text('Joignable'));
    await statut(tester, 'À rappeler');
    await etapeSuivante(tester);
    await taper(tester, find.text('Demain 9 h'));
    await envoyer(tester);

    expect(alarmes.posees.single.phoneE164, '+221770000001');
    expect(alarmes.posees.single.at.hour, 9);

    await demonter(tester);
  });

  // Un numéro qui n'a pas répondu se retente : le réessai arrive préréglé au
  // délai du statut, s'enregistre comme un rappel et arme l'alarme.
  testWidgets('« Pas de réponse » propose un réessai déjà réglé', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    await statut(tester, 'Pas de réponse');
    await etapeSuivante(tester);

    expect(find.text('Réessayer quand ?'), findsOneWidget);
    expect(find.text('Réessai'), findsOneWidget);
    expect(enregistrer(tester).onPressed, isNotNull);

    await envoyer(tester);

    expect(writes.outcome, 'UNREACHABLE');
    expect(writes.callbackAt, isNotNull);
    final Duration delai = writes.callbackAt!.difference(DateTime.now());
    expect(delai.inMinutes, inInclusiveRange(175, 180));
    expect(alarmes.posees.single.phoneE164, '+221770000001');

    await demonter(tester);
  });

  // La fiche importée se relit AVEC la personne au bout du fil : les deux
  // questions binaires d'avant ne disaient pas ce qui était faux.
  testWidgets('la vérification s\'intercale entre le résultat et le script', (
    WidgetTester tester,
  ) async {
    await db.customStatement('DELETE FROM representants');
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      etablissement: 'Lycée de Bakel',
    );
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);

    expect(find.text('Vérifier la fiche'), findsOneWidget);
    expect(find.text('Ce qu\'il vous a dit'), findsNothing);
    // Rien n'a bougé : aucun compteur, et le bouton propose de tout valider.
    expect(find.text('1 champ corrigé'), findsNothing);

    await ficheExacte(tester);
    expect(find.text('Ce qu\'il vous a dit'), findsOneWidget);

    await renseignements(tester);
    await taper(tester, tuile(kQuestionCHUES, 'Oui'));
    await etapeSuivante(tester);
    expect(find.text('Tout est exact'), findsOneWidget);
    await envoyer(tester);

    final OutboxData op = (await db.select(db.outbox).get()).singleWhere(
      (OutboxData o) => o.entityType == 'rep_call_attempt',
    );
    final Map<String, Object?> payload =
        jsonDecode(op.payload) as Map<String, Object?>;
    expect(payload['etablissementConfirme'], true);
    expect(payload['numeroConfirme'], true);
    expect(payload['phone'], isNull);
    expect(payload['etablissement'], isNull);
    // Rien à corriger : aucune opération sur la fiche elle-même.
    expect(writes.fichesCorrigees, 0);

    await demonter(tester);
  });

  // Le numéro part avec la tentative, le prénom et le nom par l'opération
  // `representant` : la tentative ne sait pas les porter.
  testWidgets('les corrections partent, comptées et récapitulées', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);

    await tester.enterText(champ('Téléphone'), '77 123 45 67');
    await tester.pump();
    await tester.enterText(champ('Prénom'), 'Ousmane');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('2 champs corrigés'), findsOneWidget);
    expect(find.text('Tout est exact'), findsNothing);

    await etapeSuivante(tester);
    await renseignements(tester);
    await taper(tester, tuile(kQuestionCHUES, 'Oui'));
    await etapeSuivante(tester);

    // Le récapitulatif nomme ce qui a changé, pas seulement combien.
    expect(find.text('2 champs corrigés'), findsOneWidget);
    expect(find.text('+221 77 123 45 67'), findsWidgets);

    await envoyer(tester);

    final List<OutboxData> ops = await db.select(db.outbox).get();
    final Map<String, Object?> tentative =
        jsonDecode(
              ops
                  .singleWhere(
                    (OutboxData o) => o.entityType == 'rep_call_attempt',
                  )
                  .payload,
            )
            as Map<String, Object?>;
    expect(tentative['numeroConfirme'], false);
    expect(tentative['phone'], '+221771234567');

    final Map<String, Object?> fiche =
        jsonDecode(
              ops
                  .singleWhere((OutboxData o) => o.entityType == 'representant')
                  .payload,
            )
            as Map<String, Object?>;
    expect(fiche['prenom'], 'Ousmane');
    expect(fiche['fullName'], 'Ousmane Fall');
    expect(fiche['phone'], '+221771234567');

    final Representant rep = await (db.select(
      db.representants,
    )..where((Representants r) => r.id.equals('rep-1'))).getSingle();
    expect(rep.prenom, 'Ousmane');
    expect(rep.phoneE164, '+221771234567');

    await demonter(tester);
  });

  // Un numéro qui n'a pas répondu ne se vérifie avec personne : l'étape
  // n'aurait aucune source.
  testWidgets('un injoignable ne passe pas par la vérification', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    await statut(tester, 'Pas de réponse');
    await etapeSuivante(tester);

    expect(find.text('Vérifier la fiche'), findsNothing);
    expect(find.text('Pour finir'), findsOneWidget);

    await envoyer(tester);

    final OutboxData op = (await db.select(db.outbox).get()).singleWhere(
      (OutboxData o) => o.entityType == 'rep_call_attempt',
    );
    final Map<String, Object?> payload =
        jsonDecode(op.payload) as Map<String, Object?>;
    expect(payload['numeroConfirme'], isNull);
    expect(payload['etablissementConfirme'], isNull);

    await demonter(tester);
  });

  // Une fiche déjà qualifiée s'ouvre aussi depuis une liste : rien n'y dit
  // qu'un collègue vient de passer l'appel.
  testWidgets('une fiche déjà qualifiée demande confirmation avant d\'écrire', (
    WidgetTester tester,
  ) async {
    await db.customStatement('DELETE FROM representants');
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      statutQualificationId: 'sq-accepte',
      lastCallOutcome: 'REACHED',
      lastCallAt: t0.subtract(const Duration(days: 2)),
      callAttemptCount: 3,
    );
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    await statut(tester, 'Pas de réponse');
    await etapeSuivante(tester);
    await envoyer(tester);

    expect(find.text('Déjà qualifié'), findsOneWidget);
    expect(find.textContaining('Accepté'), findsWidgets);

    await tester.tap(find.text('Revenir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(writes.appels, 0);
    expect(await db.select(db.outbox).get(), isEmpty);

    await envoyer(tester);
    await confirmerLeNouvelAppel(tester);

    expect(writes.appels, 1);

    await demonter(tester);
  });

  testWidgets('une fiche jamais appelée s\'enregistre sans confirmation', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Injoignable'));
    await statut(tester, 'Pas de réponse');
    await etapeSuivante(tester);
    await envoyer(tester);

    expect(find.text('Déjà qualifié'), findsNothing);
    expect(writes.appels, 1);

    await demonter(tester);
  });

  testWidgets('la flèche recule d\'une étape et garde les réponses', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);
    await taper(tester, find.text('Joignable'));
    await etapeSuivante(tester);
    await ficheExacte(tester);
    await renseignements(tester);

    await etapePrecedente(tester);
    expect(find.text('Vérifier la fiche'), findsOneWidget);

    await ficheExacte(tester);
    expect(continuer(tester).subtitle, kQuestionManquante);
    expect(find.byIcon(PhosphorIconsRegular.arrowLeft), findsOneWidget);

    await demonter(tester);
  });
}

typedef _Semis = ({
  String code,
  String label,
  String effect,
  bool rappel,
  int? retry,
  bool motif,
  String? relation,
});

_Semis _statut(
  String code,
  String label,
  String effect, {
  bool rappel = false,
  int? retry,
  bool motif = false,
  String? relation,
}) => (
  code: code,
  label: label,
  effect: effect,
  rappel: rappel,
  retry: retry,
  motif: motif,
  relation: relation,
);

/// Le vocabulaire de qualification du Lot 1, tel qu'il descend de la route
/// dédiée. Accepté et Refusé portent la relation : c'est elle qui les désigne
/// quand la question CHUES reçoit sa réponse.
Future<void> semerLesStatuts(AppDatabase db) async {
  final List<_Semis> lignes = <_Semis>[
    _statut('ACCEPTE', 'Accepté', 'REACHED', relation: 'AMBASSADEUR'),
    _statut('REFUSE', 'Refusé', 'REFUSED', relation: 'REFUS'),
    _statut('A_RAPPELER', 'À rappeler', 'SCHEDULE_CALLBACK', rappel: true),
    _statut('HORS_CIBLE', 'Hors cible', 'REFUSED'),
    _statut('FAUX_NUMERO', 'Faux numéro', 'WRONG_NUMBER'),
    _statut('AUTRE_JOINT', 'Autre joint', 'REACHED', motif: true),
    _statut('PAS_DE_REPONSE', 'Pas de réponse', 'UNREACHABLE', retry: 180),
    _statut('INJOIGNABLE_DEFINITIF', 'Injoignable définitif', 'UNREACHABLE'),
    _statut('AUTRE_NON_JOINT', 'Autre non joint', 'UNREACHABLE', motif: true),
  ];
  for (int rang = 0; rang < lignes.length; rang++) {
    final _Semis ligne = lignes[rang];
    await db
        .into(db.statutsQualification)
        .insert(
          StatutsQualificationCompanion.insert(
            code: ligne.code,
            id: 'sq-${ligne.code.toLowerCase().replaceAll('_', '-')}',
            label: ligne.label,
            effect: ligne.effect,
            requiresCallback: Value<bool>(ligne.rappel),
            requiresComment: Value<bool>(ligne.motif),
            retryAfterMinutes: Value<int?>(ligne.retry),
            relationStatus: Value<String?>(ligne.relation),
            position: Value<int>(rang),
          ),
        );
  }
}

/// L'écriture réelle, dont on retient les arguments reçus.
class _WritesEspion extends WriteRepository {
  _WritesEspion(super.db);

  int appels = 0;
  String? outcome;
  String? statutQualificationId;
  String? ouvertureId;
  String? relationStatus;
  String? suggestedPhone;
  String? suggestedName;
  String? suggestedNote;
  DateTime? callbackAt;
  int fichesCorrigees = 0;

  @override
  Future<String> recordRepCallAttempt({
    required String representantId,
    required String outcome,
    String? createdById,
    String? relationStatus,
    String? whatsappStatus,
    String? whatsappE164,
    String? comment,
    DateTime? callbackAt,
    String? suggestedPhone,
    String? suggestedName,
    String? suggestedNote,
    bool? etablissementConfirme,
    String? etablissementSaisi,
    bool? contacte,
    bool? connaitUES,
    String? syndicat,
    bool? numeroConfirme,
    String? numeroSaisi,
    String? statutQualificationId,
    String? ouvertureId,
    String? createdByName,
    String? id,
  }) async {
    appels++;
    this.outcome = outcome;
    this.ouvertureId = ouvertureId;
    this.statutQualificationId = statutQualificationId;
    this.relationStatus = relationStatus;
    this.callbackAt = callbackAt;
    this.suggestedPhone = suggestedPhone;
    this.suggestedName = suggestedName;
    this.suggestedNote = suggestedNote;
    return super.recordRepCallAttempt(
      representantId: representantId,
      outcome: outcome,
      createdById: createdById,
      relationStatus: relationStatus,
      whatsappStatus: whatsappStatus,
      whatsappE164: whatsappE164,
      comment: comment,
      callbackAt: callbackAt,
      suggestedPhone: suggestedPhone,
      suggestedName: suggestedName,
      suggestedNote: suggestedNote,
      etablissementConfirme: etablissementConfirme,
      etablissementSaisi: etablissementSaisi,
      contacte: contacte,
      connaitUES: connaitUES,
      syndicat: syndicat,
      numeroConfirme: numeroConfirme,
      numeroSaisi: numeroSaisi,
      statutQualificationId: statutQualificationId,
      ouvertureId: ouvertureId,
      createdByName: createdByName,
      id: id,
    );
  }

  @override
  Future<void> updateRepresentant({
    required String id,
    required String fullName,
    required String phoneE164,
    required String departementId,
    String? iefId,
    String? notes,
    String whatsappStatus = 'NON_DEMANDE',
    String? whatsappE164,
    String? profession,
    String? prenom,
    String? relationStatus,
    String? relationReason,
    String? draftId,
  }) async {
    fichesCorrigees++;
    return super.updateRepresentant(
      id: id,
      fullName: fullName,
      phoneE164: phoneE164,
      departementId: departementId,
      iefId: iefId,
      notes: notes,
      whatsappStatus: whatsappStatus,
      whatsappE164: whatsappE164,
      profession: profession,
      prenom: prenom,
      relationStatus: relationStatus,
      relationReason: relationReason,
      draftId: draftId,
    );
  }
}

/// Les alarmes système, sans le greffon : un canal de méthode n'a pas
/// d'implantation dans un test de widget.
class _AlarmesEspion extends RepCallbackNotifications {
  final List<String> annulees = <String>[];
  final List<({String id, String phoneE164, DateTime at})> posees =
      <({String id, String phoneE164, DateTime at})>[];

  @override
  Future<RepCallbackPermissions> ensurePermissions() async =>
      (notifications: true, alarmesExactes: true);

  @override
  Future<void> schedule({
    required String id,
    required String representantId,
    required String fullName,
    required String phoneE164,
    required DateTime at,
  }) async => posees.add((id: id, phoneE164: phoneE164, at: at));

  @override
  Future<void> cancel(String id) async => annulees.add(id);
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
