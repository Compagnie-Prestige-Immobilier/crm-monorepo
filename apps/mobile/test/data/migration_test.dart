import 'package:cpi_go/data/local/database.dart';
import 'package:drift/drift.dart' show QueryRow;
import 'package:drift/native.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';

import 'generated_migrations/schema.dart';
import 'generated_migrations/schema_v1.dart' as v1;

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
  // le plus vite et celle où l'on oublie le plus facilement un index — un
  // `createTable` sans son `createIndex` produit une base qui fonctionne en test
  // et qui met plusieurs secondes par recherche sur 500 000 lignes en
  // production, sans jamais lever d'erreur.

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
    await verifier.migrateAndValidate(db, 2);

    // La saisie a traversé.
    final List<QueryRow> representants =
        await db.customSelect('SELECT id FROM representants').get();
    expect(representants.map((QueryRow r) => r.read<String>('id')), <String>['rep-1']);
    final List<QueryRow> pending = await db
        .customSelect('SELECT id FROM outbox WHERE status = \'pending\'')
        .get();
    expect(pending, hasLength(1));

    // Les deux tables de phase 2 existent et sont vides — un annuaire ne se
    // fabrique pas par migration, il se télécharge.
    final List<QueryRow> directory =
        await db.customSelect('SELECT COUNT(*) AS c FROM phase2_directory').get();
    expect(directory.single.read<int>('c'), 0);
    final List<QueryRow> attempts =
        await db.customSelect('SELECT COUNT(*) AS c FROM call_attempts').get();
    expect(attempts.single.read<int>('c'), 0);

    await db.close();
  });

  test('v1 -> v2 crée les index de l\'annuaire, pas seulement les tables', () async {
    final schema = await verifier.schemaAt(1);
    final AppDatabase db = AppDatabase(schema.newConnection());
    await verifier.migrateAndValidate(db, 2);

    final List<QueryRow> indexes = await db
        .customSelect(
          'SELECT name FROM sqlite_master '
          'WHERE type = \'index\' AND tbl_name IN (\'phase2_directory\', \'call_attempts\')',
        )
        .get();
    final Set<String> names =
        indexes.map((QueryRow r) => r.read<String>('name')).toSet();

    // `phase2_directory_phone_unique` est le seul index qui rende la recherche
    // par téléphone tenable : sans lui, chaque numéro tapé déclenche un balayage
    // complet de l'annuaire — des secondes par appel sur un téléphone d'entrée
    // de gamme, multipliées par la pile de numéros de la journée.
    expect(names, contains('phase2_directory_phone_unique'));
    expect(names, contains('phase2_directory_status_idx'));
    expect(names, contains('call_attempts_prospect_idx'));
    expect(names, contains('call_attempts_created_idx'));

    await db.close();
  });
}

/// Instant fixe, en texte ISO-8601 : c'est ainsi que drift stocke les DATETIME
/// (voir `build.yaml`), et le SQL brut de ce fichier écrit donc la même forme.
final String _iso = DateTime.utc(2026, 8, 12, 9).toIso8601String();
