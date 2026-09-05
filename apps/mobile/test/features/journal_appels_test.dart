import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/providers/sync_coordinator.dart';
import 'package:cpi_go/core/sync/clock.dart';
import 'package:cpi_go/core/telephonie/telephonie_port.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/data/local/database.dart';
import 'package:cpi_go/features/auth/auth_controller.dart';
import 'package:cpi_go/features/auth/auth_state.dart';
import 'package:cpi_go/features/permissions/journal_appels.dart';
import 'package:cpi_go/features/representant/presentation/representant_qualification_screen.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/db_fixture.dart';
import '../support/fake_api.dart';

/// EB-37 : la lecture du journal d'appels se demande à la première ouverture
/// de fiche, une seule fois, et son refus se voit à l'accueil.
void main() {
  late AppDatabase db;
  late List<MethodCall> appels;
  late String journal;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    db = await openTestDatabase();
    appels = <MethodCall>[];
    journal = 'refusee';
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, (
          MethodCall call,
        ) async {
          appels.add(call);
          return switch (call.method) {
            'etat' => <String, Object?>{
              'permissions': <String, Object?>{
                'CALL_PHONE': 'accordee',
                'READ_PHONE_STATE': 'accordee',
                'READ_CALL_LOG': journal,
              },
            },
            'demanderPermission' => 'accordee',
            _ => null,
          };
        });
    await insertRepresentant(
      db,
      id: 'rep-1',
      phone: '+221770000001',
      fullName: 'Ousmane Fall',
    );
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(Telephonie.canalParDefaut, null);
    debugDefaultTargetPlatformOverride = null;
    await db.close();
  });

  Future<void> monter(WidgetTester tester, Widget home) async {
    tester.view.physicalSize = const Size(1080, 6000);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          appDatabaseProvider.overrideWithValue(db),
          apiPortProvider.overrideWithValue(FakeApi()),
          clockProvider.overrideWithValue(FakeClock(t0)),
          sharedPreferencesProvider.overrideWithValue(prefs),
          authControllerProvider.overrideWith(_Connecte.new),
          syncCoordinatorProvider.overrideWith(_SyncInerte.new),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr'),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: const <Locale>[Locale('fr')],
          home: home,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  /// La variable de plateforme se remet AVANT la fin du corps du test : le
  /// cadre vérifie ses invariants avant `tearDown`.
  Future<void> demonter(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 1));
    debugDefaultTargetPlatformOverride = null;
  }

  List<MethodCall> demandes() => appels
      .where((MethodCall c) => c.method == 'demanderPermission')
      .toList(growable: false);

  testWidgets('la permission se demande à la première ouverture, pas à la seconde', (
    WidgetTester tester,
  ) async {
    const Widget fiche = RepresentantQualificationScreen(representantId: 'rep-1');
    await monter(tester, fiche);
    await tester.tap(find.text('Ouvrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Journal d\'appels'), findsOneWidget);
    expect(demandes(), isEmpty);

    await tester.tap(find.text('Continuer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(demandes().single.arguments, <String, Object?>{'nom': 'READ_CALL_LOG'});
    await demonter(tester);

    // La fiche fermée, la suivante repasse par la confirmation, sans redemander.
    await db
        .update(db.ouverturesFiche)
        .write(OuverturesFicheCompanion(closedAt: Value<DateTime?>(t0)));
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    await monter(tester, fiche);
    await tester.tap(find.text('Ouvrir'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Journal d\'appels'), findsNothing);
    expect(demandes(), hasLength(1));
    await demonter(tester);
  });

  testWidgets('le bandeau ne s\'affiche qu\'après un refus', (
    WidgetTester tester,
  ) async {
    const Widget bandeau = Scaffold(body: JournalAppelsBanner());
    await monter(tester, bandeau);
    expect(find.textContaining('Journal d\'appels refusé'), findsNothing);
    await demonter(tester);

    SharedPreferences.setMockInitialValues(<String, Object>{
      kClePrefsJournalDemande: true,
    });
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    await monter(tester, bandeau);
    expect(find.textContaining('Journal d\'appels refusé'), findsOneWidget);

    journal = 'accordee';
    await tester.tap(find.text('Autoriser'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(demandes(), hasLength(1));
    expect(find.textContaining('Journal d\'appels refusé'), findsNothing);
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
