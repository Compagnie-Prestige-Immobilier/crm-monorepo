import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/api_port.dart';
import 'package:cpi_go/core/router/route_paths.dart';
import 'package:cpi_go/core/router/single_push.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/sync/outbox_status.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/corrections/presentation/corrections_screen.dart';
import 'package:cpi_go/features/corrections/presentation/discard_confirmation.dart';
import 'package:cpi_go/features/corrections/presentation/ownership_sheet.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// ═══ CE QUE CES TESTS TIENNENT ═══
///
/// Deux boutons détruisent la même chose : « Supprimer cette saisie » dans la
/// feuille « Autres » d'une carte de « À corriger », et le bouton du même nom
/// dans la feuille d'arbitrage.
/// La ligne visée est, dans les deux cas, la création d'un représentant en
/// `conflict`, c'est-à-dire la seule ligne de la file dont l'abandon emporte
/// une cascade : le représentant ET tous les prospects saisis sous lui.
///
/// Deux défauts se tenaient là, et aucun test ne les voyait :
///
/// 1. la carte demandait bien confirmation, mais comptait sa cascade en
///    filtrant « À corriger » (`conflict`, `failed`) alors que la suppression
///    prend `OutboxStatus.open` (`pending`, `syncing` en plus). Les prospects
///    d'un représentant refusé sont en `pending` : ils étaient invisibles du
///    compte, la boîte disait « cette saisie », et le doigt détruisait vingt
///    fiches ;
/// 2. la feuille ne demandait rien du tout. Un appui, tout disparaît.
///
/// D'où les assertions : la phrase de la boîte doit nommer la cascade RÉELLE,
/// et la feuille ne doit pas pouvoir détruire sans un « oui ».
void main() {
  late AppDatabase db;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
  });
  tearDown(() async => db.close());

  /// Un représentant refusé par le serveur, deux prospects tapés dessous.
  ///
  /// Les statuts sont ceux que le moteur produit vraiment : la tête part en
  /// `failed` (verdict `invalid` puis `_markFailed`), et chaque prospect en
  /// `pending` (verdict `skippedDependencyFailed` puis `_requeueBlocked`).
  Future<void> seedRefusedChain({
    String headStatus = OutboxStatus.failed,
  }) async {
    await insertRepresentant(db, id: 'repA', phone: '+221770000001');
    await insertProspect(
      db,
      id: 'pA1',
      representantId: 'repA',
      phone: '+221780000001',
    );
    await insertProspect(
      db,
      id: 'pA2',
      representantId: 'repA',
      phone: '+221780000002',
    );
    await queueOp(
      db,
      id: 'A1',
      entityType: 'representant',
      entityId: 'repA',
      status: headStatus,
      payload: <String, Object?>{
        'fullName': 'Awa Sy',
        'phone': '+221770000001',
      },
    );
    await queueOp(
      db,
      id: 'A2',
      entityType: 'prospect',
      entityId: 'pA1',
      dependencyKey: 'repA',
      status: OutboxStatus.pending,
    );
    await queueOp(
      db,
      id: 'A3',
      entityType: 'prospect',
      entityId: 'pA2',
      dependencyKey: 'repA',
      status: OutboxStatus.pending,
    );
  }

  /// Les cinq surcharges sont TOUTES nécessaires : `sharedPreferencesProvider`
  /// et `clockProvider` lèvent tant qu'ils ne sont pas fournis, et un provider
  /// qui lève pendant la construction de l'arbre FIGE le harnais au lieu de
  /// faire échouer le test.
  Future<Widget> host(Widget child) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(FakeApi()),
        clockProvider.overrideWithValue(FakeClock(t0)),
        sharedPreferencesProvider.overrideWithValue(prefs),
        syncCoordinatorProvider.overrideWith(_FrozenCoordinator.new),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: child,
      ),
    );
  }

  /// Quelques images fixes puis démontage : `pumpAndSettle` ne rend jamais la
  /// main, les écrans observant des flux drift qui se replanifient.
  Future<void> paint(WidgetTester tester, [Widget? app]) async {
    if (app != null) await tester.pumpWidget(app);
    for (int i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> unmount(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  /// La feuille « Autres » et la boîte de confirmation portent deux boutons
  /// rouges voisins : le libellé les sépare, la variante lève le doute.
  Finder bouton(String label, {CpiButtonVariant? variant}) =>
      find.byWidgetPredicate(
        (Widget w) =>
            w is CpiButton &&
            w.label == label &&
            (variant == null || w.variant == variant),
      );

  group('la phrase de la boîte, sans mise en scène', () {
    test('elle nomme les fiches à ressaisir, pas les opérations', () {
      expect(
        discardWarning(const DiscardPreview(operations: 21, prospects: 20)),
        contains('20 prospects'),
      );
      expect(
        discardWarning(const DiscardPreview(operations: 2, prospects: 1)),
        allOf(contains('1 prospect'), isNot(contains('prospects'))),
      );
    });

    test('une saisie seule reste une saisie seule', () {
      expect(
        discardWarning(const DiscardPreview(operations: 1, prospects: 0)),
        'Cette saisie sera supprimée définitivement.',
      );
    });
  });

  group('« À corriger » : la boîte annonce la cascade réelle', () {
    /// La suppression est maintenant dans la feuille « Autres » : la carte ne
    /// porte plus que deux boutons, et aucun ne détruit.
    Future<void> ouvrirAutres(WidgetTester tester) async {
      await tester.tap(bouton('Autres'));
      await paint(tester);
      await tester.tap(bouton('Supprimer cette saisie'));
      await paint(tester);
    }

    testWidgets('les prospects `pending` sont comptés, pas ignorés', (
      WidgetTester tester,
    ) async {
      await seedRefusedChain();
      await paint(tester, await host(const CorrectionsScreen()));

      await ouvrirAutres(tester);

      expect(
        find.textContaining('2 prospects'),
        findsOneWidget,
        reason:
            'le compte lisait « À corriger » (conflict, failed) alors que la '
            'suppression prend OutboxStatus.open : les deux prospects, en '
            '`pending`, étaient invisibles et la boîte disait « cette saisie »',
      );
      expect(
        find.text('Cette saisie sera supprimée définitivement.'),
        findsNothing,
      );
      await unmount(tester);
    });

    testWidgets('annuler ne détruit rien', (WidgetTester tester) async {
      await seedRefusedChain();
      await paint(tester, await host(const CorrectionsScreen()));

      await ouvrirAutres(tester);
      await tester.tap(bouton('Annuler'));
      await paint(tester);

      expect(await allOutbox(db), hasLength(3));
      expect(await db.select(db.prospects).get(), hasLength(2));
      await unmount(tester);
    });

    testWidgets('confirmer emporte bien les trois opérations annoncées', (
      WidgetTester tester,
    ) async {
      await seedRefusedChain();
      await paint(tester, await host(const CorrectionsScreen()));

      await ouvrirAutres(tester);
      await tester.tap(bouton('Supprimer', variant: CpiButtonVariant.danger));
      await paint(tester);

      expect(await allOutbox(db), isEmpty);
      expect(await db.select(db.prospects).get(), isEmpty);
      expect(await db.select(db.representants).get(), isEmpty);
      await unmount(tester);
    });

    /// Le libellé promettait une modification que l'app ne sait pas faire : il
    /// n'existe aucun écran d'édition de prospect, et le bouton sautait vers
    /// l'onglet Historique.
    testWidgets('un prospect ne se voit pas promettre « Modifier »', (
      WidgetTester tester,
    ) async {
      await insertRepresentant(db, id: 'repA', phone: '+221770000001');
      await insertProspect(
        db,
        id: 'pA1',
        representantId: 'repA',
        phone: '+221780000001',
      );
      await queueOp(
        db,
        id: 'A2',
        entityType: 'prospect',
        entityId: 'pA1',
        dependencyKey: 'repA',
        status: OutboxStatus.failed,
      );

      await paint(tester, await host(const CorrectionsScreen()));
      await tester.tap(bouton('Autres'));
      await paint(tester);

      expect(find.text('Modifier'), findsNothing);
      expect(find.text('Voir la fiche'), findsOneWidget);
      await unmount(tester);
    });
  });

  group('la feuille d\'arbitrage ne détruit plus sans demander', () {
    /// La feuille ne s'ouvre que sur une création de représentant en `conflict`,
    /// donc sur la ligne exacte qui cascade.
    Future<Widget> sheetHost({String? ownerName = 'Moussa Diop'}) async {
      final OutboxData head = await outboxById(db, 'A1');
      return host(
        Builder(
          builder: (BuildContext context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => showOwnershipSheet(
                  context: context,
                  row: head,
                  lookup: RepresentantLookup(
                    found: true,
                    phoneE164: '+221770000001',
                    representant: representantDto(
                      id: 'server-rep',
                      phoneE164: '+221770000001',
                    ),
                    ownedByCommercialId: 'autre',
                    ownedByCommercialName: ownerName,
                  ),
                ),
                child: const Text('ouvrir'),
              ),
            ),
          ),
        ),
      );
    }

    Future<void> openSheet(WidgetTester tester) async {
      await seedRefusedChain(headStatus: OutboxStatus.conflict);
      await paint(tester, await sheetHost());
      await tester.tap(find.text('ouvrir'));
      await paint(tester);
      expect(find.text('Supprimer cette saisie'), findsOneWidget);
    }

    testWidgets(
      '« Corriger le numéro » ouvre la fiche une fois la feuille fermée',
      (WidgetTester tester) async {
        // La feuille se dépilait AVANT de naviguer, avec son propre contexte :
        // l'élément est désactivé, `GoRouter.of` n'y remonte plus rien et le
        // bouton ne faisait que refermer la feuille.
        await seedRefusedChain(headStatus: OutboxStatus.conflict);
        final OutboxData head = await outboxById(db, 'A1');
        final SharedPreferences prefs = await SharedPreferences.getInstance();
        SinglePush.reset();

        final GoRouter router = GoRouter(
          initialLocation: '/depart',
          routes: <RouteBase>[
            GoRoute(
              path: '/depart',
              builder: (BuildContext context, GoRouterState state) => Scaffold(
                body: Center(
                  child: ElevatedButton(
                    onPressed: () => showOwnershipSheet(
                      context: context,
                      row: head,
                      lookup: RepresentantLookup(
                        found: true,
                        phoneE164: '+221770000001',
                        representant: representantDto(
                          id: 'server-rep',
                          phoneE164: '+221770000001',
                        ),
                        ownedByCommercialName: 'Moussa Diop',
                      ),
                    ),
                    child: const Text('ouvrir'),
                  ),
                ),
              ),
            ),
            GoRoute(
              path: Routes.newRepresentant,
              builder: (BuildContext context, GoRouterState state) =>
                  const Scaffold(body: Center(child: Text('FICHE'))),
            ),
          ],
        );
        addTearDown(router.dispose);

        await paint(
          tester,
          ProviderScope(
            overrides: [
              appDatabaseProvider.overrideWithValue(db),
              apiPortProvider.overrideWithValue(FakeApi()),
              clockProvider.overrideWithValue(FakeClock(t0)),
              sharedPreferencesProvider.overrideWithValue(prefs),
              syncCoordinatorProvider.overrideWith(_FrozenCoordinator.new),
            ],
            child: MaterialApp.router(
              theme: AppTheme.light,
              locale: const Locale('fr'),
              localizationsDelegates: GlobalMaterialLocalizations.delegates,
              supportedLocales: const <Locale>[Locale('fr')],
              routerConfig: router,
            ),
          ),
        );

        await tester.tap(find.text('ouvrir'));
        await paint(tester);
        await tester.tap(find.text('Corriger le numéro'));
        await paint(tester);

        expect(find.text('FICHE'), findsOneWidget);
        await unmount(tester);
      },
    );

    testWidgets(
      'le propriétaire inconnu est un TÉLÉCONSEILLER, pas un commercial',
      (WidgetTester tester) async {
        // `commercial` est proscrit de toute chaîne affichée : le vocabulaire du
        // produit est gardé côté web, et la seule occurrence restante du dépôt
        // était ce repli.
        await seedRefusedChain(headStatus: OutboxStatus.conflict);
        await paint(tester, await sheetHost(ownerName: null));
        await tester.tap(find.text('ouvrir'));
        await paint(tester);

        expect(find.textContaining('commercial'), findsNothing);
        expect(find.textContaining('téléconseiller'), findsOneWidget);
        await unmount(tester);
      },
    );

    testWidgets('un appui ne suffit pas : il faut confirmer', (
      WidgetTester tester,
    ) async {
      await openSheet(tester);

      await tester.tap(find.text('Supprimer cette saisie'));
      await paint(tester);

      expect(
        find.text('Abandonner cet envoi ?'),
        findsOneWidget,
        reason:
            'la feuille appelait discardOperation sans un mot : un appui '
            'détruisait le représentant et tous ses prospects',
      );
      expect(
        await allOutbox(db),
        hasLength(3),
        reason: 'rien ne doit disparaître tant que la question est posée',
      );
      expect(await db.select(db.prospects).get(), hasLength(2));
      await unmount(tester);
    });

    testWidgets('la boîte de la feuille annonce la même cascade que la carte', (
      WidgetTester tester,
    ) async {
      await openSheet(tester);

      await tester.tap(find.text('Supprimer cette saisie'));
      await paint(tester);

      expect(find.textContaining('2 prospects'), findsOneWidget);
      await unmount(tester);
    });

    testWidgets('annuler laisse la saisie et la feuille en place', (
      WidgetTester tester,
    ) async {
      await openSheet(tester);

      await tester.tap(find.text('Supprimer cette saisie'));
      await paint(tester);
      await tester.tap(bouton('Annuler'));
      await paint(tester);

      expect(await allOutbox(db), hasLength(3));
      expect(find.text('Supprimer cette saisie'), findsOneWidget);
      await unmount(tester);
    });

    testWidgets('confirmer détruit la cascade et referme la feuille', (
      WidgetTester tester,
    ) async {
      await openSheet(tester);

      await tester.tap(find.text('Supprimer cette saisie'));
      await paint(tester);
      await tester.tap(bouton('Supprimer', variant: CpiButtonVariant.danger));
      await paint(tester);

      expect(await allOutbox(db), isEmpty);
      expect(await db.select(db.prospects).get(), isEmpty);
      expect(find.text('Supprimer cette saisie'), findsNothing);
      await unmount(tester);
    });
  });
}

/// Un coordinateur figé : ces tests décrivent un ÉTAT, ils n'exécutent pas de
/// cycle de synchronisation.
class _FrozenCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
