// Drift gate for the generated TypeScript client.
//
// Runs at the tail of `pnpm --filter @crm/api-client generate`, so a developer
// who hand-edits src/generated/ is told immediately instead of discovering it
// in CI. Two deliberate behaviours, both taken from CPI-PLATFORM-NEW:
//
//   - Outside a git worktree (tarball, Docker build context) it exits 0. There
//     is nothing to compare against, and failing there would break the image
//     build for no reason.
//   - Locally it *reports* the drift but exits 0. Regenerating and finding a
//     diff is the normal state of a working day; only CI treats it as fatal.
//
// Two fixes over the reference:
//
//   1. `git add --intent-to-add` before the diff. `git diff` does not look at
//      untracked files: a brand-new endpoint that produces a brand-new
//      generated file leaves the diff empty and the gate green while the
//      repository is out of sync. Staging the paths as empty-content intents
//      makes those files visible to `git diff` as additions. The bug is
//      survivable here (schema.ts is a single tracked file) and lethal in
//      packages/api-client-dart, where every model is its own file.
//   2. Every git call runs with cwd = repository root. The reference passes a
//      root-relative pathspec while running from the package directory, so the
//      pathspec matches nothing and the diff is unconditionally empty.

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');
const GENERATED = 'packages/api-client/src/generated';

const git = (args, stdio) => execFileSync('git', args, { cwd: repoRoot, stdio });

try {
  git(['rev-parse', '--is-inside-work-tree'], 'ignore');
} catch {
  process.exit(0);
}

try {
  git(['add', '-A', '--intent-to-add', '--', GENERATED], 'ignore');
} catch {
  // Nothing generated yet, or the path is ignored. The diff below is then
  // trivially empty, which is the honest answer.
}

try {
  git(['diff', '--exit-code', '--', GENERATED], 'inherit');
} catch {
  console.error(
    `\n${GENERATED} is out of sync with apps/api/openapi.json.\n` +
      'Commit the regenerated files. Never edit them by hand.\n',
  );
  if (process.env.CI) process.exit(1);
}
