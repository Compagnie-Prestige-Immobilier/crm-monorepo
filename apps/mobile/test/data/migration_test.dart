import 'package:cpi_go/data/local/database.dart';
import 'package:drift/drift.dart' show QueryRow;
import 'package:drift/native.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'generated_migrations/schema.dart';
import 'generated_migrations/schema_v1.dart' as v1;
import 'generated_migrations/schema_v2.dart' as v2;
import 'generated_migrations/schema_v3.dart' as v3;
import 'generated_migrations/schema_v4.dart' as v4;
import 'generated_migrations/schema_v5.dart' as v5;
import 'generated_migrations/schema_v6.dart' as v6;
import 'generated_migrations/schema_v7.dart' as v7;
import 'generated_migrations/schema_v8.dart' as v8;

/// Test doré de migration.
///
/// Ce test existe pour une raison précise : sur un appareil de terrain, la base
/// locale contient des saisies **non encore synchronisées**. Une migration
/// ratée n'est pas une base à recréer, c'est une journée de prospection perdue,
/// et personne ne s'en apercevra avant que le commercial ne rentre.
///
/// Le fichier `drift_schemas/drift_schema_v1.json` est le contrat. Chaque
/// évolution du schéma se fait en trois temps :
///
/// ```sh
/// # 1. incrémenter `schemaVersion` dans database.dart et écrire l'étape dans
/// #    `MigrationStrategy.onUpgrade`
/// dart run drift_dev schema dump lib/data/local/database.dart drift_schemas/
/// dart run drift_dev schema generate drift_schemas/ test/data/generated_migrations/
/// # 2. ajouter le palier ci-dessous
/// # 3. flutter test
/// ```
///
/// Sauter l'étape 1 fait passer le test tout en cassant les appareils réels :
/// le golden décrirait alors le nouveau schéma, et le test comparerait le
/// schéma à lui-même.
void main() {
  late SchemaVerifier verifier;

  setUpAll(() {
    verifier = SchemaVerifier(GeneratedHelper());
  });

  test('le golden décrit exactement le schéma courant', () async {
    // Vérifie qu'une base créée de zéro par `Migrator.createAll()` correspond
    // au dernier golden. C'est ce qui attrape le cas « j'ai modifié
    // schema.drift et oublié de redumper ».
    final AppDatabase db = AppDatabase(NativeDatabase.memory());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);
    await db.close();
  });

  test('le golden couvre toutes les versions déclarées', () {
    final AppDatabase db = AppDatabase(NativeDatabase.memory());
    expect(
      GeneratedHelper.versions,
      contains(db.schemaVersion),
      reason:
          'schemaVersion a bougé sans nouveau dump : '
          'dart run drift_dev schema dump lib/data/local/database.dart drift_schemas/',
    );
    db.close();
  });

  // ── v1 → v2 : phase 2 ──────────────────────────────────────────────────────
  //
  // Le palier n'ajoute que deux tables. C'est précisément pour cela qu'il doit
  // être testé avec des données : une migration additive est celle qu'on écrit
  // le plus vite et celle où l'on oublie le plus facilement un index : un
  // `createTable` sans son `createIndex` produit une base qui fonctionne en test
  // et qui met plusieurs secondes par recherche sur 500 000 lignes en
  // production, sans jamais lever d'erreur.

  // ═══ POURQUOI CES DEUX PALIERS VALIDENT À LA VERSION COURANTE ═══
  //
  // `Migrator.createTable` engendre TOUJOURS la définition courante d'une table,
  // jamais celle de la version visée : drift n'a pas de mémoire des formes
  // passées. Tant qu'une table créée en v2 n'a plus jamais bougé, valider à la
  // v2 fonctionne ; depuis que la v6 retire les `CHECK` d'énumération de
  // `phase2_directory`, une migration 1 → 2 produit la forme de la v6, ce qui est
  // le comportement CORRECT sur un appareil réel (il finit toujours à la version
  // courante) mais ne correspond plus au doré de la v2.
  //
  // On valide donc à la version courante et on garde intactes les assertions qui
  // portent réellement le risque : la saisie non synchronisée a-t-elle traversé,
  // et les index sont-ils là.
  test('v1 -> v2 conserve les saisies non synchronisées', () async {
    final schema = await verifier.schemaAt(1);

    // Une journée de terrain à l'ancienne version : un représentant et
    // l'opération d'outbox qui n'est jamais partie.
    //
    // Insertions en SQL brut et non par companion : `drift_dev schema generate`
    // produit des tables non typées (`Table with TableInfo`, sans classe de
    // données), parce qu'un golden décrit une FORME et pas un modèle objet. Le
    // SQL est ici la seule écriture possible, et accessoirement la plus fidèle à
    // ce qu'une vraie base de v1 contient.
    final v1.DatabaseAtV1 old = v1.DatabaseAtV1(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'rep-1',
        'Représentant hors ligne',
        '+221771234567',
        'dep-1',
        'me',
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'op-1',
        'representant',
        'rep-1',
        'create',
        '{"fullName":"Représentant hors ligne"}',
        _iso,
        _iso,
      ],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    // La saisie a traversé.
    final List<QueryRow> representants = await db
        .customSelect('SELECT id FROM representants')
        .get();
    expect(representants.map((QueryRow r) => r.read<String>('id')), <String>['rep-1']);
    final List<QueryRow> pending = await db
        .customSelect('SELECT id FROM outbox WHERE status = \'pending\'')
        .get();
    expect(pending, hasLength(1));

    // Les deux tables de phase 2 existent et sont vides : un annuaire ne se
    // fabrique pas par migration, il se télécharge.
    final List<QueryRow> directory = await db
        .customSelect('SELECT COUNT(*) AS c FROM phase2_directory')
        .get();
    expect(directory.single.read<int>('c'), 0);
    final List<QueryRow> attempts = await db
        .customSelect('SELECT COUNT(*) AS c FROM call_attempts')
        .get();
    expect(attempts.single.read<int>('c'), 0);

    await db.close();
  });

  test('v1 -> v2 crée les index de l\'annuaire, pas seulement les tables', () async {
    final schema = await verifier.schemaAt(1);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name IN (\'phase2_directory\', \'call_attempts\')',
        )
        .get();
    final Set<String> names = indexes.map((QueryRow r) => r.read<String>('name')).toSet();

    // `phase2_directory_phone_unique` est le seul index qui rende la recherche
    // par téléphone tenable : sans lui, chaque numéro tapé déclenche un balayage
    // complet de l'annuaire : des secondes par appel sur un téléphone d'entrée
    // de gamme, multipliées par la pile de numéros de la journée.
    expect(names, contains('phase2_directory_phone_unique'));
    expect(names, contains('phase2_directory_status_idx'));
    expect(names, contains('call_attempts_prospect_idx'));
    expect(names, contains('call_attempts_created_idx'));

    await db.close();
  });

  // ── v2 → v3 : notifications push ───────────────────────────────────────────
  //
  // Même piège qu'au palier précédent, et il vaut la peine d'être répété : un
  // `createTable` sans son `createIndex` passe tous les tests fonctionnels et
  // ne se remarque qu'en production, sous forme de lenteur inexpliquée.

  test('v2 -> v3 ajoute la boîte de réception sans toucher au reste', () async {
    final schema = await verifier.schemaAt(2);

    // Une base de v2 avec une saisie encore en file : c'est elle qui ne doit
    // rien perdre.
    final v2.DatabaseAtV2 old = v2.DatabaseAtV2(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-9', 'representant', 'rep-9', 'create', '{}', _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 3);

    final List<QueryRow> pending = await db
        .customSelect('SELECT id FROM outbox WHERE status = \'pending\'')
        .get();
    expect(
      pending,
      hasLength(1),
      reason: 'la file ne doit pas être vidée par une migration',
    );

    // La table existe et démarre vide : un historique de notifications ne se
    // fabrique pas par migration, il se retélécharge.
    final List<QueryRow> inbox = await db
        .customSelect('SELECT COUNT(*) AS c FROM notifications')
        .get();
    expect(inbox.single.read<int>('c'), 0);

    await db.close();
  });

  test('v2 -> v3 crée les index de la boîte de réception', () async {
    final schema = await verifier.schemaAt(2);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 3);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name = \'notifications\'',
        )
        .get();
    final Set<String> names = indexes.map((QueryRow r) => r.read<String>('name')).toSet();

    // `notifications_unread_idx` sert la pastille de l'AppBar, relue à chaque
    // changement de la table.
    expect(names, contains('notifications_created_idx'));
    expect(names, contains('notifications_unread_idx'));

    await db.close();
  });

  // ── v3 → v4 : référentiel IEF ──────────────────────────────────────────────
  //
  // Ce palier est le premier à AJOUTER UNE COLONNE à une table qui contient
  // déjà des saisies. Les précédents ne créaient que des tables neuves, où rien
  // ne pouvait être perdu. Ici la table `representants` porte des fiches pas
  // encore synchronisées : la recréer les emporterait, et l'appareil ne dirait
  // rien. C'est exactement le scénario que ce fichier existe pour interdire.

  test('v3 -> v4 ajoute ief_id SANS toucher aux fiches non synchronisées', () async {
    final schema = await verifier.schemaAt(3);

    // Une base de v3 avec une fiche saisie hors ligne et son opération en file.
    final v3.DatabaseAtV3 old = v3.DatabaseAtV3(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK-DAK', 'Dakar', 'reg-1', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['rep-4', 'Fiche hors ligne', '+221771112233', 'dep-1', 'me', _iso, _iso],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-4', 'representant', 'rep-4', 'create', '{}', _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 4);

    // La fiche a traversé, et son opération aussi.
    final List<QueryRow> fiches = await db
        .customSelect('SELECT id, ief_id FROM representants')
        .get();
    expect(fiches, hasLength(1));
    expect(fiches.single.read<String>('id'), 'rep-4');
    expect(
      fiches.single.read<String?>('ief_id'),
      isNull,
      reason: 'une fiche ancienne n’a pas d’IEF, et ce n’est pas une erreur',
    );


    final List<QueryRow> pending = await db
        .customSelect('SELECT id FROM outbox WHERE status = \'pending\'')
        .get();
    expect(pending, hasLength(1));

    // La table des IEF existe et démarre vide : un référentiel ne se fabrique
    // pas par migration, il se télécharge.
    final List<QueryRow> iefs = await db
        .customSelect('SELECT COUNT(*) AS c FROM iefs')
        .get();
    expect(iefs.single.read<int>('c'), 0);

    // ═══ LA COLONNE EST-ELLE UTILISABLE, ET PAS SEULEMENT PRÉSENTE ? ═══
    //
    // Le test s'arrêtait à « la colonne existe et vaut NULL ». Une colonne
    // ajoutée sans sa clé étrangère, ou avec un type incompatible, aurait passé
    // cette assertion et cassé la première fiche saisie après la mise à jour.
    // On écrit donc réellement dedans, à travers la clé étrangère.
    await db.customStatement(
      'INSERT INTO iefs '
      '(id, code, name, departement_id, departement_name, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['ief-1', 'IEF-DK1', 'IEF Dakar 1', 'dep-1', 'Dakar', _iso],
    );
    await db.customStatement(
      'UPDATE representants SET ief_id = ? WHERE id = ?',
      <Object?>['ief-1', 'rep-4'],
    );
    final List<QueryRow> rattachee = await db
        .customSelect('SELECT ief_id FROM representants WHERE id = \'rep-4\'')
        .get();
    expect(
      rattachee.single.read<String?>('ief_id'),
      'ief-1',
      reason: 'la colonne doit être ÉCRITE, pas seulement présente',
    );

    await db.close();
  });

  test('v3 -> v4 crée les index des IEF', () async {
    final schema = await verifier.schemaAt(3);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 4);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name = \'iefs\'',
        )
        .get();
    final Set<String> names = indexes.map((QueryRow r) => r.read<String>('name')).toSet();

    // `iefs_active_idx` sert le sélecteur de saisie, relu à chaque frappe ;
    // `iefs_departement_idx` sert la restriction au département choisi.
    expect(names, contains('iefs_active_idx'));
    expect(names, contains('iefs_departement_idx'));

    await db.close();
  });

  // ── v4 → v5 : compteur de rejeux bloqués ───────────────────────────────────
  //
  // Le palier ajoute une colonne à `outbox` : LA table qui porte les saisies
  // pas encore parties. La recréer viderait la file, c'est-à-dire une journée
  // de prospection, et l'appareil ne dirait rien.

  test('v4 -> v5 ajoute blocked_attempts SANS vider la file', () async {
    final schema = await verifier.schemaAt(4);

    final v4.DatabaseAtV4 old = v4.DatabaseAtV4(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, attempts, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-5', 'representant', 'rep-5', 'create', '{}', 3, _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 5);

    final List<QueryRow> rows = await db
        .customSelect('SELECT id, attempts, blocked_attempts FROM outbox')
        .get();
    expect(rows, hasLength(1), reason: 'la file ne doit pas être vidée');
    expect(rows.single.read<int>('attempts'), 3, reason: 'le compteur serveur survit');
    expect(
      rows.single.read<int>('blocked_attempts'),
      0,
      reason: 'une ligne ancienne n’a jamais été bloquée : elle repart à zéro',
    );

    await db.close();
  });

  // ── v5 → v6 : retrait des CHECK d'énumération ──────────────────────────────
  //
  // Le premier palier qui RECRÉE des tables portant des données. Il doit donc
  // prouver deux choses opposées : que rien n'est perdu, et que la contrainte
  // qu'on voulait retirer l'est réellement.
  //
  // Ces trois-là valident à la version courante pour la raison énoncée plus
  // haut : `alterTable` recrée `call_attempts` dans sa forme COURANTE, laquelle
  // porte `callback_at` depuis la v8. Une base de v5 ne s'arrête donc plus à la
  // forme de la v6, et c'est le comportement de l'appareil réel.

  test('v5 -> v6 accepte une valeur d\'énumération que ce client ignore', () async {
    final schema = await verifier.schemaAt(5);

    final v5.DatabaseAtV5 old = v5.DatabaseAtV5(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO phase2_directory '
      '(prospect_id, phone_e164, phase2_status, rev, updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['p-1', '+221771112233', 'PENDING', 1, _iso],
    );
    // Sous v5, cette écriture est REFUSÉE par le CHECK : c'est le défaut.
    await expectLater(
      old.customStatement(
        'INSERT INTO phase2_directory '
        '(prospect_id, phone_e164, phase2_status, rev, updated_at) '
        'VALUES (?, ?, ?, ?, ?)',
        <Object?>['p-2', '+221771112244', 'ESCALATED', 1, _iso],
      ),
      throwsA(anything),
      reason: 'c\'est bien le CHECK de v5 qui bloquait la page de pull entière',
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    // Rien n'a été perdu par la recréation de table.
    final List<QueryRow> kept = await db
        .customSelect('SELECT prospect_id, phase2_status FROM phase2_directory')
        .get();
    expect(kept, hasLength(1));
    expect(kept.single.read<String>('phase2_status'), 'PENDING');

    // Et la valeur inconnue passe désormais : c'est tout l'objet du palier.
    await db.customStatement(
      'INSERT INTO phase2_directory '
      '(prospect_id, phone_e164, phase2_status, enrollment_method, rev, updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['p-2', '+221771112244', 'ESCALATED', 'USSD', 1, _iso],
    );
    final List<QueryRow> after = await db
        .customSelect('SELECT COUNT(*) AS c FROM phase2_directory')
        .get();
    expect(after.single.read<int>('c'), 2);

    await db.close();
  });

  test('v5 -> v6 repose les index des tables recréées', () async {
    final schema = await verifier.schemaAt(5);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master WHERE type = \'index\' '
          'AND tbl_name IN (\'prospects\', \'phase2_directory\', \'call_attempts\')',
        )
        .get();
    final Set<String> names = indexes.map((QueryRow r) => r.read<String>('name')).toSet();

    // Recréer une table emporte ses index avec elle. Les oublier ne casse
    // aucun test fonctionnel : ça rend seulement chaque recherche de numéro
    // linéaire sur 500 000 lignes, en production, sans jamais lever d'erreur.
    expect(names, contains('prospects_phone_unique'));
    expect(names, contains('prospects_representant_idx'));
    expect(names, contains('prospects_created_idx'));
    expect(names, contains('phase2_directory_phone_unique'));
    expect(names, contains('phase2_directory_status_idx'));
    expect(names, contains('call_attempts_prospect_idx'));
    expect(names, contains('call_attempts_created_idx'));

    await db.close();
  });

  test('v5 -> v6 garde les CHECK de FORME de call_attempts', () async {
    final schema = await verifier.schemaAt(5);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    // Ce qui a été retiré, c'est la LISTE de vocabulaire. Les trois règles
    // structurelles du serveur : méthode ssi METHOD_OBTAINED, OTHER exige un
    // commentaire, commentaire borné : restent vraies quelle que soit l'issue
    // que le serveur ajoutera, et doivent survivre à la recréation de table.
    await expectLater(
      db.customStatement(
        'INSERT INTO call_attempts '
        '(id, prospect_id, outcome, method, client_created_at, created_by_id) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        <Object?>['a-1', 'p-1', 'CALLBACK', 'PLATFORM', _iso, 'me'],
      ),
      throwsA(anything),
      reason: 'une méthode sur une issue non terminale reste refusée',
    );
    await expectLater(
      db.customStatement(
        'INSERT INTO call_attempts '
        '(id, prospect_id, outcome, client_created_at, created_by_id) '
        'VALUES (?, ?, ?, ?, ?)',
        <Object?>['a-2', 'p-1', 'OTHER', _iso, 'me'],
      ),
      throwsA(anything),
      reason: 'OTHER sans commentaire reste refusé',
    );
    // Mais une issue INCONNUE de ce client passe maintenant.
    await db.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['a-3', 'p-1', 'ESCALATED', _iso, 'me'],
    );

    await db.close();
  });

  // ── v6 → v7 : le jeton de possession ───────────────────────────────────────
  //
  // Ce palier ajoute une colonne à `outbox`, la table qui porte les saisies non
  // encore parties. C'est le palier le plus dangereux du fichier : `alterTable`
  // au lieu d'`addColumn`, et c'est une journée de prospection qui disparaît.

  test('v6 -> v7 ajoute claim_token sans toucher à la file', () async {
    final schema = await verifier.schemaAt(6);

    // Une file de fin de journée : une opération qui attend, et une qui était
    // EN VOL au moment de la mise à jour de l'application.
    final v6.DatabaseAtV6 old = v6.DatabaseAtV6(schema.newConnection());
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, attempts, blocked_attempts, '
      ' status, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-1', 'prospect', 'pro-1', 'create', '{"nom":"Diop"}', 3, 1, 'pending', _iso, _iso],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, attempts, blocked_attempts, '
      ' status, next_attempt_at, lease_until, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-2', 'representant', 'rep-1', 'update', '{}', 0, 0, 'syncing', _iso, _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 7);

    final List<QueryRow> queue = await db
        .customSelect(
          'SELECT id, payload, attempts, blocked_attempts, status, claim_token '
          'FROM outbox ORDER BY seq',
        )
        .get();
    expect(queue, hasLength(2), reason: 'la file traverse le palier intacte');
    expect(queue.first.read<String>('payload'), '{"nom":"Diop"}');
    expect(queue.first.read<int>('attempts'), 3);
    expect(queue.first.read<int>('blocked_attempts'), 1);

    // La colonne existe et vaut NULL partout, y compris sur la ligne qui était
    // en vol. C'est voulu : « possédée par personne ». Son bail finira par
    // expirer, la récupération la repassera en `pending` et elle repartira sous
    // un jeton neuf. Au pire un envoi rejoué, que la clé d'idempotence sait
    // rapprocher ; jamais une saisie perdue.
    for (final QueryRow row in queue) {
      expect(row.read<String?>('claim_token'), isNull);
    }
    expect(queue.last.read<String>('status'), 'syncing');

    await db.close();
  });

  // ── v7 → v8 : l'heure de rappel, la région, la relation ────────────────────
  //
  // Le seul palier du fichier qui EFFACE quelque chose. Il doit prouver deux
  // choses : que la remise à zéro du curseur ne prend que le curseur, et que la
  // colonne ajoutée à `call_attempts` n'y ajoute AUCUNE contrainte : un
  // « À rappeler » sans heure doit continuer de s'enregistrer hors ligne.

  test('v7 -> v8 ajoute les trois colonnes sans contraindre la saisie', () async {
    final schema = await verifier.schemaAt(7);

    final v7.DatabaseAtV7 old = v7.DatabaseAtV7(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['rep-1', 'Awa Ndiaye', '+221771234567', 'dep-1', 'me', _iso, _iso],
    );
    await old.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['a-1', 'p-1', 'CALLBACK', _iso, 'me'],
    );
    // Le curseur de pull, et le verrou de rafraîchissement de jeton qui vit dans
    // la MÊME table : le palier ne doit emporter que le premier.
    await old.customStatement(
      'INSERT INTO sync_state (collection, cursor, last_pulled_at) VALUES (?, ?, ?)',
      <Object?>['all', 'eyJ1cGRhdGVkQXQiOiIyMDI2LTA4LTAxIn0=', _iso],
    );
    await old.customStatement(
      'INSERT INTO sync_state (collection, cursor, last_pulled_at) VALUES (?, ?, ?)',
      <Object?>['phase2_directory', 'p2-cursor', _iso],
    );
    await old.customStatement(
      'INSERT INTO sync_state (collection, last_pulled_at) VALUES (?, ?)',
      <Object?>['@lock:auth.refresh', _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 8);

    // Les libellés dénormalisés arrivent VIDES : le serveur ne les a pas encore
    // renvoyés, et c'est ce vide qui masque l'étape « Région ».
    final List<QueryRow> departements = await db
        .customSelect('SELECT region_name FROM departements')
        .get();
    expect(departements.single.read<String>('region_name'), '');

    // La relation est en lecture seule et vient du serveur : la valeur par
    // défaut est celle qu'il donne à une fiche jamais qualifiée.
    final List<QueryRow> representants = await db
        .customSelect('SELECT relation_status FROM representants')
        .get();
    expect(representants.single.read<String>('relation_status'), 'INCONNU');

    // La tentative d'avant le palier a traversé, sans heure de rappel.
    final List<QueryRow> attempts = await db
        .customSelect('SELECT id, callback_at FROM call_attempts')
        .get();
    expect(attempts.single.read<String>('id'), 'a-1');
    expect(attempts.single.read<String?>('callback_at'), isNull);

    // ═══ LE PIÈGE DU PALIER ═══
    //
    // `callbackAt` est FACULTATIF côté serveur, exprès : les téléphones déjà
    // déployés poussent des « À rappeler » sans date. Un CHECK liant l'heure à
    // l'issue ferait échouer CET INSERT, hors ligne, sur le terrain.
    await db.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['a-2', 'p-1', 'CALLBACK', _iso, 'me'],
    );
    await db.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, callback_at, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['a-3', 'p-1', 'CALLBACK', _iso, _iso, 'me'],
    );

    // Le curseur du référentiel est effacé : sans cela, aucun département déjà
    // en base ne redescendrait, et `region_name` resterait vide à vie.
    final List<QueryRow> cursors = await db
        .customSelect('SELECT collection, cursor FROM sync_state ORDER BY collection')
        .get();
    expect(
      cursors.map((QueryRow r) => r.read<String>('collection')),
      <String>['@lock:auth.refresh', 'phase2_directory'],
      reason: 'seul le curseur du référentiel est remis à zéro',
    );

    await db.close();
  });

  // ── v8 → v9 : le fil de commentaires ───────────────────────────────────────
  //
  // Palier purement additif : aucune donnée ne peut être perdue. Ce qui peut
  // l'être, c'est la clé étrangère et l'index, qu'un `createTable` seul ne
  // rendrait pas visibles : la table existerait, le fil marcherait en test, et
  // un commentaire pourrait rester attaché à une fiche disparue.

  test('v8 -> v9 ajoute le fil sans toucher aux saisies en file', () async {
    final schema = await verifier.schemaAt(8);

    final v8.DatabaseAtV8 old = v8.DatabaseAtV8(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['rep-1', 'Awa Ndiaye', '+221771234567', 'dep-1', 'me', _iso, _iso],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-1', 'representant', 'rep-1', 'create', '{}', _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 9);

    final List<QueryRow> pending = await db
        .customSelect('SELECT id FROM outbox WHERE status = \'pending\'')
        .get();
    expect(pending, hasLength(1), reason: 'la file ne doit pas être vidée');

    // Le fil démarre vide, et il s'ÉCRIT : « la table existe » se vérifierait
    // aussi sur une table inutilisable.
    await db.customStatement(
      'INSERT INTO representant_comments '
      '(id, representant_id, author_id, author_name, body, client_created_at) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['c-1', 'rep-1', 'me', 'Awa Sy', 'Rappeler après 15 h.', _iso],
    );
    final List<QueryRow> fil = await db
        .customSelect('SELECT body, server_created_at FROM representant_comments')
        .get();
    expect(fil.single.read<String>('body'), 'Rappeler après 15 h.');
    expect(fil.single.read<String?>('server_created_at'), isNull);

    await expectLater(
      db.customStatement(
        'INSERT INTO representant_comments '
        '(id, representant_id, author_id, author_name, body, client_created_at) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        <Object?>['c-2', 'fiche-absente', 'me', 'Awa Sy', 'Orphelin.', _iso],
      ),
      throwsA(anything),
      reason: 'la clé étrangère est posée, pas seulement la table',
    );

    // PAS de colonne `rev` : le fil est en ajout seul. En poser une ferait
    // écrire un arbitrage dernier-écrivain que rien ne peut déclencher.
    final List<QueryRow> columns = await db
        .customSelect('PRAGMA table_info(representant_comments)')
        .get();
    expect(columns.map((QueryRow r) => r.read<String>('name')).toSet(), <String>{
      'id',
      'representant_id',
      'author_id',
      'author_name',
      'body',
      'client_created_at',
      'server_created_at',
    });

    await db.close();
  });

  test('v8 -> v9 crée l\'index du fil', () async {
    final schema = await verifier.schemaAt(8);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 9);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name = \'representant_comments\'',
        )
        .get();
    final Set<String> names = indexes.map((QueryRow r) => r.read<String>('name')).toSet();

    // Le fil est relu à chaque ouverture de fiche et à chaque publication.
    expect(names, contains('representant_comments_representant_idx'));

    await db.close();
  });

  // ── Le saut de plusieurs versions ──────────────────────────────────────────
  //
  // Chaque test ci-dessus ne franchit qu'UN palier. Or un commercial qui n'a pas
  // mis à jour depuis deux mois saute trois ou quatre versions d'un coup, et
  // c'est le seul chemin que personne ne parcourt en développement : la machine
  // de l'équipe est toujours à la version précédente. Les paliers v4 et v5 sont
  // gardés par `to >= n` précisément parce qu'une composition mal ordonnée
  // produit un schéma qui n'est AUCUNE version déclarée.

  test('v1 -> v9 d\'un seul coup : deux mois sans mise à jour', () async {
    final schema = await verifier.schemaAt(1);

    final v1.DatabaseAtV1 old = v1.DatabaseAtV1(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
    );
    await old.customStatement(
      'INSERT INTO banques (id, name, short_name, local_updated_at) '
      'VALUES (?, ?, ?, ?)',
      <Object?>['bq-1', 'Banque Test', 'BT', _iso],
    );
    await old.customStatement(
      'INSERT INTO syndicats (id, name, sigle, local_updated_at) '
      'VALUES (?, ?, ?, ?)',
      <Object?>['sy-1', 'Syndicat Test', 'ST', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['rep-1', 'Awa Ndiaye', '+221771234567', 'dep-1', 'me', _iso, _iso],
    );
    // Un prospect : c'est SA table que le palier v6 recrée, et il porte une
    // clé étrangère vers le représentant.
    await old.customStatement(
      'INSERT INTO prospects '
      '(id, nom, prenom, phone_e164, banque_id, syndicat_id, representant_id, '
      ' created_by_id, statut, client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'pro-1',
        'Diop',
        'Moussa',
        '+221771112299',
        'bq-1',
        'sy-1',
        'rep-1',
        'me',
        'CONTACTE',
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, attempts, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-1', 'prospect', 'pro-1', 'create', '{}', 2, _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    // UN SEUL appel, de 1 à 9 : c'est le vrai chemin de l'appareil qui a sauté
    // les versions intermédiaires.
    await verifier.migrateAndValidate(db, 9);

    // Les données de v1 ont traversé six paliers, dont une recréation de table.
    final List<QueryRow> prospects = await db
        .customSelect('SELECT id, statut, representant_id FROM prospects')
        .get();
    expect(prospects, hasLength(1), reason: 'la recréation de table ne perd rien');
    expect(prospects.single.read<String>('statut'), 'CONTACTE');
    expect(prospects.single.read<String>('representant_id'), 'rep-1');

    final List<QueryRow> queue = await db
        .customSelect('SELECT id, attempts, blocked_attempts, claim_token FROM outbox')
        .get();
    expect(queue, hasLength(1), reason: 'la file survit au saut de versions');
    expect(queue.single.read<int>('attempts'), 2);
    expect(queue.single.read<int>('blocked_attempts'), 0);
    expect(queue.single.read<String?>('claim_token'), isNull);

    // La clé étrangère du prospect recréé pointe toujours vers une vraie fiche.
    final List<QueryRow> violations = await db
        .customSelect('PRAGMA foreign_key_check')
        .get();
    expect(violations, isEmpty, reason: 'la recréation a préservé les clés étrangères');

    // Le saut long passe aussi par le palier v8 : les colonnes sont là, et la
    // fiche de v1 porte la relation par défaut.
    final List<QueryRow> qualifie = await db
        .customSelect('SELECT relation_status FROM representants')
        .get();
    expect(qualifie.single.read<String>('relation_status'), 'INCONNU');
    final List<QueryRow> region = await db
        .customSelect('SELECT region_name FROM departements')
        .get();
    expect(region.single.read<String>('region_name'), '');
    // `call_attempts` a été CRÉÉ en v2 puis RECRÉÉ en v6, donc déjà dans sa forme
    // courante quand le palier v8 s'exécute : un `addColumn` inconditionnel y
    // échouerait sur « duplicate column name ».
    await db.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, callback_at, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['a-1', 'pro-1', 'CALLBACK', _iso, _iso, 'me'],
    );

    // Le saut long passe aussi par le palier v9 : le fil s'écrit, attaché à la
    // fiche de v1 qui a traversé huit paliers.
    await db.customStatement(
      'INSERT INTO representant_comments '
      '(id, representant_id, author_id, author_name, body, client_created_at) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['c-1', 'rep-1', 'me', 'Awa Sy', 'Fiche reprise après le saut.', _iso],
    );
    final List<QueryRow> fil = await db
        .customSelect('SELECT representant_id FROM representant_comments')
        .get();
    expect(fil.single.read<String>('representant_id'), 'rep-1');

    await db.close();
  });

  test('v2 -> v9 : le saut passe aussi par les colonnes ajoutées', () async {
    final schema = await verifier.schemaAt(2);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 9);

    // Les colonnes ajoutées en chemin (v4, v5, v7 puis v8) doivent être là
    // toutes : un palier gardé par `from < n` seul, sans `to >= n`, produit un
    // schéma intermédiaire qui n'est aucune version déclarée.
    final List<QueryRow> columns = await db
        .customSelect('SELECT ief_id, relation_status FROM representants')
        .get();
    expect(columns, isEmpty);
    final List<QueryRow> outbox = await db
        .customSelect('SELECT blocked_attempts, claim_token FROM outbox')
        .get();
    expect(outbox, isEmpty);
    final List<QueryRow> attempts = await db
        .customSelect('SELECT callback_at FROM call_attempts')
        .get();
    expect(attempts, isEmpty);
    final List<QueryRow> fil = await db
        .customSelect('SELECT body FROM representant_comments')
        .get();
    expect(fil, isEmpty);

    await db.close();
  });
}

/// Instant fixe, en texte ISO-8601 : c'est ainsi que drift stocke les DATETIME
/// (voir `build.yaml`), et le SQL brut de ce fichier écrit donc la même forme.
final String _iso = DateTime.utc(2026, 8, 12, 9).toIso8601String();
