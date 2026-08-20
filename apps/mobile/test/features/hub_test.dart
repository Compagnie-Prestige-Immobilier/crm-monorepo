import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/theme/cpi_tokens.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/shell/grand_public_screen.dart';
import 'package:cpi_go/features/shell/hub_screen.dart';
import 'package:cpi_go/features/shell/projects.dart';
import 'package:cpi_go/ui/widgets/cpi_pressable.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le hub est la première chose que voit un compte connecté, et la seule qui
/// tienne les trois projets séparés.
///
/// Deux règles s'y jouent, et aucune ne se vérifie à l'œil sur un émulateur :
/// une tuile hors de portée du rôle reste VISIBLE mais n'emmène nulle part, et
/// entrer dans une coque change la palette, en sortir la rend. Une coque qui
/// garde la palette de la précédente, c'est un téléconseiller qui ne sait plus
/// dans quel projet il saisit.
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

  Future<Widget> app(String role) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(() => _SignedInController(role)),
      ],
      child: Consumer(
        builder: (BuildContext context, WidgetRef ref, Widget? child) {
          return MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            routerConfig: ref.watch(routerProvider),
          );
        },
      ),
    );
  }

  Future<void> settle(WidgetTester tester) async {
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
  }

  Future<void> open(WidgetTester tester, String role) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(await app(role));
    await settle(tester);
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// Une tuile, et pas le meme libelle ailleurs : l'ecran sortant reste peint
  /// pendant sa transition, et le titre de sa barre porte le meme mot.
  Finder tile(String label) =>
      find.descendant(of: find.byType(HubScreen), matching: find.text(label));

  Color primaryAt(WidgetTester tester, Finder screen) =>
      Theme.of(tester.element(screen)).colorScheme.primary;

  testWidgets('un compte connecté arrive sur le hub, et sur trois tuiles', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(find.byType(HubScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    // Trois projets, pas quatre : l'administration ne se tient pas au
    // téléphone, et une tuile de plus serait une porte qui ne mène nulle part.
    expect(find.byType(CpiPressable), findsNWidgets(3));
    expect(find.text('Projet CHUES'), findsOneWidget);
    expect(find.text('Projet Grand Public'), findsOneWidget);
    expect(find.text('Accueil'), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('chaque projet porte une icône lisible dans une cible large', (
    WidgetTester tester,
  ) async {
    // Le hub se touche au soleil, une main sur le guidon : la hauteur d'une
    // tuile suit son texte, mais le pavé d'icône, lui, ne dépend de rien et
    // c'est le seul repère quand on ne lit pas.
    await open(tester, 'COMMERCIAL');

    for (final CpiProject project in CpiProject.values) {
      final Finder glyph = find.byIcon(project.icon);
      expect(glyph, findsOneWidget, reason: '${project.label} sans icône');
      expect(tester.widget<Icon>(glyph).size, greaterThanOrEqualTo(24));

      final Size pad = tester.getSize(
        find.ancestor(of: glyph, matching: find.byType(Container)).first,
      );
      expect(pad.height, greaterThanOrEqualTo(kCpiMinTouchTarget));
      expect(pad.width, greaterThanOrEqualTo(kCpiMinTouchTarget));
    }

    await unmount(tester);
  });

  testWidgets('entrer dans CHUES change la palette, en sortir la rend', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(primaryAt(tester, find.byType(HubScreen)), const Color(0xFF630210));

    await tester.tap(tile('Projet CHUES'));
    await settle(tester);

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(
      primaryAt(tester, find.byType(HomeScreen)),
      const Color(0xFF0B2E6F),
      reason: 'la coque CHUES porte le bleu de l\'Union des Enseignants',
    );

    await tester.tap(find.byTooltip('Projets'));
    await settle(tester);

    expect(find.byType(HubScreen), findsOneWidget);
    expect(
      primaryAt(tester, find.byType(HubScreen)),
      const Color(0xFF630210),
      reason: 'le hub reprend le bordeaux CPI dès qu\'on quitte la coque',
    );

    await unmount(tester);
  });

  testWidgets('une tuile hors de portée reste affichée et n\'ouvre rien', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(find.text('Accueil'), findsOneWidget);
    await tester.tap(tile('Registre des visites'));
    await settle(tester);

    expect(find.byType(RegistreScreen), findsNothing);
    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('un compte d\'accueil tient le registre et rien d\'autre', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ACCUEIL');

    await tester.tap(tile('Projet CHUES'));
    await settle(tester);
    expect(find.byType(HomeScreen), findsNothing);
    expect(find.byType(HubScreen), findsOneWidget);

    await tester.tap(tile('Registre des visites'));
    await settle(tester);
    expect(find.byType(RegistreScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('le Grand Public s\'ouvre sans rien promettre de faux', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    await tester.tap(tile('Projet Grand Public'));
    await settle(tester);

    expect(find.byType(GrandPublicScreen), findsOneWidget);
    expect(find.textContaining('n\'est pas encore ouvert'), findsOneWidget);

    // La fleche de retour part d'une pile vide : `popOrHome` doit retomber sur
    // le hub, et non se redemander son avis jusqu'a figer l'isolat.
    await tester.tap(find.byTooltip('Retour'));
    await settle(tester);
    expect(find.byType(HubScreen), findsOneWidget);

    await tester.tap(tile('Projet Grand Public'));
    await settle(tester);
    await tester.tap(find.text('Revenir aux projets'));
    await settle(tester);
    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });

  group('portée des projets par rôle', () {
    test('le téléconseiller enrôle, il ne tient pas le registre', () {
      expect(CpiProject.chues.isOpenTo('COMMERCIAL'), isTrue);
      expect(CpiProject.grandPublic.isOpenTo('COMMERCIAL'), isTrue);
      expect(CpiProject.accueil.isOpenTo('COMMERCIAL'), isFalse);
    });

    test('le compte d\'accueil ne voit passer aucun enrôlement', () {
      expect(CpiProject.accueil.isOpenTo('ACCUEIL'), isTrue);
      expect(CpiProject.chues.isOpenTo('ACCUEIL'), isFalse);
      expect(CpiProject.grandPublic.isOpenTo('ACCUEIL'), isFalse);
    });

    test('la direction et l\'administration passent partout', () {
      for (final String role in <String>['ADMIN', 'DIRECTION']) {
        for (final CpiProject project in CpiProject.values) {
          expect(project.isOpenTo(role), isTrue, reason: '$role sur $project');
        }
      }
    });

    test('un rôle que cette version ignore garde la coque historique', () {
      // Un rôle ajouté côté serveur arrive en `unknownDefaultOpenApi`. Le
      // verrouiller partout condamnerait un téléphone hors réseau, qui n'a
      // aucun moyen d'apprendre ce que ce rôle vaut.
      expect(CpiProject.chues.isOpenTo('RESPONSABLE_ZONE'), isTrue);
      expect(CpiProject.chues.isOpenTo(null), isTrue);
      expect(CpiProject.accueil.isOpenTo('RESPONSABLE_ZONE'), isFalse);
      expect(CpiProject.grandPublic.isOpenTo('RESPONSABLE_ZONE'), isFalse);
    });

    test('la casse du rôle vient du serveur, pas de nous', () {
      expect(CpiProject.chues.isOpenTo('commercial'), isTrue);
    });
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _SignedInController extends AuthController {
  _SignedInController(this.role);

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
