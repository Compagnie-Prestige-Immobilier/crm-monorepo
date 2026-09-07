import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/background/background_sync.dart';
import 'core/providers/app_providers.dart';
import 'data/local/connection.dart';
import 'data/local/database.dart';
import 'data/repositories/draft_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (kDebugMode) {
    SemanticsBinding.instance.ensureSemantics();
  }

  // Les trois amorces passent par le canal de plateforme, et le fil principal
  // d'Android monte encore l'activite : les enchainer fait attendre trois fois
  // la meme file. Elles partent ensemble, on les recueille ensuite.
  final Future<void> orientation = SystemChrome.setPreferredOrientations(
    <DeviceOrientation>[
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ],
  );
  final Future<SharedPreferences> preferencesLues =
      SharedPreferences.getInstance();
  final Future<PackageInfo> packageLu = PackageInfo.fromPlatform();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  final AppDatabase database = openAppDatabase();
  final SharedPreferences preferences = await preferencesLues;
  final PackageInfo packageInfo = await packageLu;
  await orientation;

  unawaited(DraftRepository(database).purgeStale());

  unawaited(_initBackground());

  runApp(
    ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(database),
        sharedPreferencesProvider.overrideWithValue(preferences),
        buildNumberProvider.overrideWithValue(packageInfo.buildNumber),
      ],
      child: const CpiGoApp(),
    ),
  );
}

Future<void> _initBackground() async {
  try {
    await BackgroundSync.initialize();
  } on Object catch (e) {
    debugPrint('Synchronisation de fond indisponible : $e');
  }
}
