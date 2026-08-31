import 'dart:async';
import 'dart:typed_data';

import 'package:cpi_go/core/providers/app_providers.dart';
import 'package:cpi_go/core/theme/app_theme.dart';
import 'package:cpi_go/core/updates/app_update_controller.dart';
import 'package:cpi_go/core/updates/update_installer.dart';
import 'package:cpi_go/features/updates/presentation/app_update_screen.dart';
import 'package:cpi_go/ui/widgets/cpi_kit.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// L'écran bloquant de mise à jour.
///
/// Le défaut qu'il ferme : l'écran prenait la main AVANT que la file d'envoi
/// n'ait démarré, et proposait d'installer par-dessus des saisies encore sur le
/// téléphone. Installer, c'est remplacer le processus.
void main() {
  late SharedPreferences prefs;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    prefs = await SharedPreferences.getInstance();
  });

  AndroidRelease release() => const AndroidRelease(
    forceUpdate: true,
    minVersionCode: 2,
    versionName: '1.0.1',
    versionCode: 2,
    fileSize: 12 * 1024 * 1024,
    sha256: 'abc',
    downloadUrl: '/api/v1/app-updates/android/download?v=2',
    notes: null,
  );

  Future<void> poser(
    WidgetTester tester, {
    required AppUpdateState state,
    required int outbox,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          pendingSyncCountProvider.overrideWith(
            (Ref ref) => Stream<int>.value(outbox),
          ),
          updateInstallerProvider.overrideWithValue(_MuetInstaller()),
          appUpdateClientProvider.overrideWithValue(() {
            final Dio dio = Dio(BaseOptions(baseUrl: 'https://exemple.test'));
            dio.httpClientAdapter = _MuetAdapter();
            return dio;
          }),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          locale: const Locale('fr', 'SN'),
          supportedLocales: const <Locale>[Locale('fr', 'SN')],
          localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: AppUpdateScreen(state: state),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }

  AppUpdateState prete({bool canInstall = true}) => AppUpdateState(
    status: AppUpdateStatus.ready,
    localPath: '/data/cpi-go-2.apk',
    belowFloor: true,
    gate: AppUpdateGate.blocking,
    canInstall: canInstall,
    release: release(),
  );

  testWidgets(
    'saisies en attente : l\'installation reste offerte, la file est signalée',
    (WidgetTester tester) async {
      await poser(tester, state: prete(), outbox: 2);

      // La bannière prévient, mais n'empêche pas : une mise à jour d'APK garde
      // les données, donc les saisies survivent et partent après.
      expect(find.text('2 saisies encore à envoyer'), findsOneWidget);
      final CpiButton installer = tester.widget<CpiButton>(
        find.widgetWithText(CpiButton, 'Installer'),
      );
      expect(installer.onPressed, isNotNull);
    },
  );

  testWidgets('file vide : l\'installation est offerte', (
    WidgetTester tester,
  ) async {
    await poser(tester, state: prete(), outbox: 0);

    expect(find.textContaining('encore à envoyer'), findsNothing);
    final CpiButton installer = tester.widget<CpiButton>(
      find.widgetWithText(CpiButton, 'Installer'),
    );
    expect(installer.onPressed, isNotNull);
  });

  testWidgets('« sources inconnues » refusée : le bouton mène aux réglages', (
    WidgetTester tester,
  ) async {
    await poser(tester, state: prete(canInstall: false), outbox: 0);

    expect(find.text('Autoriser l\'installation'), findsOneWidget);
    expect(find.widgetWithText(CpiButton, 'Installer'), findsNothing);
  });

  testWidgets('disque plein : le manque est nommé en mégaoctets', (
    WidgetTester tester,
  ) async {
    await poser(
      tester,
      state: AppUpdateState(
        status: AppUpdateStatus.error,
        belowFloor: true,
        gate: AppUpdateGate.blocking,
        blocker: AppUpdateBlocker.diskSpace,
        missingBytes: 30 * 1024 * 1024,
        release: release(),
      ),
      outbox: 0,
    );

    expect(find.textContaining('Il manque 30 Mo'), findsOneWidget);
  });

  testWidgets('mise à jour obligatoire : aucun « Plus tard »', (
    WidgetTester tester,
  ) async {
    await poser(tester, state: prete(), outbox: 0);

    expect(find.text('Mise à jour obligatoire'), findsOneWidget);
    expect(find.text('Plus tard'), findsNothing);
  });
}

/// Le contrôle de version n'a rien à voir avec ce que cet écran affiche : son
/// état lui est donné. Un adaptateur muet évite qu'il parte sur le réseau.
class _MuetAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => Completer<ResponseBody>().future;
}

class _MuetInstaller implements UpdateInstaller {
  @override
  Future<bool> canInstall() async => true;

  @override
  Future<int> freeSpaceBytes(String directory) async => 1 << 40;

  @override
  Future<void> install({required String path, String? signerSha256}) async {}

  @override
  Future<void> openUnknownSourcesSettings() async {}

  @override
  void onFailure(void Function(String message) handler) {}
}
