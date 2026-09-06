import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/ui/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// L'écran « Mes fiches ».
///
/// La suppression a quitté cet écran : elle se faisait par balayage, un geste
/// que rien n'annonce et qui retirait la ligne avant que la base ait répondu.
/// Elle vit maintenant dans la feuille « Autres actions » de la fiche ouverte.
/// Ce fichier garde donc les tests de la liste, et prouve qu'aucun geste caché
/// n'y subsiste.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  Future<void> pumpScope(
    WidgetTester tester,
    Widget app, {
    List<Override> extra = const <Override>[],
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(_SignedInController.new),
          ...extra,
        ],
        child: app,
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<void> mount(
    WidgetTester tester, {
    double textScale = 1,
    List<Override> extra = const <Override>[],
  }) async {
    await pumpScope(
      tester,
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: Builder(
          builder: (BuildContext context) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(textScale)),
            child: const HistoriqueScreen(),
          ),
        ),
      ),
      extra: extra,
    );
  }

  /// La liste sous un vrai routeur : ouvrir une fiche est le geste de l'écran.
  Future<void> mountRouted(WidgetTester tester) async {
    final GoRouter router = GoRouter(
      initialLocation: Routes.historique,
      routes: <RouteBase>[
        GoRoute(
          path: Routes.historique,
          builder: (BuildContext context, GoRouterState state) =>
              const HistoriqueScreen(),
        ),
        GoRoute(
          path: Routes.representantDetail,
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            body: Center(child: Text('FICHE ${state.pathParameters['id']}')),
          ),
        ),
        GoRoute(
          path: Routes.representants,
          builder: (BuildContext context, GoRouterState state) =>
              const Scaffold(body: Center(child: Text('CHEZ QUI'))),
        ),
      ],
    );
    addTearDown(router.dispose);
    await pumpScope(
      tester,
      MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        routerConfig: router,
      ),
    );
  }

  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// La liste ne se remplit qu'à la recherche : rien ne s'affiche tant qu'on
  /// n'a pas tapé un nom ou un numéro.
  Future<void> chercher(WidgetTester tester, String terme) async {
    await tester.enterText(find.byType(EditableText), terme);
    await tester.pump(const Duration(milliseconds: 400));
  }

  // La ligne d'un représentant empile trois actions à côté d'un titre et d'un
  // sous-titre : c'est la géométrie qui déborde en premier quand le texte
  // grandit, et l'écran vide du balayage général ne la peint jamais.
  testWidgets('la ligne tient sur 320 dp à 1,76 fois la taille du texte', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(320, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Abdoulaye Ousseynou Kane Diagne',
    );
    await mount(tester, textScale: 1.76);
    await chercher(tester, 'Abdoulaye');

    expect(find.text('Abdoulaye Ousseynou Kane Diagne'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await teardownTree(tester);
  });

  // Le balayage supprimait sans rien annoncer : personne ne le découvrait, et
  // ceux qui le découvraient par accident perdaient une fiche et ses prospects.
  testWidgets('un balayage sur la ligne ne supprime plus rien', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(tester);
    await chercher(tester, 'Ousmane');

    await tester.drag(find.text('Ousmane Fall'), const Offset(-500, 0));
    await tester.pumpAndSettle();

    expect(find.byType(Dismissible), findsNothing);
    expect(find.text('Supprimer'), findsNothing);
    // Le balayage change d'onglet, il ne retire rien : la fiche est toujours là.
    await tester.tap(find.text('Représentants'));
    await tester.pumpAndSettle();
    expect(find.text('Ousmane Fall'), findsOneWidget);

    await teardownTree(tester);
  });

  // L'accordéon demandait deux gestes pour ouvrir une fiche, et cachait trois
  // autres actions derrière le premier.
  testWidgets('un tap sur la ligne ouvre la fiche, sans panneau à déplier', (
    WidgetTester tester,
  ) async {
    SinglePush.reset();
    addTearDown(SinglePush.reset);
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mountRouted(tester);
    await chercher(tester, 'Ousmane');

    expect(find.text('Ouvrir la fiche'), findsNothing);

    await tester.tap(find.text('Ousmane Fall'));
    await tester.pumpAndSettle();

    expect(find.text('FICHE rep-1'), findsOneWidget);

    await teardownTree(tester);
  });

  // L'état ne tenait que dans la couleur d'une icône : personne ne savait ce
  // que voulait dire le petit nuage barré.
  testWidgets('la ligne écrit son état en toutes lettres', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(tester);
    await chercher(tester, 'Ousmane');

    expect(find.text('Pas encore envoyé'), findsOneWidget);
    expect(find.text('1 représentant'), findsOneWidget);

    await teardownTree(tester);
  });

  testWidgets('la ligne porte le statut de qualification et l\'étoile', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.statutsQualification)
        .insert(
          StatutsQualificationCompanion.insert(
            code: 'TRES_INTERESSE',
            id: 'sq-1',
            label: 'Très intéressé',
            effect: 'REACHED',
          ),
        );
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      relationStatus: 'AMBASSADEUR',
      statutQualificationId: 'sq-1',
      serverUpdatedAt: DateTime.utc(2026, 9, 1),
    );
    await mount(tester);
    await chercher(tester, 'Ousmane');

    expect(find.text('Très intéressé'), findsOneWidget);
    expect(find.text('A accepté'), findsNothing);
    expect(find.byIcon(PhosphorIconsFill.star), findsOneWidget);

    await teardownTree(tester);
  });

  // La feuille « Nouvelle fiche » offrait de créer un représentant : la base
  // des représentants est importée depuis le web, le mobile n'en crée plus.
  testWidgets('le bouton du pied mène droit au choix du représentant', (
    WidgetTester tester,
  ) async {
    SinglePush.reset();
    addTearDown(SinglePush.reset);
    await mountRouted(tester);

    expect(find.text('Nouvelle fiche'), findsNothing);

    await tester.tap(find.text('Appeler un représentant').first);
    await tester.pumpAndSettle();

    expect(find.text('CHEZ QUI'), findsOneWidget);
    expect(find.text('Un représentant'), findsNothing);

    await teardownTree(tester);
  });

  // Une exception Dart centrée, sans bouton : le commercial n'a aucun geste.
  testWidgets('une lecture en échec propose de réessayer', (
    WidgetTester tester,
  ) async {
    await mount(
      tester,
      extra: <Override>[
        representantListProvider.overrideWith(
          (Ref ref) => Stream<List<RepresentantSyncViewData>>.error(
            Exception('base illisible'),
          ),
        ),
      ],
    );

    expect(find.textContaining('n\'a pas pu être lue'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
    expect(
      find.textContaining('Lecture impossible :'),
      findsNothing,
      reason: 'l\'exception brute ne se montre plus telle quelle',
    );

    await teardownTree(tester);
  });

  // Le périmètre borne déjà la liste : elle se déroule sans qu'on cherche.
  testWidgets('les fiches se voient sans recherche', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(tester);

    expect(find.byType(CpiEmptyState), findsNothing);
    expect(find.text('Ousmane Fall'), findsOneWidget);

    await teardownTree(tester);
  });

  testWidgets('l\'onglet Prospects liste les prospects CHUES', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(db, id: 'rep-1', phone: '+221770000001');
    await insertProspect(
      db,
      id: 'pros-1',
      representantId: 'rep-1',
      phone: '+221771234567',
      nom: 'Diop',
      prenom: 'Awa',
    );
    await db
        .into(db.prospectJourneys)
        .insert(
          ProspectJourneysCompanion.insert(
            prospectId: 'pros-1',
            projet: 'CHUES',
          ),
        );
    await mount(tester);

    expect(find.text('Awa Diop'), findsNothing);
    expect(find.text('Appeler un représentant'), findsOneWidget);
    await tester.tap(find.text('Prospects'));
    await tester.pumpAndSettle();
    expect(find.text('Awa Diop'), findsOneWidget);
    expect(find.text('1 prospect'), findsOneWidget);
    // Le pied suit l'onglet : on n'appelle pas un représentant depuis la
    // liste des prospects.
    expect(find.text('Appeler un prospect'), findsOneWidget);
    expect(find.text('Appeler un représentant'), findsNothing);

    await teardownTree(tester);
  });

  testWidgets('le filtre par statut ne garde que les fiches qui le portent', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.statutsQualification)
        .insert(
          StatutsQualificationCompanion.insert(
            code: 'TRES_INTERESSE',
            id: 'sq-1',
            label: 'Très intéressé',
            effect: 'REACHED',
          ),
        );
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
      statutQualificationId: 'sq-1',
      serverUpdatedAt: DateTime.utc(2026, 9, 1),
    );
    await insertRepresentant(
      db,
      id: 'rep-2',
      phone: '+221770000002',
      fullName: 'Aminata Sy',
      serverUpdatedAt: DateTime.utc(2026, 9, 1),
    );
    await mount(tester);
    expect(find.text('Aminata Sy'), findsOneWidget);

    await tester.tap(find.byIcon(PhosphorIconsRegular.funnel).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Jamais qualifié'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Voir la liste'));
    await tester.pumpAndSettle();

    expect(find.text('Aminata Sy'), findsOneWidget);
    expect(find.text('Ousmane Fall'), findsNothing);
    expect(find.text('Jamais qualifié'), findsOneWidget);

    await tester.tap(find.text('Effacer les filtres'));
    await tester.pumpAndSettle();
    expect(find.text('Ousmane Fall'), findsOneWidget);

    await teardownTree(tester);
  });

  testWidgets('sans fiche, l\'écran dit d\'où elles viendront', (
    WidgetTester tester,
  ) async {
    await mount(tester);

    expect(find.text('Aucune fiche dans vos campagnes.'), findsOneWidget);
    final CpiEmptyState vide = tester.widget<CpiEmptyState>(
      find.byType(CpiEmptyState),
    );
    expect(vide.action, isNull);

    await teardownTree(tester);
  });

  testWidgets('une recherche sans résultat explique que le filtre est actif', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(tester);

    await chercher(tester, 'Ousmane');
    expect(find.text('Ousmane Fall'), findsOneWidget);

    await chercher(tester, 'Aminata');
    expect(find.text('Aucun résultat.'), findsOneWidget);
    expect(find.text('Ousmane Fall'), findsNothing);

    // Effacer ramène la liste entière.
    await tester.tap(find.text('Effacer la recherche'));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Ousmane Fall'), findsOneWidget);
    expect(find.text('Aminata'), findsNothing);

    await teardownTree(tester);
  });
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

  @override
  void nudge() {}
}
