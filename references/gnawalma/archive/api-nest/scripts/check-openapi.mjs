#!/usr/bin/env node
//
// Fails when the committed openapi.json no longer matches what the zod schemas
// produce.
//
// The spec was previously hand-maintained beside the code and drifted until it
// documented 22 of 29 routes, omitted the entire /admin module, described Order
// as an untyped object, and claimed two endpoints returned the same shape when
// one of them did not select half the fields. Nothing failed, because nothing
// compared the two.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const committedPath = join(root, 'openapi.json');

let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  console.error('openapi.json is missing. Run: npm run openapi:generate');
  process.exit(1);
}

// Generate into a scratch directory so a failing check never rewrites the file
// it is checking.
const scratch = mkdtempSync(join(tmpdir(), 'gnawalma-openapi-'));
execFileSync('node', [join(root, 'dist/src/contracts/generate-openapi.js')], {
  cwd: scratch,
  stdio: 'pipe',
});
const generated = readFileSync(join(scratch, 'openapi.json'), 'utf8');

if (generated === committed) {
  const document = JSON.parse(committed);
  const operations = Object.values(document.paths).reduce(
    (total, methods) => total + Object.keys(methods).length,
    0,
  );
  console.log(`✓ openapi.json matches the schemas (${operations} operations)`);
  process.exit(0);
}

writeFileSync(join(root, 'openapi.generated.json'), generated);
console.error(
  [
    '✗ openapi.json is out of date.',
    '',
    'The zod schemas in src/contracts/schemas.ts no longer produce the',
    'committed document. Regenerate and commit the result:',
    '',
    '    npm run openapi:generate',
    '',
    'The freshly generated document was written to openapi.generated.json',
    'for comparison.',
  ].join('\n'),
);
process.exit(1);
