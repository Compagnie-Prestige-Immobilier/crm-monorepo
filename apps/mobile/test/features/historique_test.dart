import 'dart:async';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/data/repositories/write_repository.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/historique/presentation/historique_screen.dart';
import 'package:cpi_go/ui/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Le balayage de suppression de l'historique.
///
/// Une suppression qui casse est le seul geste de l'écran qui MENT quand elle
/// échoue : la ligne part de l'écran avant que la base ait répondu.
void main() {
  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() async => db.close());

  Future<void> mount(
    WidgetTester tester, {
    WriteRepository? writes,
    double textScale = 1,
    List<Override> extra = const <Override>[],
  }) async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          if (writes != null) writeRepositoryProvider.overrideWithValue(writes),
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authControllerProvider.overrideWith(_SignedInController.new),
          ...extra,
        ],
        child: MaterialApp(
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
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  Future<void> swipeAndConfirm(WidgetTester tester, String name) async {
    await tester.drag(find.text(name), const Offset(-500, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Supprimer'));
    await tester.pumpAndSettle();
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

    expect(find.text('Abdoulaye Ousseynou Kane Diagne'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await teardownTree(tester);
  });

  testWidgets('un balayage confirmé supprime la fiche', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(tester);

    await swipeAndConfirm(tester, 'Ousmane Fall');

    expect(find.text('Ousmane Fall'), findsNothing);

    await teardownTree(tester);
  });

  // La ligne partait de l'écran avant l'écriture : une base qui refuse laissait
  // le téléconseiller devant une liste amputée d'une fiche toujours là, et
  // l'erreur nulle part.
  testWidgets('une suppression qui échoue le dit et garde la fiche', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(tester, writes: _BrokenWrites(db));

    await swipeAndConfirm(tester, 'Ousmane Fall');

    expect(find.textContaining('Suppression impossible'), findsOneWidget);
    expect(find.text('Ousmane Fall'), findsOneWidget);

    await teardownTree(tester);
  });

  // La ligne se démonte avec la confirmation : `nudge()` lu sur son `WidgetRef`
  // APRÈS l'écriture ne partait jamais, et la suppression restait locale.
  testWidgets('une suppression confirmée déclenche bien l\'envoi', (
    WidgetTester tester,
  ) async {
    _nudges = 0;
    final StreamController<List<RepresentantSyncViewData>> liste =
        StreamController<List<RepresentantSyncViewData>>.broadcast();
    addTearDown(liste.close);
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await mount(
      tester,
      writes: _WritesQuiVidentLaListe(db, liste),
      extra: <Override>[
        representantListProvider.overrideWith((Ref ref) => liste.stream),
      ],
    );
    liste.add(<RepresentantSyncViewData>[
      RepresentantSyncViewData(
        id: 'rep-1',
        fullName: 'Ousmane Fall',
        phoneE164: '+221770000001',
        departementId: 'dep-1',
        relationStatus: 'ACTIF',
        whatsappStatus: 'INCONNU',
        createdById: 'me',
        clientCreatedAt: t0,
        rev: 1,
        localUpdatedAt: t0,
      ),
    ]);
    await tester.pumpAndSettle();

    await swipeAndConfirm(tester, 'Ousmane Fall');

    expect(tester.takeException(), isNull);
    expect(_nudges, greaterThan(0), reason: 'la suppression n\'est pas partie');

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

  // Le pire des sept états vides ne montrait qu'une phrase seule.
  testWidgets('l\'état vide porte une icône, un titre et une issue', (
    WidgetTester tester,
  ) async {
    await mount(tester);

    expect(find.byType(CpiEmptyState), findsOneWidget);
    expect(find.text('Aucun représentant'), findsOneWidget);
    expect(find.textContaining('Créez une première fiche'), findsOneWidget);
    final CpiEmptyState vide = tester.widget<CpiEmptyState>(
      find.byType(CpiEmptyState),
    );
    expect(vide.action, isNotNull);

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

    await tester.enterText(find.byType(TextField), 'Aminata');
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Aucun résultat'), findsOneWidget);
    expect(find.text('Aucun représentant'), findsNothing);

    await teardownTree(tester);
  });
}

/// La ligne quitte l'écran PENDANT l'écriture, comme en vrai : le flux se vide
/// avant que la suppression ne rende la main.
class _WritesQuiVidentLaListe extends WriteRepository {
  _WritesQuiVidentLaListe(super.db, this._liste);

  final StreamController<List<RepresentantSyncViewData>> _liste;

  @override
  Future<void> deleteRepresentant(String id) async {
    _liste.add(const <RepresentantSyncViewData>[]);
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
}

/// Une base qui refuse la suppression.
class _BrokenWrites extends WriteRepository {
  _BrokenWrites(super.db);

  @override
  Future<void> deleteRepresentant(String id) =>
      Future<void>.error(StateError('base en lecture seule'));

  @override
  Future<void> deleteProspect(String id) =>
      Future<void>.error(StateError('base en lecture seule'));
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

int _nudges = 0;

class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();

  @override
  void nudge() => _nudges += 1;
}
