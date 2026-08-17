import 'dart:async';
import 'dart:developer' as developer;
import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

import '../../data/local/connection.dart';
import '../../data/local/database.dart';
import '../../data/local/refresh_mutex_db.dart';
import '../../data/secure/secure_token_store.dart';
import '../network/dio_factory.dart';
import '../sync/dio_api.dart';
import '../sync/sync_engine.dart';
import '../sync/sync_engine_factory.dart';

@pragma('vm:entry-point')
void callbackDispatcher() {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();

  Workmanager().executeTask((String task, Map<String, dynamic>? input) async {
    AppDatabase? database;
    try {
      final SecureTokenStore tokens = SecureTokenStore();
      if (await tokens.readRefreshToken() == null) {
        return true;
      }

      database = openAppDatabase();
      final SyncEngine engine = buildSyncEngine(
        database: database,
        api: DioApi(
          ApiClientFactory.build(
            tokens: tokens,
            mutex: DatabaseRefreshMutex(database),
          ).client,
        ),
        tokens: tokens,
      );
      final SyncOutcome outcome = await engine.runOnce();
      await _stampLastBackgroundRun();
      developer.log(
        'Tâche de fond $task : ${outcome.status.name} '
        '(${outcome.pushed} envoyées, ${outcome.pulled} reçues)',
        name: 'cpi.bg',
      );
      return !outcome.shouldRetry;
    } on Object catch (e, stack) {
      developer.log(
        'Tâche de fond $task en échec',
        name: 'cpi.bg',
        error: e,
        stackTrace: stack,
      );
      return false;
    } finally {
      await database?.close();
    }
  });
}

Future<void> _stampLastBackgroundRun() async {
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  await prefs.setInt(
    BackgroundSync.lastRunKey,
    DateTime.now().toUtc().millisecondsSinceEpoch,
  );
}

abstract final class BackgroundSync {
  static const String periodicName = 'cpi.sync.periodic';
  static const String catchUpName = 'cpi.sync.catchup';
  static const String taskName = 'cpi-sync';
  static const String lastRunKey = 'sync.lastBackgroundRunAt';

  static Future<void> initialize() async {
    await Workmanager().initialize(callbackDispatcher);
    await Workmanager().registerPeriodicTask(
      periodicName,
      taskName,
      frequency: const Duration(minutes: 15),
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
    );
  }

  static Future<void> enqueueCatchUp() async {
    await Workmanager().registerOneOffTask(
      catchUpName,
      taskName,
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingWorkPolicy.replace,
      backoffPolicy: BackoffPolicy.exponential,
      backoffPolicyDelay: const Duration(seconds: 30),
    );
  }

  static Future<DateTime?> lastRunAt() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final int? stamp = prefs.getInt(lastRunKey);
    if (stamp == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(stamp, isUtc: true);
  }
}
