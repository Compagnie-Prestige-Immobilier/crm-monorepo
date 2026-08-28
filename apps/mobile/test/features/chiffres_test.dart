import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/accueil/presentation/chiffres_screen.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// Les chiffres de l'accueil, entièrement calculés en SQL local sous une
/// horloge injectée.
void main() {
  final DateTime midi = DateTime.utc(2026, 8, 12, 9, 12);

  late AppDatabase db;
  late FakeApi api;

  setUp(() async {
    db = await openTestDatabase();
    api = FakeApi();
  });

  tearDown(() => db.close());

  Widget host(String role) {
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(db),
        apiPortProvider.overrideWithValue(api),
        clockProvider.overrideWithValue(FakeClock(midi)),
        authControllerProvider.overrideWith(() => _SignedIn(role)),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('fr'),
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        supportedLocales: const <Locale>[Locale('fr')],
        home: const ChiffresScreen(),
      ),
    );
  }

  Future<void> teardownTree(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
  }

  testWidgets(
    'les compteurs et l\'heure de pointe se calculent sous horloge fixée',
    (WidgetTester tester) async {
      await insertVisite(db, id: 'v1', date: '2026-08-12', time: '10:05');
      await insertVisite(db, id: 'v2', date: '2026-08-12', time: '10:40');
      await insertVisite(db, id: 'v3', date: '2026-08-08', time: '09:00');

      await tester.pumpWidget(host('ACCUEIL'));
      await tester.pumpAndSettle();

      // Une carte par chiffre, repérée par sa clé : le nombre y est en très
      // gros, le libellé au-dessus.
      Finder chiffre(String cle, String valeur) => find.descendant(
        of: find.byKey(ValueKey<String>(cle)),
        matching: find.text(valeur),
      );

      expect(chiffre('chiffre-jour', '2'), findsOneWidget);
      expect(chiffre('chiffre-semaine', '3'), findsOneWidget);
      // Sous le graphique, hors du premier écran peint dans ce viewport de test.
      expect(
        find.textContaining(
          'Le plus de monde entre 10 h et 11 h',
          skipOffstage: false,
        ),
        findsOneWidget,
      );

      await teardownTree(tester);
    },
  );

  testWidgets('« Reçus aujourd\'hui » compte par personne demandée', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await insertVisite(
      db,
      id: 'v1',
      date: '2026-08-12',
      time: '10:05',
      destinataireId: 't1',
      destinataireLabel: 'MME. NDOYE',
    );
    await insertVisite(
      db,
      id: 'v2',
      date: '2026-08-12',
      time: '10:40',
      destinataireId: 't1',
      destinataireLabel: 'MME. NDOYE',
    );
    // Hier : ne compte pas dans la journée.
    await insertVisite(
      db,
      id: 'v3',
      date: '2026-08-11',
      destinataireId: 't2',
      destinataireLabel: 'M. DIOP',
    );

    await tester.pumpWidget(host('ACCUEIL'));
    await tester.pumpAndSettle();

    final Finder carte = find.byKey(const ValueKey<String>('chiffre-recus'));
    expect(carte, findsOneWidget);
    expect(
      find.descendant(of: carte, matching: find.text('Par personne demandée')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: carte, matching: find.text('MME. NDOYE')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: carte, matching: find.text('2')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: carte, matching: find.text('M. DIOP')),
      findsNothing,
    );

    // Les entreprises ne sont plus réparties : trois sociétés du groupe ne
    // font pas une statistique.
    expect(
      find.text('Entreprises les plus reçues', skipOffstage: false),
      findsNothing,
    );

    await teardownTree(tester);
  });

  testWidgets('sans personne demandée, la carte le dit', (
    WidgetTester tester,
  ) async {
    await insertVisite(db, id: 'v1', date: '2026-08-12', time: '10:05');

    await tester.pumpWidget(host('ACCUEIL'));
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Personne n\'a encore été demandé nommément aujourd\'hui.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );

    await teardownTree(tester);
  });

  testWidgets('un compte sans le registre est renvoyé vers la direction', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(host('COMMERCIAL'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Ce compte ne tient pas le registre des visites.'),
      findsOneWidget,
    );

    await teardownTree(tester);
  });
}

class _SignedIn extends AuthController {
  _SignedIn(this._role);

  final String _role;

  @override
  AuthState build() => AuthState(
    status: AuthStatus.authenticated,
    userId: 'u-1',
    fullName: 'Fatou Sarr',
    role: _role,
    email: 'fatou.sarr@cpi.sn',
  );
}
