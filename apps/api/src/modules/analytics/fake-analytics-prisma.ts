import type { Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Double d'essai du client Prisma pour les agrégats.
 *
 * Même convention que `modules/sync/fake-prisma.ts` : le double vit à côté de
 * ce qu'il imite, et non dans un dossier `__mocks__` que personne ne relit.
 *
 * Il rend la requête réellement composée, fragments `Prisma.Sql` aplatis. Sans
 * cela un test ne pourrait vérifier que la forme du résultat, jamais la clause
 * envoyée à PostgreSQL : c'est pourtant là que se cache l'oubli redouté, celui
 * de la visibilité de démonstration sur une table jointe.
 *
 * Les jeux de résultats sont consommés dans l'ORDRE des appels. Un service qui
 * lance deux requêtes en parallèle les compose de gauche à droite, si bien que
 * l'ordre reste déterministe ; une fois la file vide, le double rend un
 * ensemble vide, ce qui est exactement le cas limite à couvrir.
 */

/** Requête rendue avec ses paramètres substitués, pour être lisible par un test. */
export function rendered(sql: Prisma.Sql): string {
  return sql.strings.reduce(
    (text, chunk, index) =>
      index === 0 ? chunk : `${text}${JSON.stringify(sql.values[index - 1])}${chunk}`,
    '',
  );
}

function flatten(strings: TemplateStringsArray, values: unknown[]): string {
  return strings.reduce((text, chunk, index) => {
    if (index === 0) return chunk;
    const value: unknown = values[index - 1];
    const isSql =
      typeof value === 'object' && value !== null && 'strings' in value && 'values' in value;
    return `${text}${isSql ? rendered(value as Prisma.Sql) : JSON.stringify(value)}${chunk}`;
  }, '');
}

export interface FakePrisma {
  service: PrismaService;
  /** Toutes les requêtes concaténées. */
  sql: () => string;
  /** Chaque requête séparément, dans l'ordre des appels. */
  queries: () => string[];
  calls: () => number;
}

export function makeAnalyticsPrisma(...results: unknown[][]): FakePrisma {
  const seen: string[] = [];
  const queue = [...results];

  const prisma = {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
      seen.push(flatten(strings, values));
      return Promise.resolve(queue.shift() ?? []);
    },
  };

  return {
    service: prisma as unknown as PrismaService,
    sql: () => seen.join('\n'),
    queries: () => [...seen],
    calls: () => seen.length,
  };
}
