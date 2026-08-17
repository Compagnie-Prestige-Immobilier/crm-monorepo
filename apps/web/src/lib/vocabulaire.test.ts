import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXEMPT = new Set([
  'lib/query-keys.ts',
  'lib/user-filters.ts',
  'lib/data/inbox.ts',
  'components/layout/nav-items.ts',
]);

const FORBIDDEN = /\b(commercial|commerciale|commerciaux|commerciales)\b/iu;

function renderable(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');

  const strings = [...withoutComments.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/gu)].map(
    (match) => (match[1] ?? match[2] ?? match[3] ?? '').replace(/\$\{[^}]*\}/gu, ''),
  );

  const jsxText = [...withoutComments.matchAll(/>([^<>{}]+)</gu)]
    .map((match) => match[1] ?? '')
    .filter((text) => !/[=;()[\]|&$/*+`_]/u.test(text) && /\p{L}/u.test(text));

  return [...strings, ...jsxText];
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('vocabulaire de l’interface', () => {
  it('ne dit jamais « commercial » là où l’utilisateur lit « téléconseiller »', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const relative = path.relative(SRC, file).split(path.sep).join('/');
      if (EXEMPT.has(relative)) continue;

      for (const value of renderable(readFileSync(file, 'utf8'))) {
        if (!/\s/u.test(value)) continue;
        if (FORBIDDEN.test(value)) offenders.push(`${relative} : « ${value.trim()} »`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
