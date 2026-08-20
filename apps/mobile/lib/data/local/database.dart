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
  int get schemaVersion => 12;

  /// L'effet d'une tentative saisie avant la v10, déduit de son issue. Sans
  /// cette dérivation, la recopie de table poserait le défaut `KEEP_OPEN`
  /// partout : la progression personnelle du téléconseiller repartirait à zéro,
  /// puisqu'elle se compte désormais sur l'effet.
  static const CustomExpression<String> _effectFromOutcome =
      CustomExpression<String>(
        'CASE outcome '
        'WHEN \'METHOD_OBTAINED\' THEN \'CLOSE_METHOD\' '
        'WHEN \'REFUSED\' THEN \'CLOSE_REFUSED\' '
        'WHEN \'WRONG_NUMBER\' THEN \'CLOSE_WRONG_NUMBER\' '
        'WHEN \'CALLBACK\' THEN \'SCHEDULE_CALLBACK\' '
        'ELSE \'KEEP_OPEN\' END',
      );

  static const CustomExpression<bool> _commentRequiredFromOutcome =
      CustomExpression<bool>('CASE WHEN outcome = \'OTHER\' THEN 1 ELSE 0 END');

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
        // `callbackAt` et `reasonCode` n'existent pas encore à la v6 : sans les
        // déclarer neufs, la recopie irait les lire dans l'ancienne table.
        // `effect` et `requiresComment` non plus, mais eux se DÉDUISENT de
        // l'issue, sans quoi la recopie les poserait à leur défaut.
        await m.alterTable(
          TableMigration(
            callAttempts,
            newColumns: <GeneratedColumn<Object>>[
              callAttempts.callbackAt,
              callAttempts.reasonCode,
            ],
            columnTransformer: <GeneratedColumn<Object>, Expression<Object>>{
              callAttempts.effect: _effectFromOutcome,
              callAttempts.requiresComment: _commentRequiredFromOutcome,
            },
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
        await customStatement(
          'DELETE FROM sync_state WHERE collection = \'all\'',
        );
      }
      if (from < 9 && to >= 9) {
        await m.createTable(representantComments);
        await m.createIndex(representantCommentsRepresentantIdx);
      }
      if (from < 10 && to >= 10) {
        await m.createTable(callOutcomeReasons);
        await m.createIndex(callOutcomeReasonsActiveIdx);
        // Les CHECK de `call_attempts` citaient des issues littérales : les
        // remplacer par des règles sur l'effet suppose de RECRÉER la table.
        // Venue d'avant la v6, elle a déjà été recréée plus haut, donc dans sa
        // forme courante : la refaire ici serait un double travail, et
        // `callbackAt` y serait alors déclaré neuf donc effacé.
        if (from >= 6) {
          await m.alterTable(
            TableMigration(
              callAttempts,
              newColumns: <GeneratedColumn<Object>>[callAttempts.reasonCode],
              columnTransformer: <GeneratedColumn<Object>, Expression<Object>>{
                callAttempts.effect: _effectFromOutcome,
                callAttempts.requiresComment: _commentRequiredFromOutcome,
              },
            ),
          );
        }
      }
      if (from < 11 && to >= 11) {
        // `representants` n'a jamais été recréée par un palier antérieur : les
        // trois colonnes s'ajoutent donc sans condition.
        await m.addColumn(representants, representants.whatsappStatus);
        await m.addColumn(representants, representants.whatsappE164);
        await m.addColumn(representants, representants.profession);
      }
      if (from < 12 && to >= 12) {
        // Deux tables neuves, aucune recopie : rien ici ne peut lire une colonne
        // qui n'existait pas encore au palier d'origine.
        await m.createTable(callCampaigns);
        await m.createTable(callTasks);
        await m.createIndex(callTasksCampaignIdx);
        await m.createIndex(callTasksProspectIdx);
      }
    },
    beforeOpen: (OpeningDetails details) async {
      await customStatement('PRAGMA foreign_keys = ON;');
      await customStatement('PRAGMA busy_timeout = 5000;');
    },
  );
}
