import 'dart:async';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/app_router.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/representant/presentation/representant_detail_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_form_screen.dart';
import 'package:cpi_go/features/representant/presentation/representant_picker_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// La fiche d'un représentant, et les deux chemins qui y mènent.
///
/// `Routes.representantDetail` et `representantDetailFor` existaient sans
/// appelant ni `GoRoute` : la route était nommée et n'existait pas. Un test qui
/// se contenterait de construire l'écran à la main ne l'aurait jamais vu, d'où
/// le montage du VRAI routeur ici.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    SinglePush.reset();
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  /// Démonte l'arbre avant la fin : les `StreamProvider` de drift programment
  /// un minuteur de durée nulle à leur disposition.
  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  Future<ProviderContainer> makeContainer(
    WidgetTester tester, {
    WriteRepository? writes,
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = ProviderContainer(
      overrides: [
        if (writes != null) writeRepositoryProvider.overrideWithValue(writes),
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authControllerProvider.overrideWith(_SignedInController.new),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('la route existe', () {
    Future<GoRouter> mountApp(WidgetTester tester) async {
      final ProviderContainer container = await makeContainer(tester);
      final GoRouter router = container.read(routerProvider);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            routerConfig: router,
          ),
        ),
      );
      await tester.pump();
      return router;
    }

    testWidgets('/representants/<id> ouvre la fiche', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );

      final GoRouter router = await mountApp(tester);
      unawaited(router.push(Routes.representantDetailFor('rep-1')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.byType(RepresentantDetailScreen), findsOneWidget);
      expect(find.text('Page introuvable'), findsNothing);
      expect(find.text('Ousmane Fall'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('/representants/nouveau reste le formulaire', (
      WidgetTester tester,
    ) async {
      // `:id` avalerait `nouveau` si la route de détail était déclarée avant :
      // créer un représentant ouvrirait une fiche vide au lieu du formulaire.
      final GoRouter router = await mountApp(tester);
      unawaited(router.push(Routes.newRepresentant));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.byType(RepresentantFormScreen), findsOneWidget);
      expect(find.byType(RepresentantDetailScreen), findsNothing);

      await teardownTree(tester);
    });
  });

  testWidgets('la fiche liste les prospects de CE représentant', (
    WidgetTester tester,
  ) async {
    // Même raison que `mountFiche` du fil : la liste est en bas d'un `ListView`,
    // qui ne construit pas ce qui est hors du viewport. Sur les 600 dp par
    // défaut, la ligne WhatsApp suffit à la repousser dehors.
    tester.view.physicalSize = const Size(1200, 6000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await insertRepresentant(db, id: 'rep-2', phone: '+221770000002');
    await insertProspect(
      db,
      id: 'pro-1',
      representantId: 'rep-1',
      phone: '+221780000001',
    );
    await insertProspect(
      db,
      id: 'pro-2',
      representantId: 'rep-2',
      phone: '+221780000002',
    );

    final ProviderContainer container = await makeContainer(tester);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const RepresentantDetailScreen(representantId: 'rep-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.textContaining('+221 78 000 00 01'), findsOneWidget);
    expect(find.textContaining('+221 78 000 00 02'), findsNothing);
    expect(
      find.text('Aucun prospect. Utilisez « Nouveau prospect » pour en saisir un.'),
      findsNothing,
    );

    await teardownTree(tester);
  });

  // Lecture seule : le contrat de synchronisation n'a pas de chemin d'écriture
  // mobile pour la relation. La fiche l'affiche, elle ne la modifie pas.
  testWidgets('la fiche montre la relation venue du serveur', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      relationStatus: 'AMBASSADEUR',
    );

    final ProviderContainer container = await makeContainer(tester);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const RepresentantDetailScreen(representantId: 'rep-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Ambassadeur'), findsOneWidget);

    await teardownTree(tester);
  });

  // `enumUnknownDefaultCase` laisse passer une valeur que ce client ne connaît
  // pas : l'afficher telle quelle vaut mieux que la faire disparaître.
  testWidgets('une relation inconnue de ce client s\'affiche quand même', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      relationStatus: 'PARRAIN',
    );

    final ProviderContainer container = await makeContainer(tester);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const RepresentantDetailScreen(representantId: 'rep-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('PARRAIN'), findsOneWidget);

    await teardownTree(tester);
  });

  group('WhatsApp et profession', () {
    Future<void> mountFiche(WidgetTester tester) async {
      final ProviderContainer container = await makeContainer(tester);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: const RepresentantDetailScreen(representantId: 'rep-1'),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }

    // Sur 12 929 fiches, c'est cette différence qui décide de qui on rappelle :
    // une question jamais posée n'est pas une absence constatée.
    testWidgets('« non demandé » ne s\'affiche pas comme « aucun »', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
      await mountFiche(tester);

      expect(find.text('Non demandé'), findsOneWidget);
      expect(find.text('Pas de WhatsApp'), findsNothing);

      await teardownTree(tester);
    });

    testWidgets('« aucun » est une absence constatée, et le dit', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        whatsappStatus: 'AUCUN',
      );
      await mountFiche(tester);

      expect(find.text('Pas de WhatsApp'), findsOneWidget);
      expect(find.text('Non demandé'), findsNothing);

      await teardownTree(tester);
    });

    // Le numéro n'est stocké qu'une fois : la fiche dit le lien, pas une copie
    // qui divergerait du téléphone à la première correction.
    testWidgets('« même numéro » ne réaffiche pas un second numéro', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        whatsappStatus: 'MEME_NUMERO',
      );
      await mountFiche(tester);

      expect(find.text('Même numéro'), findsOneWidget);
      expect(find.text('+221 77 000 00 01'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un autre numéro s\'affiche et se copie', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        whatsappStatus: 'AUTRE_NUMERO',
        whatsappE164: '+221781112233',
        profession: 'Directeur d\'école',
      );
      await mountFiche(tester);

      expect(find.text('+221 78 111 22 33'), findsOneWidget);
      expect(find.text('Directeur d\'école'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un état inconnu de ce client s\'affiche quand même', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        whatsappStatus: 'NUMERO_PROFESSIONNEL',
      );
      await mountFiche(tester);

      expect(find.text('NUMERO_PROFESSIONNEL'), findsOneWidget);

      await teardownTree(tester);
    });
  });

  group('fil de commentaires', () {
    /// Surface haute : le fil est en bas d'un `ListView`, et un `ListView` ne
    /// construit pas ce qui est hors du viewport. Sur les 600 dp par défaut,
    /// les assertions ne portaient sur rien.
    Future<void> mountFiche(WidgetTester tester, {WriteRepository? writes}) async {
      tester.view.physicalSize = const Size(1200, 6000);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final ProviderContainer container = await makeContainer(tester, writes: writes);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            home: const RepresentantDetailScreen(representantId: 'rep-1'),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }

    setUp(() => insertRepresentant(db, id: 'rep-1', phone: '+221770000001'));

    testWidgets('chaque entrée porte son auteur', (WidgetTester tester) async {
      await insertComment(
        db,
        id: 'c-1',
        representantId: 'rep-1',
        body: 'Injoignable le matin.',
        authorName: 'Modou Fall',
      );
      await mountFiche(tester);

      expect(find.text('Injoignable le matin.'), findsOneWidget);
      expect(find.textContaining('Modou Fall'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('le fil ne montre que celui de CETTE fiche', (WidgetTester tester) async {
      await insertRepresentant(db, id: 'rep-2', phone: '+221770000002');
      await insertComment(
        db,
        id: 'c-1',
        representantId: 'rep-1',
        body: 'Pour la première fiche.',
      );
      await insertComment(
        db,
        id: 'c-2',
        representantId: 'rep-2',
        body: 'Pour la seconde fiche.',
      );
      await mountFiche(tester);

      expect(find.text('Pour la première fiche.'), findsOneWidget);
      expect(find.text('Pour la seconde fiche.'), findsNothing);

      await teardownTree(tester);
    });

    // Le commentaire est le seul champ du produit où la saisie libre est
    // légitime ; elle n'est pour autant jamais obligatoire.
    testWidgets('publier écrit la ligne et vide le champ', (WidgetTester tester) async {
      await mountFiche(tester);

      await tester.enterText(find.byType(TextField), '  Passe par le secrétariat.  ');
      await tester.pump();
      await tester.ensureVisible(find.text('Publier'));
      await tester.pump();
      await tester.tap(find.text('Publier'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      final List<RepresentantComment> fil = await db
          .select(db.representantComments)
          .get();
      expect(fil.single.body, 'Passe par le secrétariat.');
      expect(fil.single.representantId, 'rep-1');
      expect(fil.single.authorId, 'me');
      expect(fil.single.authorName, 'Awa Sy');
      expect(tester.widget<TextField>(find.byType(TextField)).controller?.text, isEmpty);

      await teardownTree(tester);
    });

    // L'écriture partait en arrière-plan depuis `onPressed` : une base qui la
    // refuse vidait l'erreur dans la zone, le champ se vidait, et le
    // téléconseiller repartait en croyant avoir publié.
    testWidgets('une publication qui échoue le dit et garde le texte', (
      WidgetTester tester,
    ) async {
      await mountFiche(tester, writes: _BrokenWrites(db));

      await tester.enterText(find.byType(TextField), 'Passe par le secrétariat.');
      await tester.pump();
      await tester.ensureVisible(find.text('Publier'));
      await tester.pump();
      await tester.tap(find.text('Publier'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.textContaining('Commentaire non enregistré'), findsOneWidget);
      expect(
        tester.widget<TextField>(find.byType(TextField)).controller?.text,
        'Passe par le secrétariat.',
      );

      await teardownTree(tester);
    });

    testWidgets('rien à publier tant que rien n\'est saisi', (WidgetTester tester) async {
      await mountFiche(tester);

      expect(
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Publier')).enabled,
        isFalse,
      );

      await tester.enterText(find.byType(TextField), '   ');
      await tester.pump();
      expect(
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Publier')).enabled,
        isFalse,
        reason: 'des espaces ne sont pas un commentaire',
      );

      await tester.enterText(find.byType(TextField), 'Un mot.');
      await tester.pump();
      expect(
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Publier')).enabled,
        isTrue,
      );

      await teardownTree(tester);
    });
  });

  group('sélecteur', () {
    Future<void> mountPicker(WidgetTester tester) async {
      final ProviderContainer container = await makeContainer(tester);
      final GoRouter router = GoRouter(
        initialLocation: Routes.representants,
        routes: <RouteBase>[
          GoRoute(
            path: Routes.representants,
            builder: (BuildContext context, GoRouterState state) =>
                const RepresentantPickerScreen(),
          ),
          GoRoute(
            path: Routes.newProspect,
            builder: (BuildContext context, GoRouterState state) => Scaffold(
              body: Center(
                child: Text(
                  'SAISIE PROSPECT ${state.uri.queryParameters[Routes.repParam]}',
                ),
              ),
            ),
          ),
          GoRoute(
            path: Routes.newRepresentant,
            builder: (BuildContext context, GoRouterState state) => Scaffold(
              body: Center(
                child: Text('FORMULAIRE ${state.uri.queryParameters['id']}'),
              ),
            ),
          ),
          GoRoute(
            path: Routes.representantDetail,
            builder: (BuildContext context, GoRouterState state) => Scaffold(
              body: Center(child: Text('FICHE ${state.pathParameters['id']}')),
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('fr'),
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            supportedLocales: const <Locale>[Locale('fr')],
            routerConfig: router,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
    }

    testWidgets('le tap sur la ligne ouvre le formulaire de ce représentant', (
      WidgetTester tester,
    ) async {
      // Les fiches sont importées : le geste courant est de CHOISIR puis de
      // compléter. Sauter le formulaire pour tomber sur les prospects retirait
      // le seul endroit où corriger un numéro ou poser une profession.
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await mountPicker(tester);

      await tester.tap(find.text('Ousmane Fall'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('FORMULAIRE rep-1'), findsOneWidget);
      expect(find.text('SAISIE PROSPECT rep-1'), findsNothing);

      await teardownTree(tester);
    });

    testWidgets('un bouton distinct ouvre la fiche', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await mountPicker(tester);

      await tester.tap(find.byTooltip('Ouvrir la fiche'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('FICHE rep-1'), findsOneWidget);

      await teardownTree(tester);
    });

    testWidgets('un appui long ouvre la fiche aussi', (WidgetTester tester) async {
      await insertRepresentant(
        db,
        id: 'rep-1',
        phone: '+221770000001',
        fullName: 'Ousmane Fall',
      );
      await mountPicker(tester);

      await tester.longPress(find.text('Ousmane Fall'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.text('FICHE rep-1'), findsOneWidget);

      await teardownTree(tester);
    });
  });
}

/// Une base qui refuse l'écriture du commentaire.
class _BrokenWrites extends WriteRepository {
  _BrokenWrites(super.db);

  @override
  Future<String> addRepresentantComment({
    required String representantId,
    required String body,
    required String authorId,
    required String authorName,
  }) => Future<String>.error(StateError('base en lecture seule'));
}

class _SignedInController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'me',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
  );
}

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
