import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, PrismaPg } from './index.js';

/**
 * Applique les migrations aux DEUX schemas, `public` et `demo`.
 *
 * La production est deja couverte par `infra/docker/api-entrypoint.sh`, qui
 * migre les deux avant de laisser demarrer l'API. Ce script existe pour que
 * `pnpm db:deploy` fasse la MEME chose en local : sans lui, un poste de
 * developpement migre `public` seul, et l'API y refuse de demarrer sur une
 * divergence que rien n'expliquait.
 */
const WORKSPACES = ['public', 'demo'] as const;

function urlFor(workspace: string): string {
  const base = process.env.DATABASE_URL;
  if (base === undefined || base === '') {
    throw new Error('DATABASE_URL est obligatoire pour deployer les migrations.');
  }
  const url = new URL(base);
  url.searchParams.set('schema', workspace);
  return url.toString();
}

// Le schema doit exister AVANT que Prisma n'y ecrive sa table de migrations :
// `migrate deploy` cree les tables, pas le schema qui les porte.
async function ensureSchema(workspace: string): Promise<void> {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: urlFor('public'), max: 1 }),
  });
  try {
    await client.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${workspace}"`);
  } finally {
    await client.$disconnect();
  }
}

// `pnpm exec` passe par un .cmd sous Windows, que Node refuse de lancer sans
// shell. Le point d'entree JS du binaire se lance partout de la meme facon.
const manifeste = createRequire(import.meta.url).resolve('prisma/package.json');
const prisma = join(dirname(manifeste), JSON.parse(readFileSync(manifeste, 'utf8')).bin.prisma);

for (const workspace of WORKSPACES) {
  await ensureSchema(workspace);
  console.info(`Migrations sur le schema « ${workspace} »…`);
  execFileSync(process.execPath, [prisma, 'migrate', 'deploy'], {
    stdio: 'inherit',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: urlFor(workspace) },
  });
}

console.info('Les deux schemas portent les memes migrations.');
