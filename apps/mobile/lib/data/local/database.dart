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
  int get schemaVersion => 22;

  /// Les colonnes ajoutées à `call_attempts` par la v19. Déclarées ici parce
  /// que TROIS paliers recopient cette table : chacun engendre sa forme
  /// COURANTE et irait sinon lire ces colonnes dans une table qui ne les a pas.
  static List<GeneratedColumn<Object>> _renseignementsV19(
    CallAttempts attempts,
  ) => <GeneratedColumn<Object>>[
    attempts.email,
    attempts.fonctionnaire,
    attempts.engagementEnCours,
    attempts.dureeEtablissementMois,
    attempts.rendezVousAt,
  ];

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

  /// La recopie de `prospects`, quel que soit le palier qui la declenche.
  ///
  /// `alterTable` engendre TOUJOURS la forme COURANTE de la table. Toute colonne
  /// ajoutee APRES le palier d'origine doit donc etre declaree ici, sinon la
  /// recopie va la chercher dans une table qui ne l'a pas encore et la migration
  /// echoue. Ce piege a deja coute trois fois sur ce fichier.
  static TableMigration _prospectsCopy(Prospects prospects) => TableMigration(
    prospects,
    newColumns: <GeneratedColumn<Object>>[
      prospects.projet,
      prospects.type,
      prospects.profession,
      prospects.dureeSystemeMois,
      prospects.canalProvenanceId,
    ],
    columnTransformer: <GeneratedColumn<Object>, Expression<Object>>{
      prospects.projet: const Constant<String>('CHUES'),
    },
  );

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
        await m.alterTable(_prospectsCopy(prospects));
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
              ..._renseignementsV19(callAttempts),
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
              newColumns: <GeneratedColumn<Object>>[
                callAttempts.reasonCode,
                ..._renseignementsV19(callAttempts),
              ],
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
      if (from < 13 && to >= 13) {
        // Trois liens relaches et trois colonnes ajoutees : SQLite recree la table.
        await m.alterTable(_prospectsCopy(prospects));
      }
      if (from < 14 && to >= 14) {
        // Table neuve, aucune recopie : rien ici ne peut lire une colonne qui
        // n'existait pas encore au palier d'origine.
        await m.createTable(visites);
        await m.createIndex(visitesDateIdx);
      }
      if (from < 15 && to >= 15) {
        await m.createTable(canauxProvenance);
        await m.createIndex(canauxProvenanceActiveIdx);
        await m.createTable(visiteReferentiels);
        await m.createIndex(visiteReferentielsKindIdx);
        // Venue d'avant la v13, `prospects` y a déjà été recréée dans sa forme
        // courante : les deux colonnes y sont, et les rajouter échouerait.
        if (from >= 13) {
          await m.addColumn(prospects, prospects.dureeSystemeMois);
          await m.addColumn(prospects, prospects.canalProvenanceId);
        }
        await m.createTable(prospectJourneys);
        await m.createIndex(prospectJourneysProjetIdx);
        // Les fiches déjà sur l'appareil n'ont aucun parcours : sans cette
        // reprise, elles disparaîtraient toutes des deux listes de projet à la
        // mise à jour. Leur colonne `projet` dit par où elles sont entrées.
        // Une fiche supprimée n'a pas de parcours à rouvrir.
        await customStatement(
          'INSERT INTO prospect_journeys (prospect_id, projet, statut) '
          'SELECT id, projet, statut FROM prospects WHERE deleted_at IS NULL',
        );
      }
      if (from < 16 && to >= 16) {
        // Sert le filtre par entreprise sur la période « Tout » de
        // l'historique de l'accueil. Additif : rien à recopier.
        await m.createIndex(visitesEntrepriseDateIdx);
      }
      if (from < 18 && to >= 18) {
        await m.createTable(repCallbackReminders);
        await m.createIndex(repCallbackRemindersPendingIdx);
      }
      if (from < 19 && to >= 19) {
        // Recopie et non `addColumn` : le palier ajoute aussi trois CHECK, que
        // `ALTER TABLE ADD COLUMN` ne sait pas poser. Venue d'avant la v10, la
        // table a déjà été recréée plus haut dans sa forme courante.
        if (from >= 10) {
          await m.alterTable(
            TableMigration(
              callAttempts,
              newColumns: _renseignementsV19(callAttempts),
            ),
          );
        }
      }
      if (from < 20 && to >= 20) {
        await customStatement('DROP TABLE IF EXISTS call_tasks');
        await customStatement('DROP TABLE IF EXISTS call_campaigns');
        await customStatement('DROP TABLE IF EXISTS rep_call_tasks');
        await customStatement('DROP TABLE IF EXISTS rep_call_campaigns');
      }
      if (from < 21 && to >= 21) {
        await m.createTable(incomeBands);
        await m.createIndex(incomeBandsActiveIdx);
        // Comme à la v8 : le pull est un curseur keyset, et un appareil déjà
        // mis au miroir ne redemande plus la liste entière. Sans ce marqueur
        // effacé, la table neuve resterait vide à vie et le revenu mensuel,
        // désormais obligatoire, serait impossible à choisir.
        await customStatement(
          'DELETE FROM sync_state WHERE collection = \'referentiels_mirror\'',
        );
      }
      if (from < 22 && to >= 22) {
        // `representants` n'a jamais été recréée par un palier antérieur : les
        // cinq colonnes du script s'ajoutent donc sans condition. Toutes
        // nullables : une fiche déjà en base n'a jamais été qualifiée par ce
        // script, et son absence de réponse ne doit rien affirmer.
        await m.addColumn(representants, representants.prenom);
        await m.addColumn(representants, representants.etablissement);
        await m.addColumn(representants, representants.syndicat);
        await m.addColumn(representants, representants.connaitUes);
        await m.addColumn(representants, representants.contacte);
      }
    },
    beforeOpen: (OpeningDetails details) async {
      await customStatement('PRAGMA foreign_keys = ON;');
      await customStatement('PRAGMA busy_timeout = 5000;');
    },
  );
}
