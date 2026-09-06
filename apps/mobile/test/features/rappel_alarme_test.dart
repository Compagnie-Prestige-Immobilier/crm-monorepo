import 'package:cpi_go/core/feedback/feedback.dart';
import 'package:cpi_go/core/notifications/rep_callback_notifications.dart';
import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/notifications/rep_callback_due_listener.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Un rappel promis doit être impossible à manquer : deux alarmes système
/// (pré-rappel et heure convenue), une fenêtre qui s'impose dans l'app, et un
/// bandeau tant que l'heure est passée sans qu'un appel ait été consigné.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
  });

  tearDown(() => db.close());

  Future<void> promettre({
    required String id,
    required DateTime at,
    DateTime? notifieA,
  }) => db
      .into(db.repCallbackReminders)
      .insert(
        RepCallbackRemindersCompanion.insert(
          id: id,
          representantId: 'rep-1',
          fullName: 'Ousmane Fall',
          phoneE164: '+221770000001',
          scheduledAt: at,
          createdAt: t0,
          notifiedAt: Value<DateTime?>(notifieA),
        ),
      );

  group('alarmes système', () {
    const MethodChannel canal = MethodChannel(
      'dexterous.com/flutter/local_notifications',
    );
    late List<MethodCall> appels;

    setUp(() {
      appels = <MethodCall>[];
      // Le greffon ne s'enregistre qu'au démarrage de l'application : sans ce
      // couple, `resolvePlatformSpecificImplementation` rend `null` et rien
      // ne part sur le canal.
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      AndroidFlutterLocalNotificationsPlugin.registerWith();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, (MethodCall call) async {
            appels.add(call);
            return call.method == 'canScheduleExactNotifications' ? true : null;
          });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, null);
      debugDefaultTargetPlatformOverride = null;
    });

    List<Map<Object?, Object?>> armees() => appels
        .where((MethodCall c) => c.method == 'zonedSchedule')
        .map((MethodCall c) => c.arguments as Map<Object?, Object?>)
        .toList(growable: false);

    test('un rappel arme le pré-rappel ET l\'heure convenue', () async {
      final DateTime maintenant = DateTime.now().toUtc();
      final DateTime at = maintenant.add(const Duration(hours: 2));
      await RepCallbackNotifications(clock: FakeClock(maintenant)).schedule(
        id: 'rap-1',
        representantId: 'rep-1',
        fullName: 'Ousmane Fall',
        phoneE164: '+221770000001',
        at: at,
      );

      final (int preAlerte, int heure) =
          RepCallbackNotifications.notificationIdsFor('rap-1');
      expect(preAlerte, isNot(heure));
      expect(armees().map((Map<Object?, Object?> a) => a['id']), <int>[
        preAlerte,
        heure,
      ]);
      expect(armees().first['title'], 'Rappel dans 5 min');
      expect(armees().first['body'], 'Ousmane Fall · +221 77 000 00 01');
      expect(armees().last['title'], 'À rappeler maintenant');
      // Les deux portent le même rappel : le report sait quelle ligne bouger.
      expect(
        armees().every(
          (Map<Object?, Object?> a) => a['payload'] == 'rap-1|rep-1',
        ),
        isTrue,
      );
    });

    test(
      'le canal sonne comme un réveil, et l\'heure exacte insiste',
      () async {
        final DateTime maintenant = DateTime.now().toUtc();
        await RepCallbackNotifications(clock: FakeClock(maintenant)).schedule(
          id: 'rap-1',
          representantId: 'rep-1',
          fullName: 'Ousmane Fall',
          phoneE164: '+221770000001',
          at: maintenant.add(const Duration(hours: 2)),
        );

        final Map<Object?, Object?> preAlerte =
            armees().first['platformSpecifics']! as Map<Object?, Object?>;
        final Map<Object?, Object?> heure =
            armees().last['platformSpecifics']! as Map<Object?, Object?>;
        expect(preAlerte['channelId'], 'rep_callback_alarme');
        expect(preAlerte['importance'], Importance.max.value);
        expect(preAlerte['sound'], 'content://settings/system/alarm_alert');
        expect(preAlerte['fullScreenIntent'], isFalse);
        expect(preAlerte['additionalFlags'], isNull);
        expect(heure['fullScreenIntent'], isTrue);
        // `Notification.FLAG_INSISTENT` : le son boucle jusqu'au geste.
        expect(heure['additionalFlags'], <int>[4]);
        expect(
          (heure['actions']! as List<Object?>).length,
          2,
          reason: 'appeler et reporter',
        );
      },
    );

    test('annuler un rappel éteint ses DEUX alarmes', () async {
      await RepCallbackNotifications().cancel('rap-1');

      final (int preAlerte, int heure) =
          RepCallbackNotifications.notificationIdsFor('rap-1');
      expect(
        appels
            .where((MethodCall c) => c.method == 'cancel')
            .map(
              (MethodCall c) => (c.arguments as Map<Object?, Object?>)['id'],
            ),
        <int>[preAlerte, heure],
      );
    });
  });

  test(
    'reporter pousse le rappel de dix minutes et rouvre la fenêtre',
    () async {
      await promettre(id: 'rap-1', at: t0, notifieA: t0);

      final RepCallbackReminder? repousse = await WriteRepository(
        db,
        clock: FakeClock(t0),
      ).snoozeRepCallback(id: 'rap-1', by: kRepCallbackReport);

      expect(repousse, isNotNull);
      expect(
        repousse!.scheduledAt.isAtSameMomentAs(t0.add(kRepCallbackReport)),
        isTrue,
      );
      expect(repousse.notifiedAt, isNull);
    },
  );

  test('reporter un rappel déjà honoré ne ressuscite rien', () async {
    expect(
      await WriteRepository(
        db,
        clock: FakeClock(t0),
      ).snoozeRepCallback(id: 'parti', by: kRepCallbackReport),
      isNull,
    );
  });

  group('dans l\'application', () {
    late _AlarmesEspion alarmes;
    late FakeClock horloge;

    setUp(() {
      alarmes = _AlarmesEspion();
      horloge = FakeClock(t0);
    });

    Future<void> monter(WidgetTester tester, Widget corps) async {
      tester.view.physicalSize = const Size(1080, 2340);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: <Override>[
            appDatabaseProvider.overrideWithValue(db),
            apiPortProvider.overrideWithValue(api),
            clockProvider.overrideWithValue(horloge),
            sharedPreferencesProvider.overrideWithValue(prefs),
            repCallbackNotificationsProvider.overrideWithValue(alarmes),
            feedbackProvider.overrideWithValue(_RetoursMuets()),
            syncCoordinatorProvider.overrideWith(_Idle.new),
            authControllerProvider.overrideWith(_Connecte.new),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: Scaffold(body: corps),
          ),
        ),
      );
      await battre(tester);
    }

    Future<void> demonter(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
    }

    testWidgets('la fenêtre tombe dès le pré-rappel, cinq minutes avant', (
      WidgetTester tester,
    ) async {
      // Encore trois minutes avant le pré-rappel : rien ne doit s'ouvrir.
      await promettre(id: 'rap-1', at: t0.add(const Duration(minutes: 8)));
      await monter(tester, const RepCallbackDueListener(child: SizedBox()));
      await tester.pump(const Duration(seconds: 21));
      await battre(tester);
      expect(find.text('Rappel'), findsNothing);

      horloge.advance(const Duration(minutes: 4));
      await tester.pump(const Duration(seconds: 21));
      await battre(tester);

      expect(find.text('Rappel'), findsOneWidget);
      expect(find.text('Ousmane Fall'), findsOneWidget);
      expect(find.textContaining('dans 4 min'), findsOneWidget);
      expect(find.text('Appeler maintenant'), findsOneWidget);

      await demonter(tester);
    });

    testWidgets('deux rappels à la même heure tiennent dans UNE fenêtre', (
      WidgetTester tester,
    ) async {
      await promettre(id: 'rap-1', at: t0);
      await db
          .into(db.repCallbackReminders)
          .insert(
            RepCallbackRemindersCompanion.insert(
              id: 'rap-2',
              representantId: 'rep-1',
              fullName: 'Awa Sy',
              phoneE164: '+221770000002',
              scheduledAt: t0,
              createdAt: t0,
            ),
          );

      await monter(tester, const RepCallbackDueListener(child: SizedBox()));
      await tester.pump(const Duration(seconds: 21));
      await battre(tester);

      expect(find.text('2 rappels'), findsOneWidget);
      expect(find.text('Ousmane Fall'), findsOneWidget);
      expect(find.text('Awa Sy'), findsOneWidget);
      // Le geste « Appeler maintenant » ne désignerait personne.
      expect(find.text('Appeler maintenant'), findsNothing);

      await demonter(tester);
    });

    testWidgets('« Plus tard » repousse de dix minutes et réarme l\'alarme', (
      WidgetTester tester,
    ) async {
      await promettre(id: 'rap-1', at: t0);
      await monter(tester, const RepCallbackDueListener(child: SizedBox()));
      await tester.pump(const Duration(seconds: 21));
      await battre(tester);

      await tester.tap(find.text('Plus tard (10 min)'));
      await battre(tester);

      final RepCallbackReminder ligne = await db
          .select(db.repCallbackReminders)
          .getSingle();
      expect(
        ligne.scheduledAt.isAtSameMomentAs(t0.add(kRepCallbackReport)),
        isTrue,
      );
      expect(ligne.notifiedAt, isNull);
      // La dernière posée, et non la seule : le démarrage réarme déjà les
      // rappels en base.
      expect(alarmes.posees.last.id, 'rap-1');
      expect(
        alarmes.posees.last.at.isAtSameMomentAs(t0.add(kRepCallbackReport)),
        isTrue,
      );

      await demonter(tester);
    });

    testWidgets('un rappel déjà notifié ne se réarme pas au démarrage', (
      WidgetTester tester,
    ) async {
      await promettre(
        id: 'rap-1',
        at: t0.add(const Duration(hours: 3)),
        notifieA: t0,
      );

      await monter(tester, const RepCallbackDueListener(child: SizedBox()));

      expect(alarmes.posees, isEmpty);

      await demonter(tester);
    });

    testWidgets('le bandeau de retard coiffe l\'accueil jusqu\'à l\'appel', (
      WidgetTester tester,
    ) async {
      await promettre(id: 'rap-1', at: t0.add(const Duration(minutes: 30)));
      await monter(tester, const HomeScreen());
      expect(find.textContaining('en retard'), findsNothing);

      horloge.advance(const Duration(hours: 1));
      await tester.pump(const Duration(minutes: 1));
      await battre(tester);
      expect(find.text('Rappel en retard : Ousmane Fall.'), findsOneWidget);

      // Consigner un appel honore la promesse : la ligne part, le bandeau avec.
      await WriteRepository(
        db,
        clock: FakeClock(horloge.now()),
      ).honourRepCallbacks(representantId: 'rep-1');
      await battre(tester);
      expect(find.textContaining('en retard'), findsNothing);

      await demonter(tester);
    });
  });

  // Un redémarrage vide la file d'alarmes d'Android, et le récepteur du greffon
  // ne rejoue que ce qu'il a lui-même posé : un rappel promis alors que la
  // permission d'alarme exacte manquait ne sonnerait jamais.
  group('après redémarrage', () {
    const MethodChannel canal = MethodChannel(
      'dexterous.com/flutter/local_notifications',
    );
    late List<MethodCall> appels;

    setUp(() {
      appels = <MethodCall>[];
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      AndroidFlutterLocalNotificationsPlugin.registerWith();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, (MethodCall call) async {
            appels.add(call);
            return switch (call.method) {
              'canScheduleExactNotifications' || 'initialize' => true,
              _ => null,
            };
          });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(canal, null);
      debugDefaultTargetPlatformOverride = null;
    });

    /// Le greffon compare à l'horloge RÉELLE avant d'armer : un instant fixe du
    /// passé y serait refusé.
    final DateTime maintenant = DateTime.now().toUtc();

    Future<void> demarrer(WidgetTester tester) async {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await tester.pumpWidget(
        ProviderScope(
          overrides: <Override>[
            appDatabaseProvider.overrideWithValue(db),
            apiPortProvider.overrideWithValue(api),
            clockProvider.overrideWithValue(FakeClock(maintenant)),
            sharedPreferencesProvider.overrideWithValue(prefs),
            feedbackProvider.overrideWithValue(_RetoursMuets()),
            syncCoordinatorProvider.overrideWith(_Idle.new),
            authControllerProvider.overrideWith(_Connecte.new),
          ],
          child: const MaterialApp(
            home: Scaffold(body: RepCallbackDueListener(child: SizedBox())),
          ),
        ),
      );
      await battre(tester);
    }

    List<Object?> armees() => appels
        .where((MethodCall c) => c.method == 'zonedSchedule')
        .map((MethodCall c) => (c.arguments as Map<Object?, Object?>)['id'])
        .toList(growable: false);

    /// Le drapeau de plateforme se rend AVANT la fin du corps du test : le banc
    /// vérifie ses invariants avant de dérouler les `tearDown`.
    Future<void> terminer(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
      debugDefaultTargetPlatformOverride = null;
    }

    testWidgets('les rappels en base réarment leurs deux alarmes', (
      WidgetTester tester,
    ) async {
      await promettre(
        id: 'rap-1',
        at: maintenant.add(const Duration(hours: 3)),
      );
      await promettre(
        id: 'rap-2',
        at: maintenant.add(const Duration(hours: 5)),
      );

      await demarrer(tester);

      final (int pre1, int heure1) =
          RepCallbackNotifications.notificationIdsFor('rap-1');
      final (int pre2, int heure2) =
          RepCallbackNotifications.notificationIdsFor('rap-2');
      expect(armees(), <int>[pre1, heure1, pre2, heure2]);

      await terminer(tester);
    });

    // Le greffon REFUSE une alarme dans le passé : sans ce filtre, un rappel en
    // retard levait au démarrage et les suivants n'étaient jamais armés.
    testWidgets(
      'un rappel en retard n\'arme rien et n\'empêche pas les autres',
      (WidgetTester tester) async {
        await promettre(
          id: 'rap-0',
          at: maintenant.subtract(const Duration(hours: 1)),
        );
        await promettre(
          id: 'rap-1',
          at: maintenant.add(const Duration(hours: 3)),
        );

        await demarrer(tester);

        final (int pre1, int heure1) =
            RepCallbackNotifications.notificationIdsFor('rap-1');
        expect(armees(), <int>[pre1, heure1]);

        await terminer(tester);
      },
    );
  });
}

Future<void> battre(WidgetTester tester) async {
  for (int i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

/// Les alarmes système, sans le greffon : un canal de méthode n'a pas
/// d'implantation dans un test de widget.
class _AlarmesEspion extends RepCallbackNotifications {
  final List<({String id, DateTime at})> posees =
      <({String id, DateTime at})>[];
  final List<String> annulees = <String>[];

  @override
  Future<void> initialize({
    required void Function(RepCallbackTap tap) onAction,
  }) async {}

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
  }) async => posees.add((id: id, at: at));

  @override
  Future<void> cancel(String id) async => annulees.add(id);
}

/// `just_audio` n'a pas de greffon natif sous `flutter test`.
class _RetoursMuets extends CpiFeedbackService {
  @override
  void jouer(CpiFeedback retour) {}

  @override
  Future<void> preparer() async {}
}

class _Idle extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _Connecte extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
    email: 'awa.sy@cpi.sn',
  );
}
