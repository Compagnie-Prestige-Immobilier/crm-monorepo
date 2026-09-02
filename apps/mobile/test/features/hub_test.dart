import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/prospect/presentation/prospect_entry_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_form_screen.dart';
import 'package:cpi_go/features/shell/grand_public_screen.dart';
import 'package:cpi_go/features/shell/hub_screen.dart';
import 'package:cpi_go/features/shell/projects.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
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
/// une tuile hors de portée du rôle n'est PAS affichée (une porte grisée ne
/// disait rien d'utile, elle encombrait), et entrer dans une coque change la
/// palette, en sortir la rend. Une coque qui garde la palette de la
/// précédente, c'est un téléconseiller qui ne sait plus dans quel projet il
/// saisit.
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

  /// Les tuiles sont les seules cartes du hub.
  final Finder hubTiles = find.descendant(
    of: find.byType(HubScreen),
    matching: find.byType(CpiCard),
  );

  /// Trois grandes cartes ne tiennent pas sur 780 dp : le hub défile, et un
  /// compte qui ouvre les trois projets descend pour voir le dernier.
  Future<void> reveal(WidgetTester tester, String label) async {
    if (tile(label).evaluate().isNotEmpty) return;
    await tester.dragUntilVisible(
      tile(label),
      find
          .descendant(
            of: find.byType(HubScreen),
            matching: find.byType(Scrollable),
          )
          .first,
      const Offset(0, -160),
    );
    await settle(tester);
  }

  Color primaryAt(WidgetTester tester, Finder screen) =>
      Theme.of(tester.element(screen)).colorScheme.primary;

  /// Les boutons d'en-tête sont des `FButton.icon` : ForUI n'a pas d'infobulle
  /// Material, donc `byTooltip` ne peut plus les atteindre. Leur nom accessible
  /// reste le même, et sert ici de clé.
  Finder action(String label) => find.byKey(Key(label));

  /// La pastille d'en-tête nomme le projet courant et ouvre la liste des
  /// autres : revenir au hub demande donc deux gestes, tous deux nommés.
  Future<void> retourAuxProjets(WidgetTester tester) async {
    await tester.tap(action('Projets'));
    await settle(tester);
    await tester.tap(find.text('Tous les projets'));
    await settle(tester);
  }

  testWidgets('un compte connecté n\'a que les tuiles de son rôle', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(find.byType(HubScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);
    // Deux tuiles pour le téléconseiller : le registre de l'accueil n'est pas
    // son poste, et une tuile qui n'ouvre rien est une porte peinte sur un mur.
    expect(hubTiles, findsNWidgets(2));
    expect(find.text('Projet CHUES'), findsOneWidget);
    expect(find.text('Projet Grand Public'), findsOneWidget);
    expect(find.text('Accueil'), findsNothing);

    await unmount(tester);
  });

  testWidgets('l\'administration voit les trois projets', (
    WidgetTester tester,
  ) async {
    await open(tester, 'ADMIN');

    for (final CpiProject project in CpiProject.values) {
      await reveal(tester, project.label);
      expect(
        tile(project.label),
        findsOneWidget,
        reason: '${project.label} manque au hub de l\'administration',
      );
    }

    await unmount(tester);
  });

  testWidgets('chaque projet montre son logo dans une carte large', (
    WidgetTester tester,
  ) async {
    // Le hub se touche au soleil, une main sur le guidon : c'est le logo qu'on
    // reconnaît avant de lire, et la carte doit rester une cible large même
    // quand le texte, lui, est court.
    await open(tester, 'ADMIN');

    const Map<CpiProject, String> logos = <CpiProject, String>{
      CpiProject.accueil: 'assets/brand/cpi-logo.png',
      CpiProject.chues: 'assets/brand/chues-logo.png',
      CpiProject.grandPublic: 'assets/brand/cpi-logo.png',
    };
    // Ce qu'on vient y faire, en mots, sous le nom du projet.
    const Map<CpiProject, String> gestes = <CpiProject, String>{
      CpiProject.accueil: 'Inscrire les visiteurs',
      CpiProject.chues: 'Appeler, qualifier, enrôler',
      CpiProject.grandPublic: 'Prospects et appels du jour',
    };

    for (final CpiProject project in CpiProject.values) {
      await reveal(tester, project.label);
      final Finder carte = find
          .ancestor(of: tile(project.label), matching: find.byType(CpiCard))
          .first;
      expect(
        tester.getSize(carte).height,
        greaterThanOrEqualTo(140),
        reason: '${project.label} : carte trop basse',
      );

      final Finder logo = find.descendant(
        of: carte,
        matching: find.byType(Image),
      );
      expect(logo, findsOneWidget, reason: '${project.label} sans logo');
      expect(
        (tester.widget<Image>(logo).image as AssetImage).assetName,
        logos[project],
      );
      expect(tester.getSize(logo).height, greaterThanOrEqualTo(48));

      expect(
        find.descendant(of: carte, matching: find.text(project.tagline)),
        findsOneWidget,
      );
      expect(
        find.descendant(of: carte, matching: find.text(gestes[project]!)),
        findsOneWidget,
      );
    }

    await unmount(tester);
  });

  testWidgets('entrer dans CHUES change la palette, en sortir la rend', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    final Color cpi = primaryAt(tester, find.byType(HubScreen));
    expect(cpi, const Color(0xFF630210));

    await tester.tap(tile('Projet CHUES'));
    await settle(tester);

    expect(find.byType(HomeScreen), findsOneWidget);
    // La teinte exacte appartient au thème CHUES : ce qui se vérifie ici, c'est
    // qu'elle n'est pas celle de CPI. Un littéral la figerait dans deux
    // fichiers à la fois.
    expect(
      primaryAt(tester, find.byType(HomeScreen)),
      isNot(cpi),
      reason: 'la coque CHUES porte sa propre couleur',
    );

    await retourAuxProjets(tester);

    expect(find.byType(HubScreen), findsOneWidget);
    expect(
      primaryAt(tester, find.byType(HubScreen)),
      cpi,
      reason: 'le hub reprend le bordeaux CPI dès qu\'on quitte la coque',
    );

    await unmount(tester);
  });

  testWidgets('le geste de départ permet de saisir un représentant', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');
    await tester.tap(tile('Projet CHUES'));
    await settle(tester);

    await tester.tap(find.text('Commencer'));
    await settle(tester);

    expect(find.text('Ajouter un représentant'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Ajouter un représentant')).dy,
      lessThan(tester.getTopLeft(find.text('Ajouter un prospect')).dy),
    );
    await tester.tap(find.text('Ajouter un représentant'));
    await settle(tester);

    expect(find.byType(RepresentantFormScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('une tuile hors de portée n\'est pas affichée du tout', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    expect(tile('Accueil'), findsNothing);
    expect(tile('Registre des visites'), findsNothing);
    expect(find.byType(RegistreScreen), findsNothing);

    await unmount(tester);
  });

  testWidgets('un compte d\'accueil arrive droit sur son registre', (
    WidgetTester tester,
  ) async {
    // Un seul projet ouvert : le hub ne lui demanderait de choisir qu'entre une
    // seule porte. Il n'est plus posé du tout (voir `router_landing_test`).
    await open(tester, 'ACCUEIL');

    expect(find.byType(RegistreScreen), findsOneWidget);
    expect(find.byType(HubScreen), findsNothing);

    await unmount(tester);
  });

  testWidgets('le Grand Public ouvre son travail du jour et revient', (
    WidgetTester tester,
  ) async {
    await open(tester, 'COMMERCIAL');

    await tester.tap(tile('Projet Grand Public'));
    await settle(tester);

    expect(find.byType(GrandPublicScreen), findsOneWidget);
    expect(find.text('Appeler un prospect'), findsOneWidget);
    expect(find.text('Nouveau prospect'), findsOneWidget);

    await tester.tap(find.text('Nouveau prospect'));
    await settle(tester);
    expect(find.byType(ProspectEntryScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Retour'));
    await settle(tester);
    await retourAuxProjets(tester);
    expect(find.byType(HubScreen), findsOneWidget);

    await unmount(tester);
  });

  testWidgets('la pastille d\'en-tête nomme le projet et mène à l\'autre', (
    WidgetTester tester,
  ) async {
    // L'icône « grille » ne disait pas ce qu'elle faisait : la pastille porte
    // le nom du projet courant, et la feuille nomme les destinations.
    await open(tester, 'COMMERCIAL');
    await tester.tap(tile('Projet Grand Public'));
    await settle(tester);

    expect(find.text('Grand Public'), findsOneWidget);

    await tester.tap(action('Projets'));
    await settle(tester);
    expect(find.text('Changer de projet'), findsOneWidget);

    await tester.tap(find.text('Projet CHUES'));
    await settle(tester);
    expect(find.byType(HomeScreen), findsOneWidget);

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

    test('l\'administration passe partout', () {
      for (final CpiProject project in CpiProject.values) {
        expect(project.isOpenTo('ADMIN'), isTrue, reason: 'ADMIN sur $project');
      }
    });

    /// La direction encadre les deux projets d'enrôlement, mais le comptoir
    /// n'est pas son poste : `/sync` lui est fermé côté serveur, donc la tuile
    /// Accueil ne lui donnerait qu'un formulaire sans issue.
    test('la direction encadre les projets, elle ne tient pas le comptoir', () {
      expect(CpiProject.chues.isOpenTo('DIRECTION'), isTrue);
      expect(CpiProject.grandPublic.isOpenTo('DIRECTION'), isTrue);
      expect(CpiProject.accueil.isOpenTo('DIRECTION'), isFalse);
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
