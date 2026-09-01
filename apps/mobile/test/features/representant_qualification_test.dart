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
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le résultat d'un appel à un représentant.
///
/// Deux choses s'y jouent : le bouton ne ment plus (il reste éteint et DIT ce
/// qui manque, au lieu de laisser taper puis de reprocher), et un « non » n'est
/// plus une impasse : la personne appelée propose souvent quelqu'un d'autre.
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
  });

  tearDown(() => db.close());

  Future<void> ouvrir(WidgetTester tester) async {
    // Surface haute : le corps est un `ListView`, qui ne construit pas ce qui
    // sort du viewport. Les champs de la personne proposée sont en bas.
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

  /// L'écran est en DEUX étapes : le résultat, puis les détails et l'envoi.
  Future<void> versLesDetails(WidgetTester tester) async {
    await tester.tap(find.text('Continuer'));
    await tester.pump();
    // 150 ms : la durée de l'animation d'appui de ForUI. Écourtée, elle laisse
    // un minuteur en vol et le démontage échoue sur l'invariant.
    await tester.pump(const Duration(milliseconds: 300));
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
  /// coexistent maintenant, il faut viser dans le bon groupe.
  Finder tuile(String question, String reponse) => find.descendant(
    of: find.byWidgetPredicate(
      (Widget w) => w is CpiChoiceGroup && w.label == question,
    ),
    matching: find.text(reponse),
  );

  /// Renseignements 1 à 4 du script, posés quel que soit l'ambassadeur.
  Future<void> renseignements(WidgetTester tester) async {
    await taper(tester, tuile('Confirmer l\'établissement ?', 'Oui'));
    await taper(tester, tuile('Avez-vous été contacté ?', 'Oui'));
    await taper(tester, tuile('Connaissez-vous l\'UES ?', 'Oui'));
  }

  testWidgets('le bouton reste éteint et suit l\'ordre du script', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    expect(continuer(tester).onPressed, isNull);
    expect(continuer(tester).subtitle, 'Choisissez d\'abord le résultat');

    await taper(tester, find.text('Joignable'));
    expect(continuer(tester).subtitle, 'Confirmez l\'établissement');

    await taper(tester, tuile('Confirmer l\'établissement ?', 'Oui'));
    expect(continuer(tester).subtitle, 'Dites s\'il a été contacté');

    await taper(tester, tuile('Avez-vous été contacté ?', 'Oui'));
    expect(continuer(tester).subtitle, 'Dites s\'il connaît l\'UES');

    await taper(tester, tuile('Connaissez-vous l\'UES ?', 'Oui'));
    expect(continuer(tester).subtitle, 'Dites s\'il est ambassadeur');

    await taper(tester, tuile('Ambassadeur ?', 'Oui'));
    expect(continuer(tester).subtitle, 'Confirmez le numéro');

    await taper(tester, tuile('Confirmer le numéro ?', 'Oui'));
    expect(continuer(tester).subtitle, 'Dites s\'il a WhatsApp sur ce numéro');

    await taper(tester, tuile('A-t-il WhatsApp sur ce numéro ?', 'Oui'));
    expect(continuer(tester).onPressed, isNotNull);
    expect(continuer(tester).subtitle, isNull);

    // L'étape des détails n'ajoute aucune obligation : le bouton d'envoi y est
    // allumé d'emblée.
    await versLesDetails(tester);
    expect(enregistrer(tester).onPressed, isNotNull);
    expect(enregistrer(tester).subtitle, isNull);

    await demonter(tester);
  });

  testWidgets('un « non » à l\'ambassadeur ouvre la personne proposée', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await renseignements(tester);
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsNothing,
    );

    // Le « non » ouvre les champs sur place : la personne proposée se note
    // pendant l'appel, pas une étape plus loin.
    await taper(tester, tuile('Ambassadeur ?', 'Non'));
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsOneWidget,
    );
    // Ni numéro ni WhatsApp ne sont demandés à un non-ambassadeur.
    expect(find.text('Confirmer le numéro ?'), findsNothing);
    expect(find.text('A-t-il WhatsApp sur ce numéro ?'), findsNothing);
    expect(
      tester.widget<TextField>(champ('Son nom et prénom (facultatif)')).enabled,
      isTrue,
    );

    await tester.enterText(
      champ('Son nom et prénom (facultatif)'),
      'Fatou Sarr',
    );
    await tester.pump();
    expect(
      continuer(tester).subtitle,
      'Écrivez le numéro de la personne proposée',
    );

    await tester.enterText(champ('Son numéro'), '77 123 45 67');
    await tester.pump();
    await tester.enterText(
      champ('Sa remarque (facultatif)'),
      'Elle est déléguée du personnel.',
    );
    await tester.pump();

    await versLesDetails(tester);
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(writes.suggestedPhone, '+221771234567');
    expect(writes.suggestedName, 'Fatou Sarr');
    expect(writes.suggestedNote, 'Elle est déléguée du personnel.');
    expect(writes.outcome, 'REFUSED');
    expect(writes.relationStatus, 'REFUS');

    await demonter(tester);
  });

  testWidgets('un numéro proposé incomplet éteint le bouton', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await renseignements(tester);
    await taper(tester, tuile('Ambassadeur ?', 'Non'));
    expect(continuer(tester).onPressed, isNotNull);

    await tester.enterText(champ('Son numéro'), '77 12');
    await tester.pump();

    expect(continuer(tester).onPressed, isNull);
    expect(
      continuer(tester).subtitle,
      'Numéro de la personne proposée incomplet',
    );

    await demonter(tester);
  });

  testWidgets('un ambassadeur n\'envoie aucune suggestion', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await renseignements(tester);
    await taper(tester, tuile('Ambassadeur ?', 'Oui'));
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsNothing,
    );
    await taper(tester, tuile('Confirmer le numéro ?', 'Oui'));
    await taper(tester, tuile('A-t-il WhatsApp sur ce numéro ?', 'Oui'));
    await versLesDetails(tester);
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsNothing,
    );

    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

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
    await taper(tester, tuile('Confirmer l\'établissement ?', 'Non'));
    await tester.enterText(
      champ('Nouvel établissement'),
      'Lycée Blaise Diagne',
    );
    await tester.pump();
    await taper(tester, tuile('Avez-vous été contacté ?', 'Non'));
    await taper(tester, tuile('Connaissez-vous l\'UES ?', 'Oui'));
    await tester.enterText(
      champ('Niveau de syndicat (facultatif)'),
      'Secrétaire général',
    );
    await tester.pump();
    await taper(tester, tuile('Ambassadeur ?', 'Oui'));
    await taper(tester, tuile('Confirmer le numéro ?', 'Non'));
    await tester.enterText(champ('Nouveau numéro'), '77 987 65 43');
    await tester.pump();
    await taper(tester, tuile('A-t-il WhatsApp sur ce numéro ?', 'Oui'));

    await versLesDetails(tester);
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

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
    expect(payload['syndicat'], 'Secrétaire général');
    expect(payload['numeroConfirme'], false);
    expect(payload['phone'], '+221779876543');
    expect(payload['whatsappStatus'], 'MEME_NUMERO');

    // La fiche locale a suivi : nouvel établissement et nouveau numéro.
    final Representant rep = await (db.select(
      db.representants,
    )..where((Representants r) => r.id.equals('rep-1'))).getSingle();
    expect(rep.etablissement, 'Lycée Blaise Diagne');
    expect(rep.phoneE164, '+221779876543');
    expect(rep.syndicat, 'Secrétaire général');
    expect(rep.connaitUes, isTrue);
    expect(rep.contacte, isFalse);

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
      outcome: 'CALLBACK',
      callbackAt: t0.add(const Duration(hours: 2)),
    );

    await ouvrir(tester);
    await taper(tester, find.text('Joignable'));
    await renseignements(tester);
    await taper(tester, tuile('Ambassadeur ?', 'Oui'));
    await taper(tester, tuile('Confirmer le numéro ?', 'Oui'));
    await taper(tester, tuile('A-t-il WhatsApp sur ce numéro ?', 'Oui'));
    await versLesDetails(tester);
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

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
    await taper(tester, find.text('À rappeler'));
    await taper(tester, find.text('Demain 9 h'));
    await versLesDetails(tester);
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(alarmes.posees.single.phoneE164, '+221770000001');
    expect(alarmes.posees.single.at.hour, 9);

    await demonter(tester);
  });
}

/// L'écriture réelle, dont on retient les arguments reçus.
class _WritesEspion extends WriteRepository {
  _WritesEspion(super.db);

  String? outcome;
  String? relationStatus;
  String? suggestedPhone;
  String? suggestedName;
  String? suggestedNote;

  @override
  Future<String> recordRepCallAttempt({
    required String representantId,
    required String outcome,
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
    String? id,
  }) async {
    this.outcome = outcome;
    this.relationStatus = relationStatus;
    this.suggestedPhone = suggestedPhone;
    this.suggestedName = suggestedName;
    this.suggestedNote = suggestedNote;
    return super.recordRepCallAttempt(
      representantId: representantId,
      outcome: outcome,
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
      id: id,
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
