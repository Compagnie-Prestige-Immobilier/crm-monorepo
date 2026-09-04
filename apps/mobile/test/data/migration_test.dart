import 'package:cpi_go/data/local/database.dart';
import 'package:drift/drift.dart' show GeneratedDatabase, QueryRow;
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
import 'generated_migrations/schema_v9.dart' as v9;
import 'generated_migrations/schema_v10.dart' as v10;
import 'generated_migrations/schema_v11.dart' as v11;
import 'generated_migrations/schema_v13.dart' as v13;
import 'generated_migrations/schema_v14.dart' as v14;
import 'generated_migrations/schema_v15.dart' as v15;
import 'generated_migrations/schema_v18.dart' as v18;
import 'generated_migrations/schema_v19.dart' as v19;
import 'generated_migrations/schema_v20.dart' as v20;
import 'generated_migrations/schema_v21.dart' as v21schema;
import 'generated_migrations/schema_v22.dart' as v22schema;
import 'generated_migrations/schema_v23.dart' as v23schema;
import 'generated_migrations/schema_v24.dart' as v24schema;
import 'generated_migrations/schema_v25.dart' as v25schema;
import 'generated_migrations/schema_v26.dart' as v26schema;
import 'generated_migrations/schema_v27.dart' as v27schema;

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

  test('le golden couvre toutes les versions déclarées', () async {
    final AppDatabase db = AppDatabase(NativeDatabase.memory());
    expect(
      GeneratedHelper.versions,
      contains(db.schemaVersion),
      reason:
          'schemaVersion a bougé sans nouveau dump : '
          'dart run drift_dev schema dump lib/data/local/database.dart drift_schemas/',
    );
    await db.close();
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
    expect(representants.map((QueryRow r) => r.read<String>('id')), <String>[
      'rep-1',
    ]);
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
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();

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
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();

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
      <Object?>[
        'rep-4',
        'Fiche hors ligne',
        '+221771112233',
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
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();

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
    expect(
      rows.single.read<int>('attempts'),
      3,
      reason: 'le compteur serveur survit',
    );
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

  test(
    'v5 -> v6 accepte une valeur d\'énumération que ce client ignore',
    () async {
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
        reason:
            'c\'est bien le CHECK de v5 qui bloquait la page de pull entière',
      );
      await old.close();

      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

      // Rien n'a été perdu par la recréation de table.
      final List<QueryRow> kept = await db
          .customSelect(
            'SELECT prospect_id, phase2_status FROM phase2_directory',
          )
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
    },
  );

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
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();

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
    // structurelles du serveur : méthode ssi le motif ferme sur une méthode, un
    // motif qui exige un commentaire l'obtient, commentaire borné : restent
    // vraies quel que soit le motif que le client ajoutera, et doivent survivre
    // à la recréation de table.
    await expectLater(
      db.customStatement(
        'INSERT INTO call_attempts '
        '(id, prospect_id, outcome, method, client_created_at, created_by_id) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        <Object?>['a-1', 'p-1', 'CALLBACK', 'PLATFORM', _iso, 'me'],
      ),
      throwsA(anything),
      reason: 'une méthode sur un effet qui ne ferme pas reste refusée',
    );
    await expectLater(
      db.customStatement(
        'INSERT INTO call_attempts '
        '(id, prospect_id, outcome, requires_comment, client_created_at, '
        ' created_by_id) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        <Object?>['a-2', 'p-1', 'OTHER', 1, _iso, 'me'],
      ),
      throwsA(anything),
      reason: 'un motif qui exige un commentaire sans commentaire reste refusé',
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
      <Object?>[
        'op-1',
        'prospect',
        'pro-1',
        'create',
        '{"nom":"Diop"}',
        3,
        1,
        'pending',
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, attempts, blocked_attempts, '
      ' status, next_attempt_at, lease_until, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'op-2',
        'representant',
        'rep-1',
        'update',
        '{}',
        0,
        0,
        'syncing',
        _iso,
        _iso,
        _iso,
      ],
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
      <Object?>[
        'rep-1',
        'Awa Ndiaye',
        '+221771234567',
        'dep-1',
        'me',
        _iso,
        _iso,
      ],
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
        .customSelect(
          'SELECT collection, cursor FROM sync_state ORDER BY collection',
        )
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
      <Object?>[
        'rep-1',
        'Awa Ndiaye',
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
        .customSelect(
          'SELECT body, server_created_at FROM representant_comments',
        )
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
    expect(
      columns.map((QueryRow r) => r.read<String>('name')).toSet(),
      <String>{
        'id',
        'representant_id',
        'author_id',
        'author_name',
        'body',
        'client_created_at',
        'server_created_at',
      },
    );

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
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();

    // Le fil est relu à chaque ouverture de fiche et à chaque publication.
    expect(names, contains('representant_comments_representant_idx'));

    await db.close();
  });

  // ── v9 → v10 : les motifs d'issue viennent du serveur ──────────────────────
  //
  // Le palier RECRÉE `call_attempts` pour remplacer des CHECK qui citaient des
  // issues littérales. C'est donc le palier le plus exposé du fichier après le
  // v6 : la table porte le journal des appels de la journée, et deux colonnes
  // NOT NULL y apparaissent, qu'il faut DÉDUIRE et non poser à leur défaut.
  //
  // Ces trois-là valident à la version COURANTE, pour la raison déjà donnée au
  // v1 → v2 : la recopie engendre la forme courante de la table, et depuis que
  // la v19 y ajoute les renseignements de conversion, elle ne correspond plus
  // au doré de la v10. Ce qui porte le risque : les données ont-elles traversé.

  test('v9 -> v10 déduit l\'effet des tentatives déjà saisies', () async {
    final schema = await verifier.schemaAt(9);

    final v9.DatabaseAtV9 old = v9.DatabaseAtV9(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, method, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['a-1', 'p-1', 'METHOD_OBTAINED', 'PLATFORM', _iso, 'me'],
    );
    await old.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, comment, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['a-2', 'p-1', 'OTHER', 'Boutique.', _iso, 'me'],
    );
    // Une tentative avec son heure de rappel : la colonne date de la v8 et ne
    // doit surtout PAS être déclarée neuve par la recopie.
    await old.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, callback_at, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['a-3', 'p-1', 'CALLBACK', _iso, _iso, 'me'],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-1', 'call_attempt', 'a-1', 'create', '{}', _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final List<QueryRow> attempts = await db
        .customSelect(
          'SELECT id, outcome, reason_code, effect, requires_comment, callback_at '
          'FROM call_attempts ORDER BY id',
        )
        .get();
    expect(
      attempts,
      hasLength(3),
      reason: 'le journal des appels ne se perd pas',
    );

    // ═══ LE PIÈGE DU PALIER ═══
    //
    // Sans dérivation, `effect` prendrait son défaut `KEEP_OPEN` sur les trois
    // lignes : `countMyMethods` et `countClosed` se comptent désormais dessus,
    // et la progression personnelle du téléconseiller repartirait à zéro sans
    // qu'aucune erreur ne soit levée.
    expect(attempts[0].read<String>('effect'), 'CLOSE_METHOD');
    expect(attempts[1].read<String>('effect'), 'KEEP_OPEN');
    expect(attempts[2].read<String>('effect'), 'SCHEDULE_CALLBACK');
    expect(attempts[1].read<bool>('requires_comment'), isTrue);
    expect(attempts[0].read<bool>('requires_comment'), isFalse);
    expect(
      attempts[2].read<String?>('callback_at'),
      isNotNull,
      reason: 'la recopie ne doit pas effacer une heure de rappel de la v8',
    );

    // Aucune tentative d'avant le palier ne porte de motif : c'est l'issue qui
    // en tient lieu, et le repli système sait la résoudre.
    for (final QueryRow row in attempts) {
      expect(row.read<String?>('reason_code'), isNull);
    }

    final List<QueryRow> pending = await db
        .customSelect('SELECT id FROM outbox WHERE status = \'pending\'')
        .get();
    expect(pending, hasLength(1), reason: 'la file ne doit pas être vidée');

    // Le référentiel démarre vide : il se télécharge, il ne se fabrique pas par
    // migration. Tant qu'il l'est, la saisie se replie sur les six codes système.
    final List<QueryRow> reasons = await db
        .customSelect('SELECT COUNT(*) AS c FROM call_outcome_reasons')
        .get();
    expect(reasons.single.read<int>('c'), 0);

    await db.close();
  });

  test('v9 -> v10 accepte un motif que ce client ne connaît pas', () async {
    final schema = await verifier.schemaAt(9);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    // C'est TOUT l'objet du palier : l'équipe du client ajoute « NRP » depuis le
    // web, et la saisie hors ligne doit l'écrire sans qu'aucun CHECK ne cite son
    // code. Un effet inconnu de cette version passe aussi : un CHECK figé sur
    // `effect` ferait avorter la page de pull entière.
    await db.customStatement(
      'INSERT INTO call_outcome_reasons '
      '(code, label, effect, sort_order, min_payload_version) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['NRP', 'Ne répond pas', 'KEEP_OPEN', 15, 2],
    );
    await db.customStatement(
      'INSERT INTO call_outcome_reasons '
      '(code, label, effect, sort_order, min_payload_version) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['ESCALADE', 'Escalade', 'TRANSFER_TO_MANAGER', 90, 2],
    );
    await db.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, reason_code, effect, client_created_at, '
      ' created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['a-1', 'p-1', 'UNREACHABLE', 'NRP', 'KEEP_OPEN', _iso, 'me'],
    );

    final List<QueryRow> saisie = await db
        .customSelect('SELECT reason_code FROM call_attempts')
        .get();
    expect(saisie.single.read<String?>('reason_code'), 'NRP');

    await db.close();
  });

  test('v9 -> v10 crée l\'index du référentiel des motifs', () async {
    final schema = await verifier.schemaAt(9);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name = \'call_outcome_reasons\'',
        )
        .get();
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();

    // La feuille des issues est relue à chaque ouverture, et elle trie sur
    // (is_active, sort_order, label).
    expect(names, contains('call_outcome_reasons_active_idx'));

    // La recréation de `call_attempts` emporte ses index avec elle : les oublier
    // ne casse aucun test fonctionnel, ça rend seulement l'historique d'un
    // prospect linéaire sur tout le journal.
    final List<QueryRow> attemptIndexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name = \'call_attempts\'',
        )
        .get();
    final Set<String> attemptNames = attemptIndexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();
    expect(attemptNames, contains('call_attempts_prospect_idx'));
    expect(attemptNames, contains('call_attempts_created_idx'));

    await db.close();
  });

  // ── v10 → v11 : WhatsApp et profession ─────────────────────────────────────
  //
  // Palier additif sur `representants`, qui n'a jamais été recréée : trois
  // `addColumn` suffisent. Ce qui doit être prouvé n'est donc pas la recopie,
  // c'est le DÉFAUT posé sur les 12 929 fiches déjà en base. `NON_DEMANDE` et
  // non `AUCUN` : la migration ne peut pas savoir si la question a été posée, et
  // poser « pas de WhatsApp » partout ferait cesser les rappels.

  test('v10 -> v11 pose « non demandé » sur les fiches déjà en base', () async {
    final schema = await verifier.schemaAt(10);

    final v10.DatabaseAtV10 old = v10.DatabaseAtV10(schema.newConnection());
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements '
      '(id, code, name, region_id, region_name, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', 'Dakar', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, notes, departement_id, relation_status, '
      ' created_by_id, client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'rep-1',
        'Awa Ndiaye',
        '+221771234567',
        'Rappeler le matin.',
        'dep-1',
        'AMBASSADEUR',
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
        'update',
        '{"notes":null}',
        _iso,
        _iso,
      ],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 11);

    final List<QueryRow> fiches = await db
        .customSelect(
          'SELECT notes, relation_status, whatsapp_status, whatsapp_e164, profession '
          'FROM representants',
        )
        .get();
    expect(fiches.single.read<String>('whatsapp_status'), 'NON_DEMANDE');
    expect(fiches.single.read<String?>('whatsapp_e164'), isNull);
    expect(fiches.single.read<String?>('profession'), isNull);
    // Le palier v8 ne régresse pas, et la saisie du terrain reste intacte.
    expect(fiches.single.read<String>('relation_status'), 'AMBASSADEUR');
    expect(fiches.single.read<String?>('notes'), 'Rappeler le matin.');

    // Une opération en file depuis trois semaines reste lisible : le palier ne
    // touche pas au payload, et c'est lui que le moteur relit.
    final List<QueryRow> queue = await db
        .customSelect('SELECT payload FROM outbox')
        .get();
    expect(queue.single.read<String>('payload'), '{"notes":null}');

    await db.close();
  });

  test('v10 -> v11 accepte un état WhatsApp que ce client ignore', () async {
    final schema = await verifier.schemaAt(10);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 11);

    await db.customStatement(
      'INSERT INTO departements '
      '(id, code, name, region_id, local_updated_at) VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
    );
    // C'est TOUT l'objet de l'absence de CHECK : le jour où le serveur ajoute un
    // état, un CHECK figé ferait avorter la transaction de pull ENTIÈRE, donc la
    // page complète de changements, pas seulement cette fiche.
    await db.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, whatsapp_status, profession, '
      ' created_by_id, client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'rep-2',
        'Ibrahima Sarr',
        '+221771234568',
        'dep-1',
        'NUMERO_PROFESSIONNEL',
        'Censeur',
        'me',
        _iso,
        _iso,
      ],
    );

    final List<QueryRow> fiches = await db
        .customSelect('SELECT whatsapp_status, profession FROM representants')
        .get();
    expect(
      fiches.single.read<String>('whatsapp_status'),
      'NUMERO_PROFESSIONNEL',
    );
    expect(fiches.single.read<String?>('profession'), 'Censeur');

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

  test('v1 -> v11 d\'un seul coup : deux mois sans mise à jour', () async {
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
      <Object?>[
        'rep-1',
        'Awa Ndiaye',
        '+221771234567',
        'dep-1',
        'me',
        _iso,
        _iso,
      ],
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
    // UN SEUL appel, de 1 à 11 : c'est le vrai chemin de l'appareil qui a sauté
    // les versions intermédiaires.
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    // Les données de v1 ont traversé six paliers, dont une recréation de table.
    final List<QueryRow> prospects = await db
        .customSelect('SELECT id, statut, representant_id FROM prospects')
        .get();
    expect(
      prospects,
      hasLength(1),
      reason: 'la recréation de table ne perd rien',
    );
    expect(prospects.single.read<String>('statut'), 'CONTACTE');
    expect(prospects.single.read<String>('representant_id'), 'rep-1');

    final List<QueryRow> queue = await db
        .customSelect(
          'SELECT id, attempts, blocked_attempts, claim_token FROM outbox',
        )
        .get();
    expect(queue, hasLength(1), reason: 'la file survit au saut de versions');
    expect(queue.single.read<int>('attempts'), 2);
    expect(queue.single.read<int>('blocked_attempts'), 0);
    expect(queue.single.read<String?>('claim_token'), isNull);

    // La clé étrangère du prospect recréé pointe toujours vers une vraie fiche.
    final List<QueryRow> violations = await db
        .customSelect('PRAGMA foreign_key_check')
        .get();
    expect(
      violations,
      isEmpty,
      reason: 'la recréation a préservé les clés étrangères',
    );

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
      <Object?>[
        'c-1',
        'rep-1',
        'me',
        'Awa Sy',
        'Fiche reprise après le saut.',
        _iso,
      ],
    );
    final List<QueryRow> fil = await db
        .customSelect('SELECT representant_id FROM representant_comments')
        .get();
    expect(fil.single.read<String>('representant_id'), 'rep-1');

    // Le saut long passe aussi par le palier v10. La recréation de
    // `call_attempts` a eu lieu EN v6, donc dans la forme courante : le palier
    // v10 la laisse tranquille, et c'est justement ce qui doit être prouvé, sans
    // quoi `callback_at` y serait déclaré neuf donc effacé sur tout le journal.
    await db.customStatement(
      'INSERT INTO call_outcome_reasons (code, label, effect) VALUES (?, ?, ?)',
      <Object?>['NRP', 'Ne répond pas', 'KEEP_OPEN'],
    );
    await db.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, reason_code, effect, client_created_at, '
      ' created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['a-2', 'pro-1', 'UNREACHABLE', 'NRP', 'KEEP_OPEN', _iso, 'me'],
    );
    final List<QueryRow> journal = await db
        .customSelect(
          'SELECT id, reason_code, callback_at FROM call_attempts ORDER BY id',
        )
        .get();
    expect(journal.map((QueryRow r) => r.read<String>('id')), <String>[
      'a-1',
      'a-2',
    ]);
    expect(journal.first.read<String?>('callback_at'), isNotNull);
    expect(journal.last.read<String?>('reason_code'), 'NRP');

    // Le saut long passe aussi par le palier v11 : la fiche de v1 sort en
    // « non demandé », le seul état qui ne prétende rien sur elle.
    final List<QueryRow> whatsapp = await db
        .customSelect(
          'SELECT whatsapp_status, whatsapp_e164, profession FROM representants',
        )
        .get();
    expect(whatsapp.single.read<String>('whatsapp_status'), 'NON_DEMANDE');
    expect(whatsapp.single.read<String?>('whatsapp_e164'), isNull);
    expect(whatsapp.single.read<String?>('profession'), isNull);

    await db.close();
  });

  test(
    'v2 -> dernier palier : le saut passe aussi par les colonnes ajoutées',
    () async {
      final schema = await verifier.schemaAt(2);
      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

      // Les colonnes ajoutées en chemin (v4, v5, v7 puis v8) doivent être là
      // toutes : un palier gardé par `from < n` seul, sans `to >= n`, produit un
      // schéma intermédiaire qui n'est aucune version déclarée.
      final List<QueryRow> columns = await db
          .customSelect(
            'SELECT ief_id, relation_status, whatsapp_status, whatsapp_e164, '
            'profession FROM representants',
          )
          .get();
      expect(columns, isEmpty);
      final List<QueryRow> outbox = await db
          .customSelect('SELECT blocked_attempts, claim_token FROM outbox')
          .get();
      expect(outbox, isEmpty);
      final List<QueryRow> attempts = await db
          .customSelect(
            'SELECT callback_at, reason_code, effect, requires_comment '
            'FROM call_attempts',
          )
          .get();
      expect(attempts, isEmpty);
      final List<QueryRow> fil = await db
          .customSelect('SELECT body FROM representant_comments')
          .get();
      expect(fil, isEmpty);
      final List<QueryRow> motifs = await db
          .customSelect(
            'SELECT code, effect, min_payload_version FROM call_outcome_reasons',
          )
          .get();
      expect(motifs, isEmpty);

      await db.close();
    },
  );
  // ── v13 → v14 : le registre des visites descend sur l'appareil ─────────────
  //
  // Table NEUVE, aucune recopie. Ce qui doit être prouvé : la saisie déjà en
  // file survit, et la table neuve s'ouvre vide plutôt que de faire échouer
  // l'ouverture.

  test(
    'v13 -> v14 ajoute le registre des visites sans toucher à la file en attente',
    () async {
      final schema = await verifier.schemaAt(13);

      final v13.DatabaseAtV13 old = v13.DatabaseAtV13(schema.newConnection());
      await old.customStatement('PRAGMA foreign_keys = ON;');
      await old.customStatement(
        'INSERT INTO outbox '
        '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'op-visite-1',
          'representant',
          'rep-1',
          'create',
          '{"x":1}',
          _iso,
          _iso,
        ],
      );
      await old.close();

      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, 14);

      final List<QueryRow> enFile = await db
          .customSelect('SELECT id FROM outbox')
          .get();
      expect(enFile.single.read<String>('id'), 'op-visite-1');

      expect(await db.customSelect('SELECT * FROM visites').get(), isEmpty);

      await db.close();
    },
  );

  // ── v13/v14 → v15 : les parcours ───────────────────────────────────────────
  //
  // Le palier le plus exposé depuis le v10. Il fait trois choses à la fois :
  // deux référentiels neufs, DEUX COLONNES ajoutées conditionnellement à
  // `prospects` selon le palier d'origine, et une REPRISE qui fabrique une ligne
  // de parcours par fiche. Aucune n'était exercée avec des données.
  //
  // Le `if (from >= 13)` porte tout le risque : `alterTable(_prospectsCopy)`
  // engendre TOUJOURS la forme COURANTE de la table, donc une base venue d'avant
  // la v13 a déjà les deux colonnes et un `addColumn` inconditionnel y échouerait
  // sur « duplicate column name ». Une base de v13 ou v14, elle, ne les a pas.

  Future<void> semerFichesEnV(
    GeneratedDatabase old, {
    required String projet,
  }) async {
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO prospects '
      '(id, nom, prenom, phone_e164, projet, created_by_id, statut, '
      ' client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'pro-vivant',
        'Diop',
        'Awa',
        '+221771112201',
        projet,
        'me',
        'CONTACTE',
        _iso,
        _iso,
      ],
    );
    // Une fiche SUPPRIMÉE : lui rouvrir un parcours la ferait réapparaître dans
    // la liste de son projet, effacée le matin et de retour l'après-midi.
    await old.customStatement(
      'INSERT INTO prospects '
      '(id, nom, prenom, phone_e164, projet, created_by_id, statut, '
      ' client_created_at, local_updated_at, deleted_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'pro-efface',
        'Sarr',
        'Ibrahima',
        '+221771112202',
        projet,
        'me',
        'NOUVEAU',
        _iso,
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'op-parcours',
        'prospect',
        'pro-vivant',
        'create',
        '{"nom":"Diop"}',
        _iso,
        _iso,
      ],
    );
  }

  Future<void> verifierLaReprise(
    AppDatabase db, {
    required String projet,
  }) async {
    // La reprise : sans elle, toutes les fiches déjà sur l'appareil
    // disparaissent des DEUX listes de projet à la mise à jour.
    final List<QueryRow> parcours = await db
        .customSelect(
          'SELECT prospect_id, projet, statut FROM prospect_journeys '
          'ORDER BY prospect_id',
        )
        .get();
    expect(
      parcours.map((QueryRow r) => r.read<String>('prospect_id')),
      <String>['pro-vivant'],
      reason: 'une fiche supprimée n\'a pas de parcours à rouvrir',
    );
    expect(parcours.single.read<String>('projet'), projet);
    expect(
      parcours.single.read<String>('statut'),
      'CONTACTE',
      reason: 'le statut de la fiche est repris, pas remis au défaut',
    );

    // Les deux colonnes ajoutées conditionnellement sont là ET s'écrivent.
    await db.customStatement(
      'INSERT INTO canaux_provenance '
      '(id, code, label, local_updated_at) VALUES (?, ?, ?, ?)',
      <Object?>['cn-1', 'PARRAINAGE', 'Parrainage', _iso],
    );
    await db.customStatement(
      'UPDATE prospects SET duree_systeme_mois = ?, canal_provenance_id = ? '
      'WHERE id = ?',
      <Object?>[36, 'cn-1', 'pro-vivant'],
    );
    final List<QueryRow> fiche = await db
        .customSelect(
          'SELECT duree_systeme_mois, canal_provenance_id FROM prospects '
          'WHERE id = \'pro-vivant\'',
        )
        .get();
    expect(fiche.single.read<int?>('duree_systeme_mois'), 36);
    expect(fiche.single.read<String?>('canal_provenance_id'), 'cn-1');

    // La file n'a rien perdu.
    final List<QueryRow> enFile = await db
        .customSelect('SELECT id FROM outbox')
        .get();
    expect(enFile.single.read<String>('id'), 'op-parcours');

    final List<QueryRow> violations = await db
        .customSelect('PRAGMA foreign_key_check')
        .get();
    expect(violations, isEmpty);
  }

  test('v13 -> v15 ouvre un parcours par fiche VIVANTE', () async {
    final schema = await verifier.schemaAt(13);
    final v13.DatabaseAtV13 old = v13.DatabaseAtV13(schema.newConnection());
    await semerFichesEnV(old, projet: 'CHUES');
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    await verifierLaReprise(db, projet: 'CHUES');
    await db.close();
  });

  test('v14 -> v15 ouvre un parcours par fiche VIVANTE', () async {
    final schema = await verifier.schemaAt(14);
    final v14.DatabaseAtV14 old = v14.DatabaseAtV14(schema.newConnection());
    await semerFichesEnV(old, projet: 'GRAND_PUBLIC');
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    await verifierLaReprise(db, projet: 'GRAND_PUBLIC');
    await db.close();
  });

  test('v13 -> v15 crée les index des tables neuves', () async {
    final schema = await verifier.schemaAt(13);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master WHERE type = \'index\' '
          'AND tbl_name IN (\'canaux_provenance\', \'visite_referentiels\', '
          '\'prospect_journeys\')',
        )
        .get();
    final Set<String> names = indexes
        .map((QueryRow r) => r.read<String>('name'))
        .toSet();
    expect(names, contains('canaux_provenance_active_idx'));
    expect(names, contains('visite_referentiels_kind_idx'));
    expect(names, contains('prospect_journeys_projet_idx'));

    await db.close();
  });

  /// Une fiche venue d'AVANT la v13 passe par `alterTable`, qui engendre la
  /// forme courante : les deux colonnes y sont déjà, et le `addColumn` du palier
  /// v15 doit alors se taire.
  test('v12 -> v15 ne redéclare pas deux fois les mêmes colonnes', () async {
    final schema = await verifier.schemaAt(12);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);
    await db.close();
  });

  // ── v15 → v16 : l'index du filtre entreprise sur « Tout » ─────────────────
  //
  // Palier purement additif, un index sur une table déjà pleine de visites non
  // synchronisées : la seule chose à prouver est que la file et le registre ne
  // bougent pas, et que l'index promis existe réellement.

  test(
    'v15 -> v16 pose l\'index sans toucher au registre ni à la file',
    () async {
      final schema = await verifier.schemaAt(15);

      final v15.DatabaseAtV15 old = v15.DatabaseAtV15(schema.newConnection());
      await old.customStatement('PRAGMA foreign_keys = ON;');
      await old.customStatement(
        'INSERT INTO visites '
        '(id, date, visitor_name, entreprise_id, entreprise_label, objet_id, '
        ' objet_label, created_by_id, created_at, updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'v-1',
          '2026-08-12',
          'Awa Ndiaye',
          'e-1',
          'CPI',
          'o-1',
          'Achat terrain',
          'me',
          _iso,
          _iso,
        ],
      );
      await old.customStatement(
        'INSERT INTO outbox '
        '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        <Object?>['op-visite-16', 'visite', 'v-1', 'create', '{}', _iso, _iso],
      );
      await old.close();

      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

      final List<QueryRow> visites = await db
          .customSelect('SELECT id FROM visites')
          .get();
      expect(visites.single.read<String>('id'), 'v-1');

      final List<QueryRow> file = await db
          .customSelect('SELECT id FROM outbox')
          .get();
      expect(file.single.read<String>('id'), 'op-visite-16');

      final List<QueryRow> indexes = await db
          .customSelect(
            'SELECT name FROM sqlite_master '
            'WHERE type = \'index\' AND tbl_name = \'visites\'',
          )
          .get();
      expect(
        indexes.map((QueryRow r) => r.read<String>('name')),
        contains('visites_entreprise_date_idx'),
      );

      await db.close();
    },
  );

  // ── v18 → v19 : les renseignements de la conversion ───────────────────────
  //
  // Le palier RECOPIE `call_attempts` : il ajoute cinq colonnes ET trois CHECK,
  // que `ALTER TABLE ADD COLUMN` ne sait pas poser. C'est donc le journal des
  // appels de la journée qui traverse une recréation de table.

  test('v18 -> v19 garde les appels déjà saisis et leur ajoute les '
      'renseignements', () async {
    final schema = await verifier.schemaAt(18);
    final v18.DatabaseAtV18 old = v18.DatabaseAtV18(schema.newConnection());
    await old.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, reason_code, effect, method, comment, '
      ' callback_at, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'a-18',
        'p-1',
        'METHOD_OBTAINED',
        'METHOD_OBTAINED',
        'CLOSE_METHOD',
        'PLATFORM',
        'Rappelé à midi.',
        null,
        _iso,
        'me',
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-19', 'call_attempt', 'a-18', 'create', '{}', _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final QueryRow attempt = await db
        .customSelect(
          'SELECT method, comment, email, fonctionnaire, '
          '       duree_etablissement_mois, rendez_vous_at '
          'FROM call_attempts',
        )
        .getSingle();
    expect(attempt.read<String>('method'), 'PLATFORM');
    expect(attempt.read<String>('comment'), 'Rappelé à midi.');
    // « Non demandé » et non « non » : la question n'a pas été posée à cet
    // appel-là, et un booléen non nul l'aurait fait passer pour un refus.
    expect(attempt.read<bool?>('fonctionnaire'), isNull);
    expect(attempt.read<String?>('email'), isNull);
    expect(attempt.read<int?>('duree_etablissement_mois'), isNull);
    expect(attempt.read<String?>('rendez_vous_at'), isNull);

    expect(
      await db
          .customSelect('SELECT id FROM outbox')
          .getSingle()
          .then((QueryRow row) => row.read<String>('id')),
      'op-19',
      reason: 'la recopie ne vide pas la file',
    );

    await db.close();
  });

  test('v18 -> v19 refuse un rendez-vous sans prise de rendez-vous', () async {
    final schema = await verifier.schemaAt(18);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    Future<void> insert(String? method, String? rendezVous) =>
        db.customStatement(
          'INSERT INTO call_attempts '
          '(id, prospect_id, outcome, effect, method, rendez_vous_at, '
          ' client_created_at, created_by_id) '
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          <Object?>[
            'a-${method ?? 'nul'}-${rendezVous ?? 'nul'}',
            'p-1',
            'METHOD_OBTAINED',
            method == null ? 'KEEP_OPEN' : 'CLOSE_METHOD',
            method,
            rendezVous,
            _iso,
            'me',
          ],
        );

    await expectLater(insert('PLATFORM', _iso), throwsA(anything));
    await expectLater(insert('APPOINTMENT', null), throwsA(anything));
    await insert('APPOINTMENT', _iso);

    expect(await db.countMyAttempts().getSingle(), 1);
    await db.close();
  });

  test('v19 -> v20 supprime les tables de campagne et garde les saisies', () async {
    final schema = await verifier.schemaAt(19);
    final v19.DatabaseAtV19 old = v19.DatabaseAtV19(schema.newConnection());
    await old.customStatement(
      'INSERT INTO call_campaigns (id, name, updated_at) VALUES (?, ?, ?)',
      <Object?>['camp-20', 'Ancienne campagne', _iso],
    );
    await old.customStatement(
      'INSERT INTO call_tasks '
      '(id, campaign_id, prospect_id, position, updated_at) VALUES (?, ?, ?, ?, ?)',
      <Object?>['task-20', 'camp-20', 'prospect-20', 1, _iso],
    );
    await old.customStatement(
      'INSERT INTO rep_call_campaigns (id, name, updated_at) VALUES (?, ?, ?)',
      <Object?>['rep-camp-20', 'Ancienne campagne représentants', _iso],
    );
    await old.customStatement(
      'INSERT INTO rep_call_tasks '
      '(id, campaign_id, representant_id, position, updated_at) VALUES (?, ?, ?, ?, ?)',
      <Object?>['rep-task-20', 'rep-camp-20', 'rep-20', 1, _iso],
    );
    await old.customStatement(
      'INSERT INTO call_attempts '
      '(id, prospect_id, outcome, effect, method, client_created_at, created_by_id) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'attempt-20',
        'prospect-20',
        'METHOD_OBTAINED',
        'CLOSE_METHOD',
        'PLATFORM',
        _iso,
        'me',
      ],
    );
    await old.customStatement(
      'INSERT INTO rep_callback_reminders '
      '(id, representant_id, full_name, phone_e164, scheduled_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>[
        'reminder-20',
        'rep-20',
        'Représentant 20',
        '+221770000020',
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'op-20',
        'call_attempt',
        'attempt-20',
        'create',
        '{}',
        _iso,
        _iso,
      ],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);
    final List<QueryRow> obsolete = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'table\' AND name IN '
          '(\'call_campaigns\', \'call_tasks\', \'rep_call_campaigns\', \'rep_call_tasks\')',
        )
        .get();
    expect(obsolete, isEmpty);
    expect(await db.countMyAttempts().getSingle(), 1);
    expect(await db.pendingRepCallbackReminders().get(), hasLength(1));
    expect(
      await db
          .customSelect('SELECT id FROM outbox')
          .getSingle()
          .then((QueryRow row) => row.read<String>('id')),
      'op-20',
    );
    await db.close();
  });

  test(
    'v20 -> v21 ouvre les tranches de revenu sans toucher aux saisies',
    () async {
      final schema = await verifier.schemaAt(20);
      final v20.DatabaseAtV20 old = v20.DatabaseAtV20(schema.newConnection());
      await old.customStatement(
        'INSERT INTO call_attempts '
        '(id, prospect_id, outcome, effect, method, client_created_at, created_by_id) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'attempt-21',
          'prospect-21',
          'METHOD_OBTAINED',
          'CLOSE_METHOD',
          'PLATFORM',
          _iso,
          'me',
        ],
      );
      await old.customStatement(
        'INSERT INTO outbox '
        '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'op-21',
          'call_attempt',
          'attempt-21',
          'create',
          '{}',
          _iso,
          _iso,
        ],
      );
      // Un appareil DÉJÀ mis au miroir : c'est celui qui ne redemanderait
      // jamais la liste entière, donc celui qui n'aurait jamais de tranche.
      await old.customStatement(
        'INSERT INTO sync_state (collection, cursor, last_pulled_at) '
        'VALUES (?, ?, ?)',
        <Object?>['referentiels_mirror', null, _iso],
      );
      await old.customStatement(
        'INSERT INTO sync_state (collection, cursor, last_pulled_at) '
        'VALUES (?, ?, ?)',
        <Object?>['all', 'cur-20', _iso],
      );
      await old.close();

      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, 21);
      await db.customStatement(
        'INSERT INTO income_bands '
        '(id, code, label, min_xof, max_xof, sort_order, local_updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'band-21',
          'B150_300',
          '150 000 à 300 000',
          150000,
          300000,
          10,
          _iso,
        ],
      );
      expect(
        await db.customSelect('SELECT id FROM income_bands').get(),
        hasLength(1),
      );
      // Le marqueur du miroir est effacé : la prochaine synchronisation relit
      // les référentiels ENTIERS et pose enfin les tranches.
      expect(
        await db
            .customSelect(
              'SELECT collection FROM sync_state '
              'WHERE collection = \'referentiels_mirror\'',
            )
            .get(),
        isEmpty,
      );
      // Le curseur de pull, lui, ne bouge pas : une page de saisies perdue ne
      // se rattrape pas.
      expect(
        await db
            .customSelect(
              'SELECT cursor FROM sync_state WHERE collection = \'all\'',
            )
            .getSingle()
            .then((QueryRow row) => row.read<String>('cursor')),
        'cur-20',
      );
      expect(await db.countMyAttempts().getSingle(), 1);
      expect(
        await db
            .customSelect('SELECT id FROM outbox')
            .getSingle()
            .then((QueryRow row) => row.read<String>('id')),
        'op-21',
      );
      await db.close();
    },
  );

  // ── v21 → v22 : les renseignements du script de qualification ──────────────
  //
  // Cinq colonnes ajoutées à `representants`, LA table qui porte des fiches non
  // encore synchronisées. `addColumn` et non recréation, car aucune contrainte
  // nouvelle : toutes nullables. Ce qui doit être prouvé : la fiche déjà en base
  // traverse, ses colonnes neuves s'écrivent, et une fiche d'avant le script
  // sort avec du NUL partout, pas un « non » qui affirmerait une réponse.

  test(
    'v21 -> v22 ajoute les renseignements sans toucher aux fiches en file',
    () async {
      final schema = await verifier.schemaAt(21);

      final v21schema.DatabaseAtV21 old = v21schema.DatabaseAtV21(
        schema.newConnection(),
      );
      await old.customStatement('PRAGMA foreign_keys = ON;');
      await old.customStatement(
        'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
        'VALUES (?, ?, ?, ?, ?)',
        <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
      );
      await old.customStatement(
        'INSERT INTO representants '
        '(id, full_name, phone_e164, departement_id, relation_status, '
        ' whatsapp_status, created_by_id, client_created_at, local_updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'rep-22',
          'Awa Ndiaye',
          '+221771234567',
          'dep-1',
          'AMBASSADEUR',
          'NON_DEMANDE',
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
          'op-22',
          'rep_call_attempt',
          'a-22',
          'create',
          '{}',
          _iso,
          _iso,
        ],
      );
      await old.close();

      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

      // La fiche a traversé, et ses colonnes neuves démarrent NULLES : une fiche
      // d'avant le script n'a jamais été qualifiée, et son silence ne doit pas se
      // lire comme un « non ».
      final QueryRow fiche = await db
          .customSelect(
            'SELECT relation_status, prenom, etablissement, syndicat, '
            '       connait_ues, contacte FROM representants',
          )
          .getSingle();
      expect(fiche.read<String>('relation_status'), 'AMBASSADEUR');
      expect(fiche.read<String?>('prenom'), isNull);
      expect(fiche.read<String?>('etablissement'), isNull);
      expect(fiche.read<String?>('syndicat'), isNull);
      expect(fiche.read<bool?>('connait_ues'), isNull);
      expect(fiche.read<bool?>('contacte'), isNull);

      // Les colonnes s'ÉCRIVENT, tri-état compris : « la colonne existe » se
      // vérifierait aussi sur une colonne au mauvais type.
      await db.customStatement(
        'UPDATE representants SET prenom = ?, etablissement = ?, syndicat = ?, '
        '       connait_ues = ?, contacte = ? WHERE id = ?',
        <Object?>['Awa', 'Lycée Blaise Diagne', 'SG', 1, 0, 'rep-22'],
      );
      final QueryRow apres = await db
          .customSelect(
            'SELECT prenom, etablissement, syndicat, connait_ues, contacte '
            'FROM representants WHERE id = \'rep-22\'',
          )
          .getSingle();
      expect(apres.read<String?>('prenom'), 'Awa');
      expect(apres.read<String?>('etablissement'), 'Lycée Blaise Diagne');
      expect(apres.read<String?>('syndicat'), 'SG');
      expect(apres.read<bool?>('connait_ues'), isTrue);
      expect(apres.read<bool?>('contacte'), isFalse);

      // La file n'a rien perdu.
      expect(
        await db
            .customSelect('SELECT id FROM outbox')
            .getSingle()
            .then((QueryRow row) => row.read<String>('id')),
        'op-22',
      );

      await db.close();
    },
  );

  // ── v22 → v23 : les renseignements de situation du Grand Public ────────────
  //
  // Treize colonnes ajoutées à `prospects` et trois référentiels neufs. Ce qui
  // doit être prouvé : la fiche déjà saisie traverse avec ses colonnes d'hier
  // intactes, les neuves démarrent NULLES, et le marqueur de miroir est effacé
  // — sans quoi `professions`, `employeurs` et `pays` resteraient vides à vie.

  test('v22 -> v23 ajoute la situation sans toucher aux fiches en file', () async {
    final schema = await verifier.schemaAt(22);

    final v22schema.DatabaseAtV22 old = v22schema.DatabaseAtV22(
      schema.newConnection(),
    );
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO prospects '
      '(id, nom, prenom, phone_e164, created_by_id, projet, type, profession, '
      ' duree_systeme_mois, statut, client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'pro-22',
        'Ndiaye',
        'Fatou',
        '+221771234567',
        'me',
        'GRAND_PUBLIC',
        'FONCTIONNAIRE',
        'Institutrice',
        24,
        'NOUVEAU',
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-23', 'prospect', 'pro-22', 'create', '{}', _iso, _iso],
    );
    // L'appareil est déjà mis au miroir : c'est celui que le palier doit
    // soigner, sinon les deux listes neuves n'arrivent jamais.
    await old.customStatement(
      'INSERT INTO sync_state (collection, last_pulled_at) VALUES (?, ?)',
      <Object?>['referentiels_mirror', _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final QueryRow fiche = await db
        .customSelect(
          'SELECT profession, profession_id, duree_systeme_mois, '
          '       income_band_id, employeur_id, '
          '       employeur, type_contrat, anciennete_mois, lieu_activite, '
          '       mode_epargne, pays_residence_id, ville_residence, '
          '       whatsapp_e164, relais_nom, relais_phone_e164 FROM prospects',
        )
        .getSingle();
    // Le texte libre d'hier SURVIT : la colonne de référentiel s'ajoute à côté,
    // elle ne remplace pas ce qui a déjà été saisi.
    expect(fiche.read<String?>('profession'), 'Institutrice');
    // La durée du système de paiement ne DEVIENT pas l'ancienneté : ce sont
    // deux renseignements distincts, et le formulaire écrivait dans la mauvaise.
    expect(fiche.read<int?>('duree_systeme_mois'), 24);
    expect(fiche.read<int?>('anciennete_mois'), isNull);
    for (final String colonne in <String>[
      'profession_id',
      'income_band_id',
      'employeur_id',
      'employeur',
      'type_contrat',
      'lieu_activite',
      'mode_epargne',
      'pays_residence_id',
      'ville_residence',
      'whatsapp_e164',
      'relais_nom',
      'relais_phone_e164',
    ]) {
      expect(fiche.read<String?>(colonne), isNull, reason: colonne);
    }

    // Les colonnes s'ÉCRIVENT : « la colonne existe » se vérifierait aussi sur
    // une colonne au mauvais type.
    await db.customStatement(
      'UPDATE prospects SET employeur = ?, anciennete_mois = ?, '
      '       pays_residence_id = ?, whatsapp_e164 = ?, profession_id = ? '
      'WHERE id = ?',
      <Object?>[
        'Éducation nationale',
        36,
        'pays-1',
        '+393331234567',
        'pro-1',
        'pro-22',
      ],
    );
    final QueryRow apres = await db
        .customSelect(
          'SELECT employeur, anciennete_mois, pays_residence_id, '
          '       whatsapp_e164, profession_id '
          'FROM prospects WHERE id = \'pro-22\'',
        )
        .getSingle();
    expect(apres.read<String?>('employeur'), 'Éducation nationale');
    expect(apres.read<int?>('anciennete_mois'), 36);
    expect(apres.read<String?>('pays_residence_id'), 'pays-1');
    expect(apres.read<String?>('whatsapp_e164'), '+393331234567');
    expect(apres.read<String?>('profession_id'), 'pro-1');

    // La table neuve accepte une ligne : « la table existe » se vérifierait
    // aussi sur une table aux mauvaises colonnes.
    await db.customStatement(
      'INSERT INTO professions '
      '(id, code, label, is_teaching, local_updated_at) VALUES (?, ?, ?, ?, ?)',
      <Object?>['pro-1', 'INSTITUTEUR', 'Instituteur', 1, _iso],
    );
    expect(
      await db
          .customSelect('SELECT is_teaching FROM professions')
          .getSingle()
          .then((QueryRow row) => row.read<bool>('is_teaching')),
      isTrue,
    );

    // Le marqueur effacé : le prochain passage relit les listes entières.
    expect(
      await db
          .customSelect(
            'SELECT COUNT(*) AS c FROM sync_state '
            'WHERE collection = \'referentiels_mirror\'',
          )
          .getSingle()
          .then((QueryRow row) => row.read<int>('c')),
      0,
    );

    // La file n'a rien perdu.
    expect(
      await db
          .customSelect('SELECT id FROM outbox')
          .getSingle()
          .then((QueryRow row) => row.read<String>('id')),
      'op-23',
    );

    await db.close();
  });

  // Le résumé du dernier appel arrive sur `representants` par le MÊME palier :
  // la section « Injoignables » se lit dessus, et une colonne absente ferait
  // échouer chaque lecture de fiche.
  test('v22 -> v23 ajoute le résumé du dernier appel aux représentants', () async {
    final schema = await verifier.schemaAt(22);

    final v22schema.DatabaseAtV22 old = v22schema.DatabaseAtV22(
      schema.newConnection(),
    );
    await old.customStatement('PRAGMA foreign_keys = ON;');
    await old.customStatement(
      'INSERT INTO departements (id, code, name, region_id, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?)',
      <Object?>['dep-1', 'DK', 'Dakar', 'reg-1', _iso],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, etablissement, '
      ' created_by_id, client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'rep-23',
        'Ousmane Fall',
        '+221771234567',
        'dep-1',
        'Lycée Blaise Diagne',
        'me',
        _iso,
        _iso,
      ],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

    final QueryRow fiche = await db
        .customSelect(
          'SELECT etablissement, last_call_outcome, last_call_at, '
          '       last_call_by_id, next_callback_at FROM representants',
        )
        .getSingle();
    // La saisie d'hier survit, et les colonnes neuves démarrent NULLES : le
    // résumé vient du serveur, une migration ne peut pas l'inventer.
    expect(fiche.read<String?>('etablissement'), 'Lycée Blaise Diagne');
    for (final String colonne in <String>[
      'last_call_outcome',
      'last_call_at',
      'last_call_by_id',
      'next_callback_at',
    ]) {
      expect(fiche.read<String?>(colonne), isNull, reason: colonne);
    }

    // Les colonnes s'ÉCRIVENT : « la colonne existe » se vérifierait aussi sur
    // une colonne au mauvais type. Une issue que ce client ignore passe : aucun
    // CHECK ne cite le vocabulaire du serveur.
    await db.customStatement(
      'UPDATE representants SET last_call_outcome = ?, last_call_at = ?, '
      '       last_call_by_id = ?, next_callback_at = ? WHERE id = ?',
      <Object?>['ESCALATED', _iso, 'u-1', _iso, 'rep-23'],
    );
    final QueryRow apres = await db
        .customSelect(
          'SELECT last_call_outcome, last_call_by_id FROM representants',
        )
        .getSingle();
    expect(apres.read<String?>('last_call_outcome'), 'ESCALATED');
    expect(apres.read<String?>('last_call_by_id'), 'u-1');

    await db.close();
  });

  // Le périmètre d'appel et le résumé du dernier appel du prospect arrivent par
  // le MÊME palier : « Mes contacts » se lit dessus, et l'annuaire resterait
  // ouvert en grand sans la table.
  test(
    'v22 -> v23 ajoute le périmètre et le dernier appel du prospect',
    () async {
      final schema = await verifier.schemaAt(22);

      final v22schema.DatabaseAtV22 old = v22schema.DatabaseAtV22(
        schema.newConnection(),
      );
      await old.customStatement('PRAGMA foreign_keys = ON;');
      await old.customStatement(
        'INSERT INTO prospects '
        '(id, nom, prenom, phone_e164, created_by_id, projet, statut, '
        ' client_created_at, local_updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'pro-23',
          'Ndiaye',
          'Fatou',
          '+221771234567',
          'me',
          'CHUES',
          'NOUVEAU',
          _iso,
          _iso,
        ],
      );
      await old.close();

      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);

      final QueryRow fiche = await db
          .customSelect(
            'SELECT last_call_outcome, last_call_at, last_call_by_id '
            'FROM prospects',
          )
          .getSingle();
      for (final String colonne in <String>[
        'last_call_outcome',
        'last_call_at',
        'last_call_by_id',
      ]) {
        expect(fiche.read<String?>(colonne), isNull, reason: colonne);
      }

      await db.customStatement(
        'UPDATE prospects SET last_call_outcome = ?, last_call_at = ?, '
        '       last_call_by_id = ? WHERE id = ?',
        <Object?>['ESCALATED', _iso, 'u-1', 'pro-23'],
      );
      expect(
        await db
            .customSelect('SELECT last_call_by_id AS v FROM prospects')
            .getSingle()
            .then((QueryRow row) => row.read<String?>('v')),
        'u-1',
      );

      // La table neuve accepte une ligne, et son CHECK refuse un genre inconnu.
      await db.customStatement(
        'INSERT INTO attributions (kind, id) VALUES (?, ?)',
        <Object?>['prospect', 'pro-23'],
      );
      expect(
        await db
            .customSelect('SELECT COUNT(*) AS c FROM attributions')
            .getSingle()
            .then((QueryRow row) => row.read<int>('c')),
        1,
      );
      await expectLater(
        db.customStatement(
          'INSERT INTO attributions (kind, id) VALUES (?, ?)',
          <Object?>['campagne', 'x'],
        ),
        throwsA(anything),
      );

      await db.close();
    },
  );

  // Le vocabulaire de qualification arrive par une route dédiée : la table est
  // neuve et se peuple au premier pull, sans marqueur de miroir à effacer.
  test('v23 -> v24 ouvre les statuts sans toucher aux saisies en file', () async {
    final schema = await verifier.schemaAt(23);
    final v23schema.DatabaseAtV23 old = v23schema.DatabaseAtV23(
      schema.newConnection(),
    );
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'op-v23',
        'rep_call_attempt',
        'att-23',
        'create',
        '{}',
        _iso,
        _iso,
      ],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 28);

    // La table s'ÉCRIT : « elle existe » se vérifierait aussi sur des colonnes
    // au mauvais type. Un effet que ce client ignore passe, comme pour les
    // motifs : aucun CHECK ne cite le vocabulaire du serveur.
    await db.customStatement(
      'INSERT INTO statuts_qualification '
      '(code, id, label, effect, requires_callback, position) '
      'VALUES (?, ?, ?, ?, ?, ?)',
      <Object?>['A_RAPPELER', 'sq-1', 'À rappeler', 'EFFET_INCONNU', 1, 0],
    );
    final QueryRow statut = await db
        .customSelect('SELECT id, requires_callback FROM statuts_qualification')
        .getSingle();
    expect(statut.read<String>('id'), 'sq-1');
    expect(statut.read<bool>('requires_callback'), isTrue);

    expect(
      await db
          .customSelect('SELECT id FROM outbox')
          .getSingle()
          .then((QueryRow row) => row.read<String>('id')),
      'op-v23',
    );
    await db.close();
  });

  test(
    'v24 -> v25 donne aux fiches leur statut, et la vue son libellé',
    () async {
      final schema = await verifier.schemaAt(24);
      final v24schema.DatabaseAtV24 old = v24schema.DatabaseAtV24(
        schema.newConnection(),
      );
      await old.customStatement(
        'INSERT INTO representants '
        '(id, full_name, phone_e164, departement_id, created_by_id, '
        ' relation_status, client_created_at, local_updated_at) '
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        <Object?>[
          'rep-24',
          'Fiche d’avant',
          '+221771234567',
          'dep-1',
          'me',
          'AMBASSADEUR',
          _iso,
          _iso,
        ],
      );
      await old.customStatement(
        'INSERT INTO sync_state (collection, cursor, last_pulled_at) '
        'VALUES (?, ?, ?)',
        <Object?>['all', 'eyJ1cGRhdGVkQXQiOiIyMDI2LTA4LTAxIn0=', _iso],
      );
      await old.customStatement(
        'INSERT INTO sync_state (collection, last_pulled_at) VALUES (?, ?)',
        <Object?>['@lock:auth.refresh', _iso],
      );
      await old.close();

      // Jusqu'au bout : une vue recréée prend toujours sa forme courante, la
      // valider à un palier intermédiaire échouerait sur ses colonnes neuves.
      final AppDatabase db = AppDatabase(schema.newConnection());
      await verifier.migrateAndValidate(db, 27);

      // Le curseur de pull est effacé, et lui seul : les fiches déjà en base
      // redescendent avec leur statut au prochain pull.
      final List<QueryRow> cursors = await db
          .customSelect('SELECT collection FROM sync_state')
          .get();
      expect(
        cursors.map((QueryRow r) => r.read<String>('collection')),
        <String>['@lock:auth.refresh'],
      );

      // La fiche d'avant garde sa relation et n'invente pas de statut : elle
      // s'affichera sous « A accepté » tant qu'un appel ne l'aura pas qualifiée.
      final QueryRow avant = await db
          .customSelect(
            'SELECT relation_status, statut_qualification_id, '
            'statut_qualification_label FROM representant_sync_view',
          )
          .getSingle();
      expect(avant.read<String>('relation_status'), 'AMBASSADEUR');
      expect(avant.read<String?>('statut_qualification_id'), isNull);
      expect(avant.read<String?>('statut_qualification_label'), isNull);

      await db.customStatement(
        'INSERT INTO statuts_qualification (code, id, label, effect) '
        'VALUES (?, ?, ?, ?)',
        <Object?>['TRES_INTERESSE', 'sq-1', 'Très intéressé', 'REACHED'],
      );
      await db.customStatement(
        'UPDATE representants SET statut_qualification_id = ? WHERE id = ?',
        <Object?>['sq-1', 'rep-24'],
      );
      final QueryRow apres = await db
          .customSelect(
            'SELECT statut_qualification_label FROM representant_sync_view',
          )
          .getSingle();
      expect(
        apres.read<String?>('statut_qualification_label'),
        'Très intéressé',
      );
      await db.close();
    },
  );

  test('v25 -> v26 compte les appels à zéro et rouvre le curseur', () async {
    final schema = await verifier.schemaAt(25);
    final v25schema.DatabaseAtV25 old = v25schema.DatabaseAtV25(
      schema.newConnection(),
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' relation_status, client_created_at, local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'rep-25',
        'Fiche d’avant',
        '+221771234567',
        'dep-1',
        'me',
        'INCONNU',
        _iso,
        _iso,
      ],
    );
    await old.customStatement(
      'INSERT INTO sync_state (collection, cursor, last_pulled_at) '
      'VALUES (?, ?, ?)',
      <Object?>['all', 'eyJ1cGRhdGVkQXQiOiIyMDI2LTA4LTAxIn0=', _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 27);

    expect(await db.customSelect('SELECT 1 FROM sync_state').get(), isEmpty);
    final QueryRow fiche = await db
        .customSelect('SELECT call_attempt_count FROM representant_sync_view')
        .getSingle();
    expect(fiche.read<int>('call_attempt_count'), 0);
    await db.close();
  });

  test('v26 -> v27 donne à la vue l\'effet du statut', () async {
    final schema = await verifier.schemaAt(26);
    final v26schema.DatabaseAtV26 old = v26schema.DatabaseAtV26(
      schema.newConnection(),
    );
    await old.customStatement(
      'INSERT INTO statuts_qualification (code, id, label, effect) '
      'VALUES (?, ?, ?, ?)',
      <Object?>['A_RAPPELER', 'sq-1', 'À rappeler', 'SCHEDULE_CALLBACK'],
    );
    await old.customStatement(
      'INSERT INTO representants '
      '(id, full_name, phone_e164, departement_id, created_by_id, '
      ' relation_status, statut_qualification_id, client_created_at, '
      ' local_updated_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      <Object?>[
        'rep-26',
        'Fiche d’avant',
        '+221771234567',
        'dep-1',
        'me',
        'INCONNU',
        'sq-1',
        _iso,
        _iso,
      ],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 27);

    final QueryRow fiche = await db
        .customSelect(
          'SELECT statut_qualification_effect FROM representant_sync_view',
        )
        .getSingle();
    expect(fiche.read<String?>('statut_qualification_effect'), 'SCHEDULE_CALLBACK');
    await db.close();
  });

  test('v27 -> v28 donne aux statuts leur délai de réessai', () async {
    final schema = await verifier.schemaAt(27);
    final v27schema.DatabaseAtV27 old = v27schema.DatabaseAtV27(
      schema.newConnection(),
    );
    await old.customStatement(
      'INSERT INTO statuts_qualification (code, id, label, effect) '
      'VALUES (?, ?, ?, ?)',
      <Object?>['PAS_DE_REPONSE', 'sq-1', 'Pas de réponse', 'UNREACHABLE'],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 28);

    final QueryRow statut = await db
        .customSelect('SELECT retry_after_minutes FROM statuts_qualification')
        .getSingle();
    expect(statut.read<int?>('retry_after_minutes'), isNull);
    await db.close();
  });

  test('v11 -> courant traverse sans créer les tables de campagne', () async {
    final schema = await verifier.schemaAt(11);
    final v11.DatabaseAtV11 old = v11.DatabaseAtV11(schema.newConnection());
    await old.customStatement(
      'INSERT INTO outbox '
      '(id, entity_type, entity_id, op, payload, next_attempt_at, created_at) '
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      <Object?>['op-v11', 'representant', 'rep-11', 'update', '{}', _iso, _iso],
    );
    await old.close();

    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, GeneratedHelper.versions.last);
    final List<QueryRow> obsolete = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'table\' AND name IN '
          '(\'call_campaigns\', \'call_tasks\', \'rep_call_campaigns\', \'rep_call_tasks\')',
        )
        .get();
    expect(obsolete, isEmpty);
    expect(
      await db
          .customSelect('SELECT id FROM outbox')
          .getSingle()
          .then((QueryRow row) => row.read<String>('id')),
      'op-v11',
    );
    await db.close();
  });
}

/// Instant fixe, en texte ISO-8601 : c'est ainsi que drift stocke les DATETIME
/// (voir `build.yaml`), et le SQL brut de ce fichier écrit donc la même forme.
final String _iso = DateTime.utc(2026, 8, 12, 9).toIso8601String();
