import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface Parameter {
  name: string;
  in: string;
}

interface Operation {
  operationId?: string;
  parameters?: Parameter[];
  responses?: Record<string, { content?: Record<string, unknown> }>;
}

interface Document {
  paths: Record<string, Record<string, Operation>>;
}

const document = JSON.parse(
  readFileSync(new URL('../../../openapi.json', import.meta.url), 'utf8'),
) as Document;

const get = (path: string): Operation => {
  const found = document.paths[path]?.get;
  if (!found) throw new Error(`opération absente du contrat : GET ${path}`);
  return found;
};

const queryNames = (path: string): string[] =>
  (get(path).parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name);

const XLSX_ROUTES = [
  '/api/v1/export/prospects.xlsx',
  '/api/v1/export/representants.xlsx',
  '/api/v1/export/bank-cases.xlsx',
  '/api/v1/export/visites.xlsx',
];

describe('contrat des exports Excel', () => {
  it('les trois routes déclarent le classeur en binaire, pas en JSON', () => {
    for (const path of XLSX_ROUTES) {
      const ok = get(path).responses?.['200'];
      expect(ok?.content, `${path} : réponse 200 sans content`).toBeDefined();
      expect(Object.keys(ok?.content ?? {}), `${path} : type de contenu`).toContain(XLSX_MIME);
    }
  });

  // `representants-export.service.ts` parcourt la table en keyset sur `id asc`
  it('l’export des représentants n’annonce ni pagination ni tri', () => {
    const names = queryNames('/api/v1/export/representants.xlsx');

    for (const absent of ['page', 'pageSize', 'sortBy', 'sortOrder']) {
      expect(names, `${absent} est annoncé mais jamais lu`).not.toContain(absent);
    }
  });

  it('mais garde tous ses filtres, pour que l’export corresponde à l’écran', () => {
    const names = queryNames('/api/v1/export/representants.xlsx');

    for (const present of [
      'search',
      'departementId',
      'iefId',
      'commercialId',
      'dateFrom',
      'dateTo',
      'hasProspects',
    ]) {
      expect(names, `filtre ${present} perdu`).toContain(present);
    }
  });

  // `visites-export.service.ts` parcourt la table en keyset sur `reference asc`
  it('l’export des visites n’annonce ni pagination ni tri', () => {
    const names = queryNames('/api/v1/export/visites.xlsx');

    for (const absent of ['page', 'pageSize', 'sortBy', 'sortOrder']) {
      expect(names, `${absent} est annoncé mais jamais lu`).not.toContain(absent);
    }
  });

  it('mais garde tous ses filtres, pour que l’export des visites corresponde à l’écran', () => {
    const names = queryNames('/api/v1/export/visites.xlsx');

    for (const present of [
      'from',
      'to',
      'entrepriseId',
      'directionId',
      'destinataireId',
      'objetId',
      'search',
    ]) {
      expect(names, `filtre ${present} perdu`).toContain(present);
    }
  });
});
