import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DEMO_EXEMPTIONS,
  DEMO_EXEMPTIONS_SENTENCE,
} from '../decorators/demo-writable.decorator.js';

const MODULES = new URL('../../modules', import.meta.url).pathname;

const EXPECTED = [
  'auth/auth.controller.ts → ouvrir et fermer une session n’écrit aucune donnée métier',
  'demo/demo.controller.ts → sans quoi le mode démonstration ne pourrait plus être éteint',
  'notifications/notifications.controller.ts → acte personnel et inoffensif, sans effet sur les chiffres',
  'notifications/templates.controller.ts → aperçu calculé, aucune écriture malgré la méthode POST',
  'sync/sync.controller.ts → la remontée hors ligne ne doit JAMAIS être refusée',
] as const;

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.controller.ts') ? [path] : [];
    }),
  );
  return files.flat();
}

async function sweep(): Promise<{ sites: string[]; empty: string[] }> {
  const files = (await walk(MODULES)).sort();
  const sites: string[] = [];
  const empty: string[] = [];

  for (const file of files) {
    const relative = file.slice(MODULES.length).replace(/^\/+/, '');
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/@DemoWritable\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) {
      const reason = match[1] ?? '';
      if (reason.trim() === '') empty.push(relative);
      sites.push(`${relative} → ${reason}`);
    }
  }

  return { sites: sites.sort(), empty };
}

describe('dispenses de lecture seule, balayage', () => {
  it('la liste des dispenses est EXACTEMENT celle qui a été justifiée', async () => {
    const { sites } = await sweep();

    expect(
      sites,
      'Une dispense a été ajoutée, retirée ou reformulée. Chacune rouvre le trou ' +
        'que DemoReadOnlyGuard ferme : justifiez-la dans EXPECTED, ou retirez-la.',
    ).toEqual([...EXPECTED]);
  });

  it('aucune dispense muette', async () => {
    const { empty } = await sweep();

    expect(
      empty,
      'Le motif est un PARAMÈTRE et non un commentaire, précisément pour qu’il ' +
        'ne puisse pas être omis. Une chaîne vide contourne l’intention.',
    ).toEqual([]);
  });

  it('la prose du contrat énumère EXACTEMENT les dispenses posées dans le code', async () => {
    const { sites } = await sweep();
    const reasonsPosees = sites.map((site) => site.split(' → ')[1] ?? '').sort();

    expect(
      DEMO_EXEMPTIONS.map((exemption) => exemption.reason).sort(),
      'DEMO_EXEMPTIONS ne décrit plus les dispenses réellement posées. C’est cette ' +
        'table qui compose les descriptions OpenAPI lues par le panneau : un écart ' +
        'ici fait mentir la confirmation affichée à l’administrateur.',
    ).toEqual(reasonsPosees);

    expect(DEMO_EXEMPTIONS.filter((exemption) => exemption.label.trim() === '')).toEqual([]);
  });

  it('les trois descriptions PUBLIÉES portent la liste complète', () => {
    const document = JSON.parse(
      readFileSync(new URL('../../../openapi.json', import.meta.url), 'utf8'),
    ) as {
      paths: Record<string, Record<string, { operationId?: string; description?: string }>>;
      components: {
        schemas: Record<string, { properties?: Record<string, { description?: string }> }>;
      };
    };

    const enable = Object.values(document.paths)
      .flatMap((item) => Object.values(item))
      .find((operation) => operation.operationId === 'enableDemoMode');

    const proses = [
      document.components.schemas.DemoStatusDto?.properties?.enabled?.description ?? '',
      document.components.schemas.ApiErrorDto?.properties?.code?.description ?? '',
      enable?.description ?? '',
    ];

    for (const prose of proses) {
      expect(prose, 'description absente du contrat publié').not.toBe('');
      expect(
        prose.includes(DEMO_EXEMPTIONS_SENTENCE),
        `Cette description n’énumère pas les dispenses : ${prose}`,
      ).toBe(true);
    }
  });

  it('la garde est enregistrée globalement, et APRÈS l’authentification', async () => {
    const source = await readFile(new URL('../../app.module.ts', import.meta.url).pathname, 'utf8');

    expect(source).toContain('{ provide: APP_GUARD, useClass: DemoReadOnlyGuard }');

    const roles = source.indexOf('useClass: RolesGuard');
    const readOnly = source.indexOf('useClass: DemoReadOnlyGuard');
    expect(roles).toBeGreaterThan(-1);
    expect(readOnly).toBeGreaterThan(roles);
  });
});
