import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/phase2_directory_sync.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_detail_screen.dart';
import 'package:cpi_go/features/rappels/presentation/rappels_screen.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// La liste des rappels promis.
///
/// L'accueil n'ouvrait que le PROCHAIN rappel : les autres n'étaient joignables
/// par aucun chemin, et le nombre de la carte ne redescendait jamais puisqu'un
/// rappel tenu restait compté pour toujours.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    SinglePush.reset();
  });

  tearDown(() => db.close());

  Future<void> seedFiche({
    required String id,
    required String phone,
    String nom = 'Ndiaye',
    String prenom = 'Awa',
  }) async {
    await db
        .into(db.prospects)
        .insert(
          ProspectsCompanion.insert(
            id: id,
            nom: nom,
            prenom: prenom,
            phoneE164: phone,
            projet: const Value<String>('GRAND_PUBLIC'),
            createdById: 'me',
            clientCreatedAt: t0,
            localUpdatedAt: t0,
          ),
        );
    await db
        .into(db.prospectJourneys)
        .insert(
          ProspectJourneysCompanion.insert(
            prospectId: id,
            projet: 'GRAND_PUBLIC',
          ),
        );
  }

  Future<String> promettre({
    required String prospectId,
    required DateTime at,
    DateTime? saisiA,
  }) {
    return WriteRepository(
      db,
      clock: FakeClock(saisiA ?? t0),
    ).recordCallAttempt(
      prospectId: prospectId,
      outcome: CallOutcomes.callback,
      createdById: 'me',
      callbackAt: at,
    );
  }

  Future<void> seedRappelRepresentant({
    required String id,
    required DateTime at,
  }) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await db
        .into(db.repCallbackReminders)
        .insert(
          RepCallbackRemindersCompanion.insert(
            id: id,
            representantId: 'rep-1',
            fullName: 'Ousmane Fall',
            phoneE164: '+221770000001',
            scheduledAt: at,
            createdAt: t0,
          ),
        );
  }

  Future<GoRouter> ouvrir(WidgetTester tester, String at) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    late GoRouter router;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_Idle.new),
          authControllerProvider.overrideWith(_SignedIn.new),
        ],
        child: Consumer(
          builder: (BuildContext context, WidgetRef ref, Widget? child) {
            router = ref.watch(routerProvider);
            return MaterialApp.router(
              theme: AppTheme.light,
              locale: const Locale('fr'),
              localizationsDelegates: GlobalMaterialLocalizations.delegates,
              supportedLocales: const <Locale>[Locale('fr')],
              routerConfig: router,
            );
          },
        ),
      ),
    );
    await settle(tester);
    router.go(at);
    await settle(tester);
    return router;
  }

  /// `finally` : sans démontage, le minuteur de drift reste en vol et le test
  /// se bloque dix minutes avant d'être tué, message d'échec noyé.
  void rappelsTestWidgets(String description, WidgetTesterCallback body) {
    testWidgets(description, (WidgetTester tester) async {
      try {
        await body(tester);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
      }
    });
  }

  rappelsTestWidgets('les rappels du jour, du plus proche au plus lointain', (
    WidgetTester tester,
  ) async {
    await seedFiche(id: 'gp-1', phone: '+221780000001', prenom: 'Awa');
    await seedFiche(id: 'gp-2', phone: '+221780000002', prenom: 'Fatou');
    // t0 est à 9 h : le premier est déjà en retard, le second est à venir.
    await promettre(prospectId: 'gp-2', at: DateTime.utc(2026, 8, 12, 15));
    await promettre(prospectId: 'gp-1', at: DateTime.utc(2026, 8, 12, 8));

    await ouvrir(tester, Routes.grandPublicRappels);

    final List<String> noms = tester
        .widgetList<Text>(
          find.descendant(
            of: find.byType(RappelsScreen),
            matching: find.byType(Text),
          ),
        )
        .map((Text t) => t.data ?? '')
        .where((String s) => s.startsWith('Awa') || s.startsWith('Fatou'))
        .toList();
    expect(noms, <String>['Awa Ndiaye', 'Fatou Ndiaye']);
    expect(find.text('En retard'), findsOneWidget);
  });

  rappelsTestWidgets('une ligne ouvre la fiche', (WidgetTester tester) async {
    await seedFiche(id: 'gp-1', phone: '+221780000001');
    await promettre(prospectId: 'gp-1', at: DateTime.utc(2026, 8, 12, 15));

    await ouvrir(tester, Routes.grandPublicRappels);
    await tester.tap(find.text('Awa Ndiaye'));
    await settle(tester);

    // L'écran et non l'adresse : une route EMPILÉE ne change pas l'URI de
    // `currentConfiguration`, qui reste celle de la dernière route allée.
    expect(find.byType(ProspectDetailScreen), findsOneWidget);
    expect(find.text('+221 78 000 00 01'), findsOneWidget);
  });

  rappelsTestWidgets('sans rappel, l\'écran le dit', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, Routes.grandPublicRappels);
    expect(find.text('Aucun rappel prévu aujourd\'hui.'), findsOneWidget);
  });

  // La carte n'ouvrait que le prochain rappel : le second était injoignable.
  rappelsTestWidgets('la carte « Rappels » de l\'accueil ouvre la liste', (
    WidgetTester tester,
  ) async {
    await seedFiche(id: 'gp-1', phone: '+221780000001');
    await promettre(prospectId: 'gp-1', at: DateTime.utc(2026, 8, 12, 15));

    await ouvrir(tester, Routes.grandPublic);
    expect(find.text('1 Rappels'), findsOneWidget);

    await tester.tap(find.text('1 Rappels'));
    await settle(tester);

    expect(find.byType(RappelsScreen), findsOneWidget);
    expect(find.text('Awa Ndiaye'), findsOneWidget);
  });

  // Rappeler quelqu'un, c'est saisir un appel de plus sur sa fiche : la
  // promesse est alors tenue, et le nombre de l'accueil doit redescendre.
  rappelsTestWidgets(
    'un appel de plus honore le rappel et fait tomber le compte',
    (WidgetTester tester) async {
      await seedFiche(id: 'gp-1', phone: '+221780000001');
      await promettre(prospectId: 'gp-1', at: DateTime.utc(2026, 8, 12, 15));

      await ouvrir(tester, Routes.grandPublic);
      expect(find.text('1 Rappels'), findsOneWidget);

      await WriteRepository(
        db,
        clock: FakeClock(t0.add(const Duration(hours: 1))),
      ).recordCallAttempt(
        prospectId: 'gp-1',
        outcome: CallOutcomes.refused,
        createdById: 'me',
      );
      await settle(tester);

      expect(find.text('0 Rappels'), findsOneWidget);
    },
  );

  rappelsTestWidgets('les rappels de la phase 1 ont la même liste', (
    WidgetTester tester,
  ) async {
    await seedRappelRepresentant(id: 'rap-1', at: DateTime.utc(2026, 8, 12, 8));

    await ouvrir(tester, Routes.rappels);

    expect(find.text('Ousmane Fall'), findsOneWidget);
    expect(find.text('En retard'), findsOneWidget);
  });
}

Future<void> settle(WidgetTester tester) async {
  for (int i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 60));
  }
}

class _Idle extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _SignedIn extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
    email: 'awa.sy@cpi.sn',
  );
}
