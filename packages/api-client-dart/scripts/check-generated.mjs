// Drift gate for the generated Dart client.
//
// Same contract as packages/api-client/scripts/check-generated.mjs: no-op
// outside a git worktree, report-but-pass locally, fatal in CI.
//
// The `git add --intent-to-add` matters far more here than on the TypeScript
// side. openapi-typescript writes ONE file, so a plain `git diff` at least
// catches every change to an existing endpoint. dart-dio writes one file per
// model and per API group, plus a *.g.dart beside each : adding a single DTO
// server-side produces four brand-new untracked files and a `git diff` that is
// completely empty. The gate would go green while apps/mobile compiles against
// a contract that no longer exists.

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');
const GENERATED = 'packages/api-client-dart/lib';

const git = (args, stdio) => execFileSync('git', args, { cwd: repoRoot, stdio });

try {
  git(['rev-parse', '--is-inside-work-tree'], 'ignore');
} catch {
  process.exit(0);
}

try {
  git(['add', '-A', '--intent-to-add', '--', GENERATED], 'ignore');
} catch {
  // Nothing generated yet. The diff below is then trivially empty.
}

try {
  git(['diff', '--exit-code', '--', GENERATED], 'inherit');
} catch {
  console.error(
    `\n${GENERATED} is out of sync with apps/api/openapi.json.\n` +
      'Commit the regenerated files, *.g.dart included. Never edit them by hand.\n',
  );
  if (process.env.CI) process.exit(1);
}
