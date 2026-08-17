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

  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );

  final AppDatabase database = openAppDatabase();
  final SharedPreferences preferences = await SharedPreferences.getInstance();
  final PackageInfo packageInfo = await PackageInfo.fromPlatform();

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
