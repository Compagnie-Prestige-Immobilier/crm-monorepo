import 'package:drift/drift.dart';
import 'package:sqlite3/common.dart';

part 'database.g.dart';

/// Base locale de CPI GO.
///
/// Elle est la **source de vérité** de l'app : toute écriture métier atterrit
/// ici d'abord et n'est poussée qu'ensuite. Le réseau est mauvais ou absent ;
/// une écriture qui dépendrait du serveur serait une écriture perdue.
///
/// Ce fichier n'importe **ni** `package:flutter`, **ni** `drift_flutter` : il
/// doit rester ouvrable depuis l'isolat WorkManager, qui n'a pas d'arbre de
/// widgets. L'ouverture concrète du fichier vit dans `connection.dart`, et
/// [AppDatabase] reçoit son exécuteur.
@DriftDatabase(include: <String>{'schema.drift'})
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.executor);

  /// PRAGMAs appliqués à **chaque** ouverture de connexion.
  ///
  /// - `journal_mode = WAL` : sans lui, un lecteur bloque un écrivain. L'isolat
  ///   de synchronisation écrira pendant que l'UI lit ; en mode journal par
  ///   défaut, l'un des deux prend un `SQLITE_BUSY` immédiat.
  /// - `busy_timeout = 5000` : WAL réduit la contention sur la transaction
  ///   d'écriture, il ne la supprime pas. 5 s laissent le temps à un lot de
  ///   finir au lieu d'échouer sèchement.
  /// - `foreign_keys = ON` : SQLite les désactive par défaut. Sans elles, le
  ///   `ON UPDATE CASCADE` de `prospects.representant_id` — qui porte toute la
  ///   résolution des doublons de représentant — ne se déclenche jamais.
  ///
  /// Fonction de premier niveau et non fermeture : `drift_flutter` l'envoie à
  /// travers un isolat, ce qui interdit de capturer quoi que ce soit.
  static void applyPragmas(CommonDatabase database) {
    database.execute('PRAGMA journal_mode = WAL;');
    database.execute('PRAGMA busy_timeout = 5000;');
    database.execute('PRAGMA foreign_keys = ON;');
  }

  /// v2 — phase 2 : `phase2_directory` et `call_attempts`.
  /// v3 — notifications push : `notifications`.
  /// v4 — référentiel `iefs` et colonne facultative `representants.ief_id`.
  @override
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) async => m.createAll(),
    onUpgrade: (Migrator m, int from, int to) async {
      // Une migration ratée n'est pas une base à recréer : elle emporte les
      // saisies non encore synchronisées, c'est-à-dire une journée de
      // prospection. On crée donc, on ne recrée jamais.
      if (from < 2) {
        await m.createTable(phase2Directory);
        await m.createIndex(phase2DirectoryPhoneUnique);
        await m.createIndex(phase2DirectoryStatusIdx);
        await m.createTable(callAttempts);
        await m.createIndex(callAttemptsProspectIdx);
        await m.createIndex(callAttemptsCreatedIdx);
      }
      if (from < 3) {
        await m.createTable(notifications);
        await m.createIndex(notificationsCreatedIdx);
        await m.createIndex(notificationsUnreadIdx);
      }
      // `to` est testé, et pas seulement `from`. Les paliers précédents ne
      // créaient que des tables neuves, et une table en trop passe inaperçue.
      // Celui-ci AJOUTE UNE COLONNE à une table existante : exécuté lors d'une
      // migration qui ne vise que la v2, il produirait un schéma qui n'est
      // aucune version déclarée. Le test doré l'a attrapé, un appareil ne
      // l'aurait pas signalé.
      if (from < 4 && to >= 4) {
        await m.createTable(iefs);
        await m.createIndex(iefsActiveIdx);
        await m.createIndex(iefsDepartementIdx);
        // Colonne AJOUTÉE, table non recréée : `representants` porte les fiches
        // pas encore synchronisées. Les recréer effacerait une journée de
        // saisie que rien ne pourrait restituer.
        await m.addColumn(representants, representants.iefId);
      }
    },
    beforeOpen: (OpeningDetails details) async {
      // Le connecteur mémoire des tests ne passe pas par `setup:` ; on repose
      // ici les PRAGMAs qui changent un comportement observable, pour que les
      // tests s'exécutent sur la même sémantique que l'appareil.
      await customStatement('PRAGMA foreign_keys = ON;');
      await customStatement('PRAGMA busy_timeout = 5000;');
    },
  );
}
