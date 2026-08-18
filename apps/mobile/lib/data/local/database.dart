import 'package:drift/drift.dart';
import 'package:sqlite3/common.dart';

part 'database.g.dart';

@DriftDatabase(include: <String>{'schema.drift'})
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.executor);

  static void applyPragmas(CommonDatabase database) {
    database.execute('PRAGMA journal_mode = WAL;');
    database.execute('PRAGMA busy_timeout = 5000;');
    database.execute('PRAGMA foreign_keys = ON;');
  }

  @override
  int get schemaVersion => 9;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (Migrator m) async => m.createAll(),
    onUpgrade: (Migrator m, int from, int to) async {
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
      if (from < 4 && to >= 4) {
        await m.createTable(iefs);
        await m.createIndex(iefsActiveIdx);
        await m.createIndex(iefsDepartementIdx);
        await m.addColumn(representants, representants.iefId);
      }
      if (from < 5 && to >= 5) {
        await m.addColumn(outbox, outbox.blockedAttempts);
      }
      if (from < 6 && to >= 6) {
        await m.alterTable(TableMigration(prospects));
        await m.alterTable(TableMigration(phase2Directory));
        // `callbackAt` n'existe pas encore à la v6 : sans le déclarer neuf, la
        // recopie irait le lire dans l'ancienne table.
        await m.alterTable(
          TableMigration(
            callAttempts,
            newColumns: <GeneratedColumn<Object>>[callAttempts.callbackAt],
          ),
        );
      }
      if (from < 7 && to >= 7) {
        await m.addColumn(outbox, outbox.claimToken);
      }
      if (from < 8 && to >= 8) {
        await m.addColumn(departements, departements.regionName);
        await m.createIndex(departementsRegionIdx);
        await m.addColumn(representants, representants.relationStatus);
        // Venu d'avant la v6, `call_attempts` a été RECRÉÉ juste au-dessus, donc
        // déjà dans sa forme courante : la colonne y est.
        if (from >= 6) await m.addColumn(callAttempts, callAttempts.callbackAt);
        // Le pull est un curseur keyset sur `updatedAt` : un département déjà en
        // base ne redescend plus jamais, et `region_name` resterait vide à vie
        // sur les appareils existants. Effacer le curseur force un pull complet.
        // Le référentiel n'est jamais écrit localement : rien à perdre.
        await customStatement('DELETE FROM sync_state WHERE collection = \'all\'');
      }
      if (from < 9 && to >= 9) {
        await m.createTable(representantComments);
        await m.createIndex(representantCommentsRepresentantIdx);
      }
    },
    beforeOpen: (OpeningDetails details) async {
      await customStatement('PRAGMA foreign_keys = ON;');
      await customStatement('PRAGMA busy_timeout = 5000;');
    },
  );
}
