// Generates src/generated/schema.ts from apps/api/openapi.json.
//
// Wrapped in a script rather than chained in package.json for one reason: the
// spec is itself generated (by `@crm/api#openapi:generate`) and may legitimately
// not exist yet on a fresh clone whose API has never been booted. `turbo run
// generate` must not die with an ENOENT stack trace in that case : but it must
// absolutely die in CI, where a missing spec means the upstream task silently
// did nothing.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');
const spec = join(repoRoot, 'apps', 'api', 'openapi.json');
const out = join(packageDir, 'src', 'generated', 'schema.ts');

if (!existsSync(spec)) {
  const message =
    `apps/api/openapi.json not found.\n` +
    `It is generated from the NestJS app : run:\n\n` +
    `  pnpm --filter @crm/api openapi:generate\n\n` +
    `(or simply \`pnpm turbo run generate\`, which resolves that task first).\n`;

  if (process.env.CI) {
    console.error(`\n${message}`);
    console.error('Refusing to continue in CI: the contract must exist before the clients.\n');
    process.exit(1);
  }

  console.warn(`\n${message}`);
  console.warn('Skipping TypeScript client generation. The committed schema.ts is left as is.\n');
  process.exit(0);
}

// `pnpm exec` passe par un .cmd sous Windows, que Node refuse de lancer sans
// shell. Le point d'entree JS du binaire se lance partout de la meme facon.
const binaire = (nom) => {
  const manifeste = createRequire(import.meta.url).resolve(`${nom}/package.json`);
  const { bin } = JSON.parse(readFileSync(manifeste, 'utf8'));
  return join(dirname(manifeste), typeof bin === 'string' ? bin : bin[nom]);
};

const run = (command, args) => {
  execFileSync(command, args, { cwd: packageDir, stdio: 'inherit' });
};

run(process.execPath, [binaire('openapi-typescript'), spec, '-o', out]);
run(process.execPath, [binaire('prettier'), out, '--write']);
run('node', [join(packageDir, 'scripts', 'check-generated.mjs')]);
