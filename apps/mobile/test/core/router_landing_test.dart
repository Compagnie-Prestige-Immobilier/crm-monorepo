import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/notifications/presentation/notifications_screen.dart';
import 'package:cpi_go/features/phase2/presentation/phase2_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_qualification_screen.dart';
import 'package:cpi_go/features/shell/hub_screen.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Où atterrit un compte qui vient de se connecter, et où il est ramené quand
/// il tient encore une fiche.
///
/// Le hub est un choix : il ne se pose que s'il y a quelque chose à choisir. Un
/// compte d'accueil n'ouvre que le registre ; lui demander de toucher une tuile
/// unique avant de commencer sa journée, c'est un geste pour rien.
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

  Future<void> open(WidgetTester tester, String role) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(() => _SignedIn(role)),
        ],
        child: Consumer(
          builder: (BuildContext context, WidgetRef ref, Widget? child) =>
              MaterialApp.router(
                theme: AppTheme.light,
                locale: const Locale('fr'),
                localizationsDelegates: GlobalMaterialLocalizations.delegates,
                supportedLocales: const <Locale>[Locale('fr')],
                routerConfig: ref.watch(routerProvider),
              ),
        ),
      ),
    );
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets('un compte d\'accueil arrive sur son registre', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ACCUEIL');

    expect(find.byType(RegistreScreen), findsOneWidget);
    expect(find.byType(HubScreen), findsNothing);

    await unmount(tester);
  });

  testWidgets('le téléconseiller choisit entre ses deux projets', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('l\'administration choisit entre les trois', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ADMIN');

    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });

  Future<void> tenirLaFiche(
    AppDatabase db, {
    String? representantId,
    String? prospectId,
  }) => db
      .into(db.ouverturesFiche)
      .insert(
        OuverturesFicheCompanion.insert(
          id: 'ouv-1',
          openedById: 'u-1',
          representantId: Value<String?>(representantId),
          prospectId: Value<String?>(prospectId),
          openedAt: t0.subtract(const Duration(minutes: 3)),
          // EB-09 : le chronomètre part de la première saisie, pas de
          // l'ouverture.
          firstInputAt: Value<DateTime?>(t0.subtract(const Duration(minutes: 2))),
        ),
      );

  // EB-08 : l'application fermée ou plantée rouvre la fiche en cours, verrou
  // actif, chronomètre reparti de l'ouverture. Rien d'autre ne ramenait
  // jusqu'ici sur la fiche tenue : la route mémorisée n'est qu'un souvenir
  // d'écran, elle ne sait pas qu'une fiche est en main.
  testWidgets('la fiche tenue se rouvre au démarrage', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await tenirLaFiche(db, representantId: 'rep-1');

    await open(tester, 'COMMERCIAL');

    expect(find.byType(RepresentantQualificationScreen), findsOneWidget);
    expect(find.byType(HubScreen), findsNothing);
    expect(find.text('Ouvrir la fiche de Représentant ?'), findsNothing);
    expect(find.text('02:00'), findsOneWidget);

    await unmount(tester);
  });

  // EB-08 : la fiche tenue ne se quitte pas par une autre route. Un lien de
  // notification y ramène, comme la barre d'onglets.
  testWidgets('une autre route ramène sur la fiche tenue', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await tenirLaFiche(db, representantId: 'rep-1');

    await open(tester, 'COMMERCIAL');
    ProviderScope.containerOf(
      tester.element(find.byType(MaterialApp)),
      listen: false,
    ).read(routerProvider).go(Routes.notifications);
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }

    expect(find.byType(RepresentantQualificationScreen), findsOneWidget);
    expect(find.byType(NotificationsScreen), findsNothing);

    await unmount(tester);
  });

  // La fiche d'un prospect se rouvre par son numéro : sans lui, l'écran d'appel
  // repart d'une recherche vide et l'ouverture reste ouverte pour rien.
  testWidgets('la fiche d\'un prospect se rouvre sur son numéro', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.phase2Directory)
        .insert(
          Phase2DirectoryCompanion.insert(
            prospectId: 'pro-1',
            phoneE164: '+221771234567',
            updatedAt: t0,
          ),
        );
    await tenirLaFiche(db, prospectId: 'pro-1');

    await open(tester, 'COMMERCIAL');

    expect(find.byType(Phase2Screen), findsOneWidget);
    expect(find.text('02:00'), findsOneWidget);

    await unmount(tester);
  });

  // Une fiche jamais descendue sur cet appareil n'a pas de numéro à rappeler :
  // l'application reste libre au lieu de renvoyer en boucle vers une recherche
  // vide.
  testWidgets('une fiche inconnue de l\'appareil n\'enferme personne', (
    WidgetTester tester,
  ) async {
    await tenirLaFiche(db, prospectId: 'pro-jamais-descendu');

    await open(tester, 'COMMERCIAL');

    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _SignedIn extends AuthController {
  _SignedIn(this.role);

  final String role;

  @override
  AuthState build() => AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: role,
    email: 'awa.sy@cpi.sn',
  );
}
