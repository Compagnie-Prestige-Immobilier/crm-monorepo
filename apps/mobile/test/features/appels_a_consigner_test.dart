import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/notifications/notifications_controller.dart';
import 'package:cpi_go/features/telephonie/appels_a_consigner.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';

/// La feuille des appels retrouvés dans le journal. Ce qui compte : elle nomme
/// les fiches, elle emmène à l'écran qui consigne, et elle ne revient pas
/// d'elle-même sur ce qu'on a écarté.
void main() {
  late AppDatabase db;
  late SharedPreferences prefs;

  final DateTime appelRep = t0.subtract(const Duration(minutes: 40));
  final DateTime appelProspect = t0.subtract(const Duration(minutes: 20));

  Future<void> detecter({
    required String id,
    required String kind,
    required String entityId,
    required String phone,
    required String type,
    required DateTime at,
    required int duree,
  }) => db
      .into(db.preuvesAppel)
      .insert(
        PreuvesAppelCompanion.insert(
          id: id,
          kind: kind,
          entityId: entityId,
          phoneE164: phone,
          lanceAt: at,
          mode: 'detecte',
          journalType: Value<String?>(type),
          journalDureeS: Value<int?>(duree),
          journalAt: Value<DateTime?>(at),
          rapprocheAt: Value<DateTime?>(t0),
        ),
      );

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
    db = await openTestDatabase();
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221771234567',
      fullName: 'Awa Diop',
    );
    await insertProspect(
      db,
      id: 'pros-1',
      representantId: 'rep-1',
      phone: '+221780000002',
      nom: 'Fall',
      prenom: 'Ousmane',
    );
    await detecter(
      id: 'preuve-rep',
      kind: 'representant',
      entityId: 'rep-1',
      phone: '+221771234567',
      type: 'sortant',
      at: appelRep,
      duree: 92,
    );
    await detecter(
      id: 'preuve-pros',
      kind: 'prospect',
      entityId: 'pros-1',
      phone: '+221780000002',
      type: 'entrant',
      at: appelProspect,
      duree: 41,
    );
  });

  tearDown(() => db.close());

  late WidgetRef reference;

  Future<void> ouvrir(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          sharedPreferencesProvider.overrideWithValue(prefs),
          clockProvider.overrideWithValue(FakeClock(t0)),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: Scaffold(
            body: Consumer(
              builder: (BuildContext context, WidgetRef ref, Widget? _) {
                reference = ref;
                return TextButton(
                  onPressed: () async => ouvrirAppelsAConsigner(
                    context,
                    ref,
                    await db.appelsAConsigner().get(),
                  ),
                  child: const Text('ouvrir'),
                );
              },
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
  }

  /// Le bouton de LA ligne qui porte cette phrase : la feuille classe du plus
  /// récent au plus ancien, un `first` désignerait l'appel d'à côté.
  Finder bouton(String libelle, {required String dans}) => find.descendant(
    of: find.ancestor(of: find.text(dans), matching: find.byType(CpiCard)),
    matching: find.text(libelle),
  );

  Future<void> toucher(WidgetTester tester, Finder cible) async {
    await tester.ensureVisible(cible);
    await tester.pumpAndSettle();
    await tester.tap(cible);
    await tester.pumpAndSettle();
  }

  Future<PreuvesAppelData> preuve(String id) => (db.select(
    db.preuvesAppel,
  )..where((PreuvesAppel row) => row.id.equals(id))).getSingle();

  testWidgets('la feuille nomme les deux appels retrouvés', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    expect(find.text('Appels à consigner'), findsOneWidget);
    expect(
      find.text('Retrouvés dans le journal du téléphone.'),
      findsOneWidget,
    );
    expect(find.text('Vous avez appelé Awa Diop'), findsOneWidget);
    expect(find.text('Ousmane Fall vous a appelé'), findsOneWidget);
    expect(find.text('Consigner'), findsNWidgets(2));

    // Montrés une fois : le balayage suivant ne refera pas tomber la feuille
    // pour les mêmes appels.
    expect((await preuve('preuve-rep')).signaleAt, t0);
    expect((await preuve('preuve-pros')).signaleAt, t0);
  });

  testWidgets('« Consigner » emmène à la qualification du représentant', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await toucher(
      tester,
      bouton('Consigner', dans: 'Vous avez appelé Awa Diop'),
    );

    expect(
      reference.read(pendingPushRouteProvider)?.route,
      '/representants/rep-1/qualifier',
    );
    expect(find.text('Appels à consigner'), findsNothing);
  });

  testWidgets('« Consigner » emmène le prospect à sa saisie de phase 2', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await toucher(
      tester,
      bouton('Consigner', dans: 'Ousmane Fall vous a appelé'),
    );

    expect(
      reference.read(pendingPushRouteProvider)?.route,
      '/phase2?tel=%2B221780000002',
    );
  });

  testWidgets('« Ignorer » sort l\'appel de la liste pour de bon', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await toucher(tester, bouton('Ignorer', dans: 'Vous avez appelé Awa Diop'));

    expect((await preuve('preuve-rep')).ignoreAt, t0);
    expect((await preuve('preuve-pros')).ignoreAt, isNull);
    expect(
      (await db.appelsAConsigner().get()).map(
        (AppelsAConsignerResult a) => a.id,
      ),
      <String>['preuve-pros'],
    );
  });

  testWidgets('« Plus tard » referme sans rien effacer', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    await toucher(tester, find.text('Plus tard'));

    expect(find.text('Appels à consigner'), findsNothing);
    expect((await db.appelsAConsigner().get()).length, 2);
  });
}
