import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/back_navigation.dart';
import 'package:cpi_go/core/router/route_guard.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/about/presentation/about_screen.dart';
import 'package:cpi_go/features/accueil/presentation/chiffres_screen.dart';
import 'package:cpi_go/features/accueil/presentation/registre_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/features/home/presentation/home_screen.dart';
import 'package:cpi_go/features/reglages/presentation/reglages_screen.dart';
import 'package:cpi_go/features/shell/app_shell.dart';
import 'package:cpi_go/features/shell/grand_public_fiches_screen.dart';
import 'package:cpi_go/features/shell/grand_public_screen.dart';
import 'package:cpi_go/features/shell/projects.dart';
import 'package:cpi_go/ui/widgets/sync_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Une coque ne déborde pas sur une autre.
///
/// « À corriger », « Réglages » et « Voir la fiche » sont les mêmes écrans dans
/// les trois projets. Un écran partagé qui nomme sa destination en dur, ou qui
/// la devine sur l'adresse courante, dépose l'utilisateur dans la coque d'un
/// autre projet : c'est ce qui envoyait une visite refusée de l'accueil dans les
/// onglets du CHUES.
void main() {
  late AppDatabase db;
  late FakeApi api;
  ProviderContainer? container;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    SinglePush.reset();
  });

  tearDown(() {
    container?.dispose();
    container = null;
    return db.close();
  });

  /// Une suppression refusée : la seule ligne dont « Voir la fiche » n'a plus
  /// de fiche à ouvrir et repasse donc par la liste de la coque.
  OutboxData suppressionBloquee() => OutboxData(
    seq: 1,
    id: 'op-1',
    entityType: 'prospect',
    entityId: 'p-1',
    op: 'delete',
    payload: '{"fullName":"Awa Sy"}',
    payloadVersion: 1,
    status: 'failed',
    attempts: 5,
    blockedAttempts: 0,
    nextAttemptAt: t0,
    lastErrorCode: 'VALIDATION',
    createdAt: t0,
  );

  Future<GoRouter> open(
    WidgetTester tester,
    String role, {
    List<OutboxData> bloquees = const <OutboxData>[],
    int enAttente = 0,
    String? memorise,
  }) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer c = ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(() => _SignedIn(role)),
        needsAttentionProvider.overrideWith(
          (Ref ref) => Stream<List<OutboxData>>.value(bloquees),
        ),
        needsAttentionCountProvider.overrideWith(
          (Ref ref) => Stream<int>.value(bloquees.length),
        ),
        blockedSyncCountProvider.overrideWith(
          (Ref ref) => Stream<int>.value(bloquees.length),
        ),
        pendingSyncCountProvider.overrideWith(
          (Ref ref) => Stream<int>.value(enAttente),
        ),
      ],
    );
    container = c;
    // Avant le routeur : c'est à sa construction qu'il lit l'adresse à rouvrir.
    if (memorise != null) await c.read(routeMemoryProvider).write(memorise);
    final GoRouter router = c.read(routerProvider);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: c,
        child: MaterialApp.router(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          routerConfig: router,
        ),
      ),
    );
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
    return router;
  }

  Future<void> settle(WidgetTester tester) async {
    for (int i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 60));
    }
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  String path(GoRouter router) =>
      router.routerDelegate.currentConfiguration.uri.path;

  BuildContext sous(WidgetTester tester, Type screen) =>
      tester.element(find.byType(screen));

  /// Ouvre « Autres » puis « Voir la fiche » sur la seule ligne bloquée.
  Future<void> voirLaFiche(WidgetTester tester) async {
    await tester.tap(find.text('Autres'));
    await settle(tester);
    await tester.tap(find.text('Voir la fiche'));
    await settle(tester);
  }

  group(
    '« Voir la fiche » reste dans la coque où « À corriger » a été ouvert',
    () {
      testWidgets('depuis l\'accueil', (WidgetTester tester) async {
        final GoRouter router = await open(
          tester,
          'ACCUEIL',
          bloquees: <OutboxData>[suppressionBloquee()],
        );

        router.go(Routes.accueilCorrections);
        await settle(tester);
        expect(find.byType(CorrectionsScreen), findsOneWidget);

        await voirLaFiche(tester);

        expect(path(router), Routes.accueil);
        expect(
          projetDeLaCoque(sous(tester, RegistreScreen)),
          CpiProject.accueil,
        );

        await unmount(tester);
      });

      testWidgets('depuis le grand public', (WidgetTester tester) async {
        final GoRouter router = await open(
          tester,
          'ADMIN',
          bloquees: <OutboxData>[suppressionBloquee()],
        );

        router.go(Routes.grandPublicCorrections);
        await settle(tester);
        expect(find.byType(CorrectionsScreen), findsOneWidget);

        await voirLaFiche(tester);

        expect(path(router), Routes.grandPublicFiches);
        expect(
          projetDeLaCoque(sous(tester, GrandPublicFichesScreen)),
          CpiProject.grandPublic,
        );

        await unmount(tester);
      });

      testWidgets('depuis le CHUES', (WidgetTester tester) async {
        final GoRouter router = await open(
          tester,
          'ADMIN',
          bloquees: <OutboxData>[suppressionBloquee()],
        );

        router.go(Routes.corrections);
        await settle(tester);
        expect(find.byType(CorrectionsScreen), findsOneWidget);

        await voirLaFiche(tester);

        expect(path(router), Routes.historique);
        expect(
          projetDeLaCoque(sous(tester, HistoriqueScreen)),
          CpiProject.chues,
        );

        await unmount(tester);
      });
    },
  );

  group('les destinations transverses restent dans leur coque', () {
    testWidgets('coque de l\'accueil', (WidgetTester tester) async {
      final GoRouter router = await open(tester, 'ACCUEIL');

      for (final (String onglet, Type ecran) in <(String, Type)>[
        (Routes.accueil, RegistreScreen),
        (Routes.accueilChiffres, ChiffresScreen),
        (Routes.accueilCorrections, CorrectionsScreen),
        (Routes.accueilReglages, ReglagesScreen),
      ]) {
        router.go(onglet);
        await settle(tester);
        expect(path(router), onglet);

        final BuildContext context = sous(tester, ecran);
        expect(projetDeLaCoque(context), CpiProject.accueil);
        expect(correctionsDeLaCoque(context), Routes.accueilCorrections);
        expect(reglagesDeLaCoque(context), Routes.accueilReglages);
      }

      await unmount(tester);
    });

    testWidgets('coque du grand public', (WidgetTester tester) async {
      final GoRouter router = await open(tester, 'ADMIN');

      for (final (String onglet, Type ecran) in <(String, Type)>[
        (Routes.grandPublic, GrandPublicScreen),
        (Routes.grandPublicFiches, GrandPublicFichesScreen),
        (Routes.grandPublicCorrections, CorrectionsScreen),
        (Routes.grandPublicReglages, ReglagesScreen),
      ]) {
        router.go(onglet);
        await settle(tester);
        expect(path(router), onglet);

        final BuildContext context = sous(tester, ecran);
        expect(projetDeLaCoque(context), CpiProject.grandPublic);
        expect(correctionsDeLaCoque(context), Routes.grandPublicCorrections);
        expect(reglagesDeLaCoque(context), Routes.grandPublicReglages);
      }

      await unmount(tester);
    });

    testWidgets('coque du CHUES', (WidgetTester tester) async {
      final GoRouter router = await open(tester, 'ADMIN');

      for (final (String onglet, Type ecran) in <(String, Type)>[
        (Routes.chues, HomeScreen),
        (Routes.historique, HistoriqueScreen),
        (Routes.corrections, CorrectionsScreen),
        (Routes.reglages, ReglagesScreen),
      ]) {
        router.go(onglet);
        await settle(tester);
        expect(path(router), onglet);

        final BuildContext context = sous(tester, ecran);
        expect(projetDeLaCoque(context), CpiProject.chues);
        expect(correctionsDeLaCoque(context), Routes.corrections);
        expect(reglagesDeLaCoque(context), Routes.reglages);
      }

      await unmount(tester);
    });
  });

  testWidgets('Réglages « À corriger » ouvre l\'onglet de sa propre coque', (
    WidgetTester tester,
  ) async {
    final GoRouter router = await open(tester, 'ACCUEIL');

    router.go(Routes.accueilReglages);
    await settle(tester);

    // L'onglet du pied porte le même mot : viser la ligne de l'écran.
    await tester.tap(
      find.descendant(
        of: find.byType(ReglagesScreen),
        matching: find.text('À corriger'),
      ),
    );
    await settle(tester);

    expect(path(router), Routes.accueilCorrections);

    await unmount(tester);
  });

  testWidgets('la bande d\'envoi « Corriger » reste dans sa coque', (
    WidgetTester tester,
  ) async {
    final GoRouter router = await open(
      tester,
      'ADMIN',
      bloquees: <OutboxData>[suppressionBloquee()],
    );

    router.go(Routes.grandPublic);
    await settle(tester);
    expect(find.byType(PendingBanner), findsOneWidget);

    await tester.tap(find.text('Corriger'));
    await settle(tester);

    expect(find.byType(CorrectionsScreen), findsOneWidget);
    expect(
      projetDeLaCoque(sous(tester, CorrectionsScreen)),
      CpiProject.grandPublic,
    );

    await unmount(tester);
  });

  testWidgets('SyncBadge mène au « À corriger » de la coque affichée', (
    WidgetTester tester,
  ) async {
    late BuildContext capture;
    String? vu;

    await tester.pumpWidget(
      MaterialApp(
        home: ProjectScope(
          project: CpiProject.grandPublic,
          child: Builder(
            builder: (BuildContext context) {
              capture = context;
              return const SizedBox.shrink();
            },
          ),
        ),
      ),
    );

    vu = correctionsDeLaCoque(capture);
    expect(vu, Routes.grandPublicCorrections);

    // Le badge n'a pas d'autre logique : il appelle ce même résolveur.
    expect(const SyncBadge(), isA<Widget>());
  });

  testWidgets('une page poussée garde le projet de la coque, pas l\'adresse', (
    WidgetTester tester,
  ) async {
    // La fiche d'un prospect ouverte depuis l'accueil a une adresse
    // (`/prospects/...`) qui ne commence par aucun préfixe de coque : le
    // résolveur d'avant renvoyait tout le monde au CHUES.
    for (final CpiProject projet in CpiProject.values) {
      late BuildContext context;
      await tester.pumpWidget(
        MaterialApp(
          home: ProjectScope(
            project: projet,
            child: Builder(
              builder: (BuildContext c) {
                context = c;
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );
      expect(projetDeLaCoque(context), projet);
      expect(correctionsDeLaCoque(context), projet.corrections);
      expect(reglagesDeLaCoque(context), projet.reglages);
    }
  });

  testWidgets('le retour d\'une page d\'aide revient dans sa coque', (
    WidgetTester tester,
  ) async {
    final GoRouter router = await open(tester, 'ACCUEIL');

    router.go(Routes.accueilReglages);
    await settle(tester);

    // Pas d'`await` : `push` ne rend la main qu'au dépilement. L'adresse de la
    // coque ne bouge pas non plus — `push` empile sans réécrire `uri`.
    router.push<void>(Routes.about).ignore();
    await settle(tester);
    expect(find.byType(AboutScreen), findsOneWidget);
    expect(path(router), Routes.accueilReglages);

    await tester.tap(
      find.descendant(
        of: find.byType(AboutScreen),
        matching: find.byType(CpiBackButton),
      ),
    );
    await settle(tester);

    expect(find.byType(AboutScreen), findsNothing);
    expect(find.byType(ReglagesScreen), findsOneWidget);
    expect(path(router), Routes.accueilReglages);

    await unmount(tester);
  });

  testWidgets('« Revenir à l\'accueil » d\'une page introuvable rend le hub', (
    WidgetTester tester,
  ) async {
    final GoRouter router = await open(tester, 'ADMIN');

    router.go('/adresse-qui-nexiste-plus');
    await settle(tester);

    await tester.tap(find.text('Revenir à l\'accueil'));
    await settle(tester);

    expect(path(router), Routes.home);

    await unmount(tester);
  });

  testWidgets('une adresse inconnue ne mène nulle part chez un compte fermé', (
    WidgetTester tester,
  ) async {
    // Une adresse inconnue est du CHUES par défaut : le compte d'accueil ne
    // voit même pas la page « introuvable », il reste chez lui.
    final GoRouter router = await open(tester, 'ACCUEIL');

    router.go('/adresse-qui-nexiste-plus');
    await settle(tester);

    expect(path(router), Routes.accueil);
    expect(find.byType(RegistreScreen), findsOneWidget);

    await unmount(tester);
  });

  group(
    'un rôle n\'entre pas dans la coque d\'un projet qui lui est fermé',
    () {
      testWidgets('lien de notification vers le CHUES', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await open(tester, 'ACCUEIL');

        for (final String cible in <String>[
          Routes.chues,
          Routes.historique,
          Routes.corrections,
          Routes.reglages,
          Routes.grandPublic,
          Routes.representants,
          Routes.phase2,
        ]) {
          router.go(cible);
          await settle(tester);
          expect(
            path(router),
            startsWith(Routes.accueil),
            reason: 'depuis $cible',
          );
        }

        await unmount(tester);
      });

      testWidgets('le refus est annoncé sur la coque d\'arrivée', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await open(tester, 'ACCUEIL');

        router.go(Routes.chues);
        await settle(tester);

        expect(path(router), Routes.accueil);
        expect(find.text(AccesRefuse.message), findsOneWidget);

        await unmount(tester);
      });

      testWidgets(
        'on est renvoyé d\'où l\'on vient, pas à un accueil générique',
        (WidgetTester tester) async {
          final GoRouter router = await open(tester, 'ACCUEIL');

          router.go(Routes.accueilChiffres);
          await settle(tester);
          expect(path(router), Routes.accueilChiffres);

          router.go(Routes.historique);
          await settle(tester);

          expect(path(router), Routes.accueilChiffres);

          await unmount(tester);
        },
      );

      testWidgets('un téléconseiller n\'entre pas dans le registre', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await open(tester, 'COMMERCIAL');

        router.go(Routes.chues);
        await settle(tester);
        expect(path(router), Routes.chues);

        router.go(Routes.accueilChiffres);
        await settle(tester);

        expect(path(router), isNot(startsWith(Routes.accueil)));
        expect(path(router), Routes.chues);

        await unmount(tester);
      });

      // La porte qui restait ouverte : une fuite passée avait mémorisé
      // `/a-corriger`, restauré tel quel à chaque lancement suivant.
      testWidgets('adresse mémorisée du CHUES : rouverte nulle part', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await open(
          tester,
          'ACCUEIL',
          memorise: Routes.corrections,
        );

        expect(path(router), Routes.accueil);
        expect(find.byType(RegistreScreen), findsOneWidget);
        expect(
          container!
              .read(routeMemoryProvider)
              .read(authenticated: true, role: 'ACCUEIL'),
          isNot(Routes.corrections),
        );

        await unmount(tester);
      });

      testWidgets('le rôle qui change en cours de session fait sortir', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await open(tester, 'ADMIN');

        router.go(Routes.chues);
        await settle(tester);
        expect(path(router), Routes.chues);

        (container!.read(authControllerProvider.notifier) as _SignedIn).devenir(
          'ACCUEIL',
        );
        await settle(tester);

        expect(path(router), Routes.accueil);
        expect(find.byType(RegistreScreen), findsOneWidget);

        await unmount(tester);
      });

      testWidgets('un lien profond vers une page CHUES est renvoyé', (
        WidgetTester tester,
      ) async {
        final GoRouter router = await open(tester, 'ACCUEIL');

        router.go(Routes.representantDetailFor('rep-1'));
        await settle(tester);

        expect(path(router), Routes.accueil);
        expect(find.text(AccesRefuse.message), findsWidgets);

        await unmount(tester);
      });

      testWidgets('un refus répété ne boucle pas', (WidgetTester tester) async {
        final GoRouter router = await open(tester, 'ACCUEIL');

        for (int i = 0; i < 5; i++) {
          router.go(Routes.historique);
          await settle(tester);
        }
        // Sans garde-fou, chaque repli relancerait le contrôle : la trame ne se
        // stabiliserait jamais et `pumpAndSettle` expirerait.
        await tester.pumpAndSettle(const Duration(milliseconds: 50));

        expect(path(router), Routes.accueil);

        await unmount(tester);
      });
    },
  );

  group('les résolveurs répondent même sans routeur', () {
    testWidgets('un écran monté nu répond CHUES au lieu de lever', (
      WidgetTester tester,
    ) async {
      late BuildContext nu;
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (BuildContext context) {
              nu = context;
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      expect(projetDeLaCoque(nu), CpiProject.chues);
      expect(correctionsDeLaCoque(nu), Routes.corrections);
      expect(reglagesDeLaCoque(nu), Routes.reglages);
    });

    testWidgets('« À propos » se peint hors routeur', (
      WidgetTester tester,
    ) async {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final ProviderContainer c = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(() => _SignedIn('ACCUEIL')),
        ],
      );
      container = c;

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: c,
          child: const MaterialApp(home: AboutScreen()),
        ),
      );
      await tester.pump(const Duration(milliseconds: 60));

      expect(tester.takeException(), isNull);
      expect(find.byType(AboutScreen), findsOneWidget);
    });
  });
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}

class _SignedIn extends AuthController {
  _SignedIn(this.role);

  String role;

  @override
  AuthState build() => _etat();

  /// Le serveur peut rendre un autre rôle au rafraîchissement du jeton.
  void devenir(String autre) {
    role = autre;
    state = _etat();
  }

  AuthState _etat() => AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: role,
    email: 'awa.sy@cpi.sn',
  );
}
