import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/contacts/presentation/mes_contacts_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_detail_screen.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// « Mes contacts » : les personnes que J'AI appelées. Les rappels ne montrent
/// que ce qui a été promis, « Injoignables » que les appels sans réponse.
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

  Future<void> seedProspect({
    required String id,
    required String phone,
    String prenom = 'Awa',
    String? parQui = 'u-1',
    String? issue,
    String projet = 'GRAND_PUBLIC',
  }) async {
    await db
        .into(db.prospects)
        .insert(
          ProspectsCompanion.insert(
            id: id,
            nom: 'Ndiaye',
            prenom: prenom,
            phoneE164: phone,
            projet: Value<String>(projet),
            createdById: 'u-1',
            clientCreatedAt: t0,
            localUpdatedAt: t0,
            lastCallOutcome: Value<String?>(issue),
            lastCallAt: Value<DateTime?>(t0),
            lastCallById: Value<String?>(parQui),
          ),
        );
    await db
        .into(db.prospectJourneys)
        .insert(
          ProspectJourneysCompanion.insert(prospectId: id, projet: projet),
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

  void contactsTestWidgets(String description, WidgetTesterCallback body) {
    testWidgets(description, (WidgetTester tester) async {
      try {
        await body(tester);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
      }
    });
  }

  contactsTestWidgets('les prospects que J\'AI appelés, et eux seuls', (
    WidgetTester tester,
  ) async {
    await seedProspect(
      id: 'gp-1',
      phone: '+221780000001',
      issue: 'METHOD_OBTAINED',
    );
    await seedProspect(
      id: 'gp-2',
      phone: '+221780000002',
      prenom: 'Fatou',
      parQui: 'u-2',
    );
    await seedProspect(
      id: 'gp-3',
      phone: '+221780000003',
      prenom: 'Bineta',
      parQui: null,
    );

    await ouvrir(tester, Routes.grandPublicMesContacts);

    expect(find.text('Awa Ndiaye'), findsOneWidget);
    expect(find.text('Fatou Ndiaye'), findsNothing);
    expect(find.text('Bineta Ndiaye'), findsNothing);
    expect(find.textContaining('Dernier appel : '), findsOneWidget);
    expect(find.text('Méthode obtenue'), findsOneWidget);
    // Le statut vient de l'annuaire : sans ligne, la conversion reste à traiter.
    expect(find.text('À traiter'), findsOneWidget);
  });

  // Le Grand Public n'a pas de représentants : rien à mettre en face.
  contactsTestWidgets('le Grand Public n\'a pas d\'onglets', (
    WidgetTester tester,
  ) async {
    await seedProspect(id: 'gp-1', phone: '+221780000001');

    await ouvrir(tester, Routes.grandPublicMesContacts);

    expect(find.text('Représentants'), findsNothing);
  });

  contactsTestWidgets('en CHUES, l\'onglet Représentants liste mes appels', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-moi',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      relationStatus: 'AMBASSADEUR',
      lastCallOutcome: 'REACHED',
      lastCallAt: t0,
      lastCallById: 'u-1',
    );
    await insertRepresentant(
      db,
      id: 'rep-collegue',
      phone: '+221770000002',
      fullName: 'Aminata Ba',
      lastCallOutcome: 'REACHED',
      lastCallAt: t0,
      lastCallById: 'u-2',
    );

    await ouvrir(tester, Routes.mesContacts);
    await tester.tap(find.text('Représentants'));
    await settle(tester);

    expect(find.text('Ousmane Fall'), findsOneWidget);
    expect(find.text('Aminata Ba'), findsNothing);
    expect(find.text('Joint'), findsOneWidget);
    expect(find.text('A accepté'), findsOneWidget);

    await tester.tap(find.text('Ousmane Fall'));
    await settle(tester);
    expect(find.byType(RepresentantDetailScreen), findsOneWidget);
  });

  contactsTestWidgets('sans appel consigné, l\'écran le dit', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, Routes.mesContacts);
    expect(find.text('Aucun appel consigné.'), findsOneWidget);
  });

  contactsTestWidgets('la carte de l\'accueil CHUES ouvre la liste', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester, Routes.chues);
    await tester.scrollUntilVisible(
      find.text('Mes contacts'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await settle(tester);
    await tester.tap(find.text('Mes contacts'));
    await settle(tester);

    expect(find.byType(MesContactsScreen), findsOneWidget);
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
