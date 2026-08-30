#!/usr/bin/env node
//
// Applies scripts/seed-dev.sql when seeding is enabled.
//
// Gated on SEED_DATA so a test environment can bring itself up populated
// (`SEED_DATA=1 npm run seed`) while a real one cannot be seeded by accident:
// the seed is refused outright when NODE_ENV is production, whatever the flag
// says.
//
// The SQL itself is idempotent — it only touches rows in a fixed id namespace
// — so running this repeatedly is safe and re-running it after a schema change
// refreshes the fixtures in place.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const flag = (process.env.SEED_DATA ?? '').trim().toLowerCase();
const enabled = ['1', 'true', 'yes'].includes(flag);
const disabled = ['0', 'false', 'no'].includes(flag);

if (process.env.NODE_ENV === 'production') {
  console.log('seed: refused — NODE_ENV=production');
  process.exit(0);
}

if (disabled || (!enabled && flag === '')) {
  console.log(
    `seed: skipped (SEED_DATA=${flag || 'unset'}). Pass SEED_DATA=1 to seed.`,
  );
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('seed: DATABASE_URL is required');
  process.exit(1);
}

const sql = readFileSync(resolve('scripts/seed-dev.sql'), 'utf8');
const client = new Client({ connectionString });
await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*)::int FROM ateliers WHERE status='verified') AS verified,
       (SELECT count(*)::int FROM atelier_verifications WHERE decision='pending') AS pending,
       (SELECT count(*)::int FROM accounts WHERE role='platform_admin') AS admins`,
  );
  const { verified, pending, admins } = rows[0];
  console.log(
    `seed: applied — ${verified} verified atelier(s), ${pending} awaiting review, ${admins} administrator account(s)`,
  );
} finally {
  await client.end();
}
