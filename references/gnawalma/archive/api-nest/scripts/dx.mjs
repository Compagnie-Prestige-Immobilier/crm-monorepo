#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(apiDirectory, '..', '..', 'docker-compose.yml');
const packageMetadata = JSON.parse(readFileSync(resolve(apiDirectory, 'package.json'), 'utf8'));
const args = new Set(process.argv.slice(2));

const help = `Gnawalma backend developer environment

Usage: npm run dx -- [options]

Options:
  --seed        Load deterministic demo data
  --setup-only  Prepare the backend without starting Nest
  --help        Show this help
  --version     Show the API version`;

if (args.has('--help')) {
  console.log(help);
  process.exit(0);
}
if (args.has('--version')) {
  console.log(packageMetadata.version);
  process.exit(0);
}

const supported = new Set(['--seed', '--setup-only']);
const unknown = [...args].filter((arg) => !supported.has(arg));
if (unknown.length) {
  console.error(`dx: unknown option ${unknown.join(', ')}\nRun "npm run dx -- --help" for usage.`);
  process.exit(2);
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: apiDirectory,
      env: process.env,
      stdio: 'inherit',
      ...options,
    });
    child.once('error', (error) => reject(new Error(`Could not run ${command}: ${error.message}`)));
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} stopped by ${signal}`));
      else if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function ensureEnvironment() {
  const environmentFile = resolve(apiDirectory, '.env');
  if (!existsSync(environmentFile)) {
    const template = readFileSync(resolve(apiDirectory, '.env.example'), 'utf8')
      .replace('postgres://gnawalma:change-me@127.0.0.1:5432/gnawalma', 'postgres://gnawalma:local-only-password@127.0.0.1:5432/gnawalma')
      .replace('replace-with-at-least-32-random-bytes', randomBytes(32).toString('hex'))
      .replace('replace-with-a-different-at-least-32-random-bytes', randomBytes(32).toString('hex'))
      .replace('https://api.example.sn', 'http://localhost:3000');
    writeFileSync(environmentFile, template, { mode: 0o600, flag: 'wx' });
    console.error('dx: created .env with local-only secrets');
  }
  process.loadEnvFile(environmentFile);

  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to run with NODE_ENV=production');
  }
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname)) {
    throw new Error('DATABASE_URL must point to localhost; dx never migrates a remote database');
  }
}

try {
  console.error('dx: installing dependencies');
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install']);
  ensureEnvironment();

  console.error('dx: starting PostgreSQL');
  await run('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait', 'postgres']);

  console.error('dx: applying migrations');
  await run(process.execPath, ['./scripts/run-migrations.mjs']);

  if (args.has('--seed')) {
    console.error('dx: loading demo data');
    await run(process.execPath, ['./scripts/seed.mjs'], {
      env: { ...process.env, SEED_DATA: '1' },
    });
  }

  if (!args.has('--setup-only')) {
    console.error('dx: starting API on http://localhost:3000');
    await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start:dev']);
  }
} catch (error) {
  console.error(`dx: ${error.message}`);
  process.exitCode = 1;
}
