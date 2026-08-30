import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const directory = resolve('migrations');
const files = readdirSync(directory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
const checksum = (sql) => createHash('sha256').update(sql).digest('hex');
const body = (sql) => sql.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');

if (!files.length) throw new Error('No ordered SQL migrations found.');

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_id text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query("SELECT pg_advisory_lock(hashtextextended('gnawalma:migrations', 0))");

  const applied = await client.query('SELECT migration_id, checksum FROM schema_migrations ORDER BY migration_id');
  const known = new Map(applied.rows.map((row) => [row.migration_id, row.checksum]));
  for (const migrationId of known.keys()) {
    if (!files.includes(migrationId)) throw new Error(`Applied migration is missing from disk: ${migrationId}`);
  }

  for (const migrationId of files) {
    const sql = readFileSync(resolve(directory, migrationId), 'utf8').trim();
    const digest = checksum(sql);
    const previous = known.get(migrationId);
    if (previous && previous !== digest) throw new Error(`Checksum mismatch for applied migration: ${migrationId}`);
    if (previous) continue;

    await client.query('BEGIN');
    try {
      await client.query(body(sql));
      await client.query('INSERT INTO schema_migrations (migration_id, checksum) VALUES ($1, $2)', [migrationId, digest]);
      await client.query('COMMIT');
      console.log(`Applied ${migrationId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  console.log(`Migration state is current (${files.length} file(s)).`);
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtextextended('gnawalma:migrations', 0))").catch(() => undefined);
  await client.end();
}
