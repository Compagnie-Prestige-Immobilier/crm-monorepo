import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/representant/presentation/representant_qualification_screen.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// EB-07 à EB-09 : une fiche se confirme avant de s'ouvrir, ne se quitte pas
/// sans statut, et son temps de traitement se voit.
void main() {
  late AppDatabase db;
  late FakeApi api;
  late FakeClock horloge;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    api = FakeApi();
    horloge = FakeClock(t0);
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
    await db
        .into(db.statutsQualification)
        .insert(
          StatutsQualificationCompanion.insert(
            code: 'HORS_CIBLE',
            id: 'sq-hors-cible',
            label: 'Hors cible',
            effect: 'REFUSED',
          ),
        );
  });

  tearDown(() => db.close());

  Future<void> monter(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(api),
          clockProvider.overrideWithValue(horloge),
          sharedPreferencesProvider.overrideWithValue(prefs),
          authControllerProvider.overrideWith(_Connecte.new),
          syncCoordinatorProvider.overrideWith(_SyncInerte.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const RepresentantQualificationScreen(representantId: 'rep-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<void> demonter(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  Future<List<OuverturesFicheData>> ouvertures() =>
      db.select(db.ouverturesFiche).get();

  testWidgets('la fiche se confirme avant de s\'ouvrir', (
    WidgetTester tester,
  ) async {
    await monter(tester);

    expect(find.text('Ouvrir la fiche de Ousmane Fall ?'), findsOneWidget);
    expect(
      find.text('Vous ne pourrez pas la quitter sans la qualifier.'),
      findsOneWidget,
    );
    expect(find.text('Ouvrir'), findsOneWidget);
    expect(find.text('Annuler'), findsOneWidget);
    // Tant que rien n'est confirmé, aucune ouverture n'est comptée.
    expect(await ouvertures(), isEmpty);

    await tester.tap(find.text('Ouvrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    final OuverturesFicheData prise = (await ouvertures()).single;
    expect(prise.representantId, 'rep-1');
    expect(prise.openedAt, t0);
    expect(prise.closedAt, isNull);
    await demonter(tester);
  });

  testWidgets('annuler n\'ouvre rien', (WidgetTester tester) async {
    await monter(tester);

    await tester.tap(find.text('Annuler'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(await ouvertures(), isEmpty);
    expect(api.ouvertures, isEmpty);
    await demonter(tester);
  });

  // EB-09 : le chronomètre part de l'ouverture confirmée, il est visible, et il
  // ne se stocke nulle part.
  testWidgets('le chronomètre compte depuis l\'ouverture', (
    WidgetTester tester,
  ) async {
    await monter(tester);
    await tester.tap(find.text('Ouvrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('00:00'), findsOneWidget);

    horloge.advance(const Duration(minutes: 3, seconds: 12));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('03:12'), findsOneWidget);

    horloge.advance(const Duration(hours: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('1:03:12'), findsOneWidget);
    await demonter(tester);
  });

  // EB-08 : le retour est REFUSÉ, il ne demande plus confirmation. L'ancien
  // « Quitter sans enregistrer ? » ne freinait la sortie que si quelque chose
  // avait été saisi.
  testWidgets('le retour est refusé tant qu\'aucun statut n\'est posé', (
    WidgetTester tester,
  ) async {
    await monter(tester);
    await tester.tap(find.text('Ouvrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.byIcon(PhosphorIconsRegular.arrowLeft));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(
      find.text('Posez un statut avant de quitter cette fiche.'),
      findsOneWidget,
    );
    expect(find.text('Quitter sans enregistrer ?'), findsNothing);
    expect(find.text('Avant l\'appel'), findsWidgets);
    await demonter(tester);
  });

  // La reprise après un plantage : la fiche en cours se rouvre sans redemander,
  // verrou actif. Une seconde confirmation compterait une ouverture de plus.
  testWidgets('la fiche déjà tenue se rouvre sans redemander', (
    WidgetTester tester,
  ) async {
    await db
        .into(db.ouverturesFiche)
        .insert(
          OuverturesFicheCompanion.insert(
            id: 'ouv-en-cours',
            openedById: 'u-1',
            representantId: const Value<String?>('rep-1'),
            openedAt: t0.subtract(const Duration(minutes: 2)),
          ),
        );

    await monter(tester);

    expect(find.text('Ouvrir la fiche de Ousmane Fall ?'), findsNothing);
    expect(find.text('02:00'), findsOneWidget);
    expect((await ouvertures()).single.id, 'ouv-en-cours');
    await demonter(tester);
  });

  // Le verrou refuse la seconde fiche SANS dire laquelle il tient : l'écran
  // doit nommer celle qui est en main et proposer de la reprendre.
  testWidgets('une autre fiche en cours se propose à la reprise', (
    WidgetTester tester,
  ) async {
    await insertRepresentant(
      db,
      id: 'rep-2',
      phone: '+221770000002',
      fullName: 'Awa Ndiaye',
    );
    await db
        .into(db.ouverturesFiche)
        .insert(
          OuverturesFicheCompanion.insert(
            id: 'ouv-ailleurs',
            openedById: 'u-1',
            representantId: const Value<String?>('rep-2'),
            openedAt: t0,
          ),
        );

    await monter(tester);
    await tester.tap(find.text('Ouvrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Fiche en cours'), findsOneWidget);
    expect(
      find.text(
        'Vous tenez déjà la fiche de Awa Ndiaye. Qualifiez-la avant d\'en '
        'ouvrir une autre.',
      ),
      findsOneWidget,
    );
    expect(find.text('Reprendre'), findsOneWidget);
    // Rien de neuf : la fiche refusée n'a jamais été ouverte.
    expect((await ouvertures()).single.id, 'ouv-ailleurs');
    await demonter(tester);
  });
}

class _Connecte extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Awa Sy',
    role: 'COMMERCIAL',
  );
}

class _SyncInerte extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
