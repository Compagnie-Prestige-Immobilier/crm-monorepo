import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Le contrat des exports, relu sur le document RÉELLEMENT publié.
 *
 * Même convention que `modules/bank-cases/openapi-contract.test.ts` : c'est ce
 * fichier que consomment les générateurs TypeScript et Dart, et lui seul. Le
 * contrôle de dérive en intégration continue le régénère et compare octet à
 * octet, si bien qu'un décorateur oublié se voit ici.
 *
 * Ces essais existent parce que les trois routes d'export s'étaient mises à
 * diverger sans que rien ne le signale : deux annonçaient leur type de contenu,
 * la troisième non, et l'une d'elles publiait quatre paramètres qu'elle n'a
 * jamais lus.
 */

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
];

describe('contrat des exports Excel', () => {
  // Régression : `prospects.xlsx` était la seule des trois routes sans
  // `@ApiProduces`. Le générateur Dart en tirait une méthode qui tentait de
  // désérialiser le classeur en JSON.
  it('les trois routes déclarent le classeur en binaire, pas en JSON', () => {
    for (const path of XLSX_ROUTES) {
      const ok = get(path).responses?.['200'];
      expect(ok?.content, `${path} : réponse 200 sans content`).toBeDefined();
      expect(Object.keys(ok?.content ?? {}), `${path} : type de contenu`).toContain(XLSX_MIME);
    }
  });

  // Régression : la route réutilisait `RepresentantQueryDto`, si bien que le
  // contrat ANNONÇAIT `page`, `pageSize`, `sortBy` et `sortOrder`.
  // `representants-export.service.ts` parcourt la table en keyset sur `id asc`
  // et n'en lit aucun : un client qui demandait `?page=3&sortBy=prospects`
  // recevait le classeur entier, trié par identifiant, sans avertissement.
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
});
