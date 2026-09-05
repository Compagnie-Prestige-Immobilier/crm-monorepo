#!/usr/bin/env node
//
// Génère packages/api-client-<plateforme>/src/generated/schema.ts depuis le
// openapi.json committé dans le paquet.
//
//   node tools/dev/generate-plateforme-client.mjs chues
//   node tools/dev/generate-plateforme-client.mjs grand-public --export
//
// `--export` rafraîchit d'abord openapi.json en lançant `php artisan
// scramble:export` dans le backend Laravel de la plateforme (dépôt séparé,
// racine PLATEFORME_DIR, défaut ../PLATEFORME). Scramble lit le schéma en base :
// le backend doit avoir vendor/, un .env et une base migrée.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATEFORMES = {
  chues: join('CHUES', 'chues-platform-backend'),
  'grand-public': join('GRAND_PUBLIC', 'cpi-grand-public-backend'),
};

const [plateforme, ...flags] = process.argv.slice(2);
const backendRelatif = PLATEFORMES[plateforme];
if (!backendRelatif) {
  console.error(
    `Plateforme inconnue : ${plateforme}. Attendu : ${Object.keys(PLATEFORMES).join(', ')}.`,
  );
  process.exit(1);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packageDir = join(repoRoot, 'packages', `api-client-${plateforme}`);
const spec = join(packageDir, 'openapi.json');
const out = join(packageDir, 'src', 'generated', 'schema.ts');
const generated = `packages/api-client-${plateforme}/src/generated`;

// `pnpm exec` passe par un .cmd sous Windows, que Node refuse de lancer sans
// shell. Le point d'entree JS du binaire se lance partout de la meme facon.
// Resolution depuis le paquet cible : `tools/` n'est pas un espace de travail,
// rien ne s'y resout.
const requerir = createRequire(join(packageDir, 'package.json'));

const binaire = (nom) => {
  const manifeste = requerir.resolve(`${nom}/package.json`);
  const { bin } = JSON.parse(readFileSync(manifeste, 'utf8'));
  return join(dirname(manifeste), typeof bin === 'string' ? bin : bin[nom]);
};

const run = (command, args, cwd = packageDir) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' });

if (flags.includes('--export')) {
  const backend = resolve(
    repoRoot,
    process.env.PLATEFORME_DIR ?? join('..', 'PLATEFORME'),
    backendRelatif,
  );
  if (!existsSync(join(backend, 'artisan'))) {
    console.error(`Backend introuvable : ${backend}. Définir PLATEFORME_DIR.`);
    process.exit(1);
  }
  run('php', ['artisan', 'scramble:export'], backend);
  copyFileSync(join(backend, 'api.json'), spec);
  run(process.execPath, [binaire('prettier'), spec, '--write']);
}

run(process.execPath, [binaire('openapi-typescript'), spec, '-o', out]);
run(process.execPath, [binaire('prettier'), out, '--write']);

// Portillon anti-dérive, même contrat que packages/api-client/scripts/check-generated.mjs.
const git = (args, stdio) => execFileSync('git', args, { cwd: repoRoot, stdio });
try {
  git(['rev-parse', '--is-inside-work-tree'], 'ignore');
} catch {
  process.exit(0);
}
try {
  git(['add', '-A', '--intent-to-add', '--', generated], 'ignore');
} catch {
  // Rien de généré encore : le diff ci-dessous est vide, ce qui est la vérité.
}
try {
  git(['diff', '--exit-code', '--', generated], 'inherit');
} catch {
  console.error(
    `\n${generated} n'est pas à jour par rapport à openapi.json.\nCommitter les fichiers régénérés. Ne jamais les éditer à la main.\n`,
  );
  if (process.env.CI) process.exit(1);
}
