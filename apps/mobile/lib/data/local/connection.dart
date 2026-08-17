import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'database.dart';

QueryExecutor openAppDatabaseConnection() {
  return driftDatabase(
    name: 'cpi_go',
    native: const DriftNativeOptions(
      setup: AppDatabase.applyPragmas,
      shareAcrossIsolates: true,
    ),
  );
}

AppDatabase openAppDatabase() => AppDatabase(openAppDatabaseConnection());
