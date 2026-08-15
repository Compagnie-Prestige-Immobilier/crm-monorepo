import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'database.dart';

/// Ouverture du fichier de base sur l'appareil.
///
/// Isolé de `database.dart` à dessein : `drift_flutter` dépend de
/// `path_provider`, donc de plugins, donc d'un moteur Flutter. `AppDatabase`
/// doit rester utilisable sans lui (tests, isolat de fond avec un exécuteur
/// fourni autrement).
///
/// `sqlite3_flutter_libs` est volontairement absent des dépendances : depuis
/// `0.6.0+eol` ce paquet est un shim vide. `drift_flutter` tire `sqlite3`, qui
/// embarque désormais ses propres binaires natifs.
QueryExecutor openAppDatabaseConnection() {
  return driftDatabase(
    name: 'cpi_go',
    native: const DriftNativeOptions(
      setup: AppDatabase.applyPragmas,
      // Une seconde connexion sera ouverte par l'isolat WorkManager. Sans
      // partage, drift ouvre deux connexions indépendantes sur le même fichier
      // et les requêtes en flux de l'UI ne voient pas les écritures du worker :
      // l'écran resterait figé sur un compteur périmé.
      shareAcrossIsolates: true,
    ),
  );
}

/// Instance applicative. Ouverte une seule fois par isolat.
AppDatabase openAppDatabase() => AppDatabase(openAppDatabaseConnection());
