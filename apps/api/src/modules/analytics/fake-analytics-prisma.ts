import type { Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

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
  sql: () => string;
  queries: () => string[];
  calls: () => number;
}

/** Les jeux de résultats sont consommés dans l'ORDRE des appels ; une fois la file vide, le double rend un ensemble vide. */
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
