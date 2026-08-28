import 'package:cpi_go/core/notifications/rep_callback_notifications.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/representant/presentation/representant_qualification_screen.dart';
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

  testWidgets('le bouton reste éteint et dit ce qui manque', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    expect(continuer(tester).onPressed, isNull);
    expect(continuer(tester).subtitle, 'Choisissez d\'abord le résultat');

    await taper(tester, find.text('Joignable'));
    expect(
      continuer(tester).subtitle,
      'Dites s\'il est représentant CPI CHUES',
    );

    await taper(tester, find.text('Oui'));
    expect(continuer(tester).subtitle, 'Dites s\'il a WhatsApp sur ce numéro');

    await taper(tester, find.text('Oui').last);
    expect(continuer(tester).onPressed, isNotNull);
    expect(continuer(tester).subtitle, isNull);

    // L'étape des détails n'ajoute aucune obligation : le bouton d'envoi y est
    // allumé d'emblée.
    await versLesDetails(tester);
    expect(enregistrer(tester).onPressed, isNotNull);
    expect(enregistrer(tester).subtitle, isNull);

    await demonter(tester);
  });

  testWidgets('un « non » ouvre la personne proposée à la place', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsNothing,
    );

    // Le « non » ouvre les champs sur place : la personne proposée se note
    // pendant l'appel, pas une étape plus loin.
    await taper(tester, find.text('Non'));
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsOneWidget,
    );
    // Les trois champs sont actifs d'emblée : ce qui est tapé ne se perd pas
    // faute de numéro, c'est l'enregistrement qui le réclame.
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
    await taper(tester, find.text('Non'));
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

  testWidgets('un « oui » n\'envoie aucune suggestion', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await taper(tester, find.text('Joignable'));
    await taper(tester, find.text('Oui'));
    expect(
      find.text('Il propose quelqu\'un d\'autre ? (facultatif)'),
      findsNothing,
    );
    await taper(tester, find.text('Oui').last);
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
    await taper(tester, find.text('Oui'));
    await taper(tester, find.text('Oui').last);
    await versLesDetails(tester);
    await tester.tap(find.text('Enregistrer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(await db.select(db.repCallbackReminders).get(), isEmpty);
    expect(alarmes.annulees, <String>[promis]);

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
      id: id,
    );
  }
}

/// Les alarmes système, sans le greffon : un canal de méthode n'a pas
/// d'implantation dans un test de widget.
class _AlarmesEspion extends RepCallbackNotifications {
  final List<String> annulees = <String>[];

  @override
  Future<void> schedule({
    required String id,
    required String representantId,
    required String fullName,
    required DateTime at,
  }) async {}

  @override
  Future<void> cancel(String id) async => annulees.add(id);
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
