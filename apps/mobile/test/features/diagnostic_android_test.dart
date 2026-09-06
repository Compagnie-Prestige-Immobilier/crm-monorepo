import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/telephonie/telephonie_port.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/diagnostic/presentation/diagnostic_android_screen.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';

/// Le diagnostic sert à répondre sur l'appareil, pas de mémoire : ce qu'il
/// affiche vient du canal natif, et ses boutons demandent réellement ce qu'ils
/// annoncent.
void main() {
  late AppDatabase db;
  late List<MethodCall> appels;
  late Map<String, Object?> etat;

  Map<String, Object?> etatAvec(Map<String, Object?> permissions) =>
      <String, Object?>{
        'permissions': permissions,
        'batterieExemptee': false,
        'telephone': <String, Object?>{
          'etatAppel': 'aucun',
          'sim': 'prete',
          'reseau': 'lte',
        },
        'roleScreening': <String, Object?>{'disponible': true, 'tenu': false},
        'services': <String, Object?>{
          'synchro': false,
          'appel': false,
          'typeAppel': null,
        },
        'appelsHorsCrmIgnores': 0,
      };

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    appels = <MethodCall>[];
    etat = etatAvec(<String, Object?>{
      'CALL_PHONE': 'accordee',
      'READ_PHONE_STATE': 'refusee',
      'READ_CALL_LOG': 'definitive',
    });
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, (
          MethodCall call,
        ) async {
          appels.add(call);
          return switch (call.method) {
            'etat' => etat,
            'demanderPermission' => 'accordee',
            _ => null,
          };
        });
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, null);
    debugDefaultTargetPlatformOverride = null;
    await db.close();
  });

  Future<void> ouvrir(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2340);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          syncCoordinatorProvider.overrideWith(_Idle.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: const DiagnosticAndroidScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> fermer(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
    debugDefaultTargetPlatformOverride = null;
  }

  testWidgets('chaque autorisation dit son état, dans les mots du téléphone', (
    WidgetTester tester,
  ) async {
    await ouvrir(tester);

    expect(find.text('Passer un appel'), findsOneWidget);
    expect(find.text('Accordée'), findsOneWidget);
    expect(find.text('État du téléphone'), findsOneWidget);
    expect(find.text('Refusée'), findsOneWidget);
    expect(find.text('Journal d\'appels'), findsOneWidget);
    expect(find.text('Refusée définitivement'), findsOneWidget);

    await fermer(tester);
  });

  testWidgets(
    '« Demander » demande la permission de cette ligne, pas une autre',
    (WidgetTester tester) async {
      await ouvrir(tester);

      await tester.tap(find.text('Demander'));
      await tester.pumpAndSettle();

      final MethodCall demande = appels.firstWhere(
        (MethodCall c) => c.method == 'demanderPermission',
      );
      expect(
        (demande.arguments as Map<Object?, Object?>)['nom'],
        'READ_PHONE_STATE',
      );

      await fermer(tester);
    },
  );

  // Une autorisation refusée DEUX fois ne se redemande plus : Android ne montre
  // plus la fenêtre, et un bouton « Demander » ne ferait rien.
  testWidgets('un refus définitif renvoie aux réglages, pas à une demande', (
    WidgetTester tester,
  ) async {
    etat = etatAvec(<String, Object?>{
      'CALL_PHONE': 'definitive',
      'READ_PHONE_STATE': 'definitive',
      'READ_CALL_LOG': 'definitive',
    });
    await ouvrir(tester);

    expect(find.text('Demander'), findsNothing);
    expect(find.text('Ouvrir les réglages'), findsNWidgets(3));

    await fermer(tester);
  });

  // Le canal natif n'existe pas encore sur un appareil qui n'a pas la mise à
  // jour : l'écran doit s'ouvrir quand même.
  testWidgets('sans canal natif, l\'écran s\'ouvre et n\'accorde rien', (
    WidgetTester tester,
  ) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, null);

    await ouvrir(tester);

    expect(find.text('Diagnostic Android'), findsOneWidget);
    expect(find.text('Refusée'), findsNWidgets(3));

    await fermer(tester);
  });
}

class _Idle extends SyncCoordinator {
  @override
  SyncUiState build() => const SyncUiState();
}
