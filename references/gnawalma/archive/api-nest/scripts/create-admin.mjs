#!/usr/bin/env node
//
// Creates or re-keys a platform administrator.
//
// `POST /auth/register` only ever issues `atelier_owner` and `client` roles, by
// design — an account that can approve ateliers and publish reviews must not be
// self-service. Nothing else created one either, so a fresh deployment had a
// back-office with no account able to sign in to it and a verification queue
// nobody could work. This is that missing step, kept explicit and auditable
// rather than hidden inside the running service.
//
// Usage:
//   DATABASE_URL=... ADMIN_PHONE=+221780000000 ADMIN_PIN=... \
//     node scripts/create-admin.mjs
//
// The PIN is read from the environment rather than an argument so it does not
// land in the shell history. Re-running with the same phone updates the PIN of
// the existing administrator instead of failing on the unique constraint.

import argon2 from 'argon2';
import pg from 'pg';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
const phone = (process.env.ADMIN_PHONE ?? '').trim();
const pin = (process.env.ADMIN_PIN ?? '').trim();
const displayName = (process.env.ADMIN_NAME ?? 'Administration').trim();

const fail = (message) => {
  console.error(`create-admin: ${message}`);
  process.exit(1);
};

if (!connectionString) fail('DATABASE_URL is required');
if (!phone) fail('ADMIN_PHONE is required, in E.164 form (e.g. +221780000000)');
if (!/^\+\d{8,15}$/.test(phone)) {
  fail(`ADMIN_PHONE must be E.164 — received "${phone}"`);
}
// Same policy the API enforces (`assertPin`), stated here so a PIN this script
// accepts is a PIN the login endpoint will accept.
if (!/^\d{4,8}$/.test(pin)) fail('ADMIN_PIN must contain 4–8 digits');

const client = new Client({
  connectionString,
  // Managed Postgres providers terminate plaintext connections; the certificate
  // is theirs and not in the local trust store, which is why verification is
  // relaxed rather than TLS disabled.
  ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
  const { rows } = await client.query(
    `INSERT INTO accounts (phone_e164,pin_hash,display_name,role)
     VALUES ($1,$2,$3,'platform_admin')
     ON CONFLICT (phone_e164) DO UPDATE SET
       pin_hash=EXCLUDED.pin_hash,
       display_name=EXCLUDED.display_name,
       role='platform_admin',
       is_active=true,
       failed_login_count=0,
       locked_until=NULL,
       updated_at=now()
     RETURNING id, (xmax = 0) AS created`,
    [phone, pinHash, displayName],
  );
  const { id, created } = rows[0];
  console.log(
    `create-admin: ${created ? 'created' : 'updated'} platform administrator ${id} (${phone})`,
  );
} finally {
  await client.end();
}
