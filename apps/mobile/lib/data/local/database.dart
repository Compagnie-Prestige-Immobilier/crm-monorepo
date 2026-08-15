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
  ///   `ON UPDATE CASCADE` de `prospects.representant_id` : qui porte toute la
  ///   résolution des doublons de représentant : ne se déclenche jamais.
  ///
  /// Fonction de premier niveau et non fermeture : `drift_flutter` l'envoie à
  /// travers un isolat, ce qui interdit de capturer quoi que ce soit.
  static void applyPragmas(CommonDatabase database) {
    database.execute('PRAGMA journal_mode = WAL;');
    database.execute('PRAGMA busy_timeout = 5000;');
    database.execute('PRAGMA foreign_keys = ON;');
  }

  /// v2 : phase 2 : `phase2_directory` et `call_attempts`.
  /// v3 : notifications push : `notifications`.
  /// v4 : référentiel `iefs` et colonne facultative `representants.ief_id`.
  /// v5 : `outbox.blocked_attempts`, compteur des rejeux non imputables à
  ///      l'opération elle-même (dépendance non résolue, statut inconnu).
  /// v6 : retrait des `CHECK` d'énumération sur les colonnes ALIMENTÉES PAR LE
  ///      SERVEUR (`prospects.statut`, `phase2_directory.phase2_status`,
  ///      `phase2_directory.enrollment_method`, `call_attempts.outcome`,
  ///      `call_attempts.method`).
  /// v7 : `outbox.claim_token`, jeton de possession posé avec le bail. Il rend
  ///      toute écriture d'après-envoi conditionnelle au fait d'être encore le
  ///      propriétaire de la ligne.
  @override
  int get schemaVersion => 7;

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
      // Même précaution qu'au palier précédent : `to` est testé, parce que ce
      // palier AJOUTE UNE COLONNE à `outbox`, la table qui porte les saisies
      // non encore parties. Elle n'est jamais recréée : la recréer viderait la
      // file, c'est-à-dire une journée de prospection.
      //
      // La valeur par défaut est 0, donc les lignes déjà en file repartent avec
      // un compteur de blocage neuf : c'est ce qu'on veut, elles n'ont jamais
      // été comptées.
      if (from < 5 && to >= 5) {
        await m.addColumn(outbox, outbox.blockedAttempts);
      }
      // ═══ v6 : LE SERVEUR A LE DROIT D'AJOUTER UNE VALEUR ═══
      //
      // Les `CHECK … IN (…)` figeaient dans le DDL un vocabulaire que seul le
      // serveur tranche. Un `EnrollmentMethod` de plus, arrivé par
      // `/phase2/directory`, faisait ABORTER l'écriture : la page de 2000 lignes
      // était perdue, le curseur ne bougeait pas, et l'annuaire ne se complétait
      // plus jamais. Même mécanique pour un `ProspectStatut` inconnu dans une
      // page de pull métier, qui emportait la transaction entière.
      //
      // C'est exactement ce que `enumUnknownDefaultCase: true`
      // (`openapi-config.yaml`) existe pour empêcher : le client généré sait
      // accueillir une valeur inconnue, et le stockage la refusait.
      //
      // SQLite ne sait pas retirer un `CHECK` : il faut recréer la table. C'est
      // ce que fait `alterTable`, qui copie les lignes une à une. Les index
      // partent avec l'ancienne table et sont reposés juste après : les oublier
      // produirait une base fonctionnelle en test et des recherches de plusieurs
      // secondes sur 500 000 lignes en production, sans la moindre erreur.
      //
      // Aucune donnée n'est reformatée : les valeurs déjà stockées satisfaisaient
      // les anciens `CHECK`, donc elles satisfont a fortiori leur absence.
      if (from < 6 && to >= 6) {
        // `alterTable` repose LUI-MÊME les index déclarés sur la table : les
        // recréer à la main lève « index already exists » et fait échouer toute
        // la migration. Un test vérifie qu'ils sont bien là après le palier.
        await m.alterTable(TableMigration(prospects));
        await m.alterTable(TableMigration(phase2Directory));
        await m.alterTable(TableMigration(callAttempts));
      }
      // ═══ v7 : UN BAIL NE DIT PAS QUI LE DÉTIENT ═══
      //
      // Même précaution qu'aux paliers v4 et v5, et pour la même raison : ce
      // palier AJOUTE UNE COLONNE à `outbox`, la table qui porte les saisies non
      // encore parties. `addColumn` et jamais `alterTable` : recréer `outbox`
      // viderait la file, c'est-à-dire une journée de prospection.
      //
      // La valeur par défaut est NULL, et c'est exactement ce qu'il faut. Une
      // ligne déjà en `syncing` au moment de la mise à jour n'a pas de jeton :
      // elle est donc traitée comme « possédée par personne », son bail finit
      // par expirer, la récupération la repasse en `pending` et elle repart sous
      // un jeton neuf. Aucune saisie n'est perdue, au pire un envoi est rejoué :
      // ce que la clé d'idempotence sait déjà rapprocher.
      if (from < 7 && to >= 7) {
        await m.addColumn(outbox, outbox.claimToken);
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
