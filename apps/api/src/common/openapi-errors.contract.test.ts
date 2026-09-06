import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface Response {
  content?: Record<string, { schema?: { $ref?: string; allOf?: { $ref?: string }[] } }>;
}

interface Operation {
  operationId?: string;
  responses?: Record<string, Response>;
}

interface Document {
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }>;
  };
}

const document = JSON.parse(
  readFileSync(new URL('../../openapi.json', import.meta.url), 'utf8'),
) as Document;

const errorResponses = (): { where: string; status: string; response: Response }[] =>
  Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item).flatMap(([method, operation]) =>
      Object.entries(operation.responses ?? [])
        .filter(([status]) => Number(status) >= 400)
        .map(([status, response]) => ({
          where: `${method.toUpperCase()} ${path} (${operation.operationId ?? '?'})`,
          status,
          response,
        })),
    ),
  );

const ERROR_SCHEMAS = new Set(['ApiErrorDto', 'ProspectConflictDto']);

const refOf = (response: Response): string | undefined => {
  const schema = response.content?.['application/json']?.schema;
  const ref = schema?.$ref ?? schema?.allOf?.[0]?.$ref;
  return ref?.replace('#/components/schemas/', '');
};

describe('contrat des réponses d’erreur', () => {
  it('le schéma partagé existe et porte les trois champs toujours présents', () => {
    const schema = document.components.schemas.ApiErrorDto;
    if (!schema) throw new Error('ApiErrorDto absent du contrat');

    expect(Object.keys(schema.properties ?? {})).toEqual(
      expect.arrayContaining(['statusCode', 'code', 'message']),
    );
    expect(schema.required ?? []).toEqual(
      expect.arrayContaining(['statusCode', 'code', 'message']),
    );
  });

  it('AUCUNE réponse d’erreur ne sort sans corps typé', () => {
    const sansSchema = errorResponses()
      .filter(({ response }) => !ERROR_SCHEMAS.has(refOf(response) ?? ''))
      .map(({ where, status }) => `${status} sur ${where}`);

    expect(sansSchema).toEqual([]);
  });

  it('toute opération authentifiée annonce 401 et 403', () => {
    const manquantes = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, operation]) => {
          const statuses = Object.keys(operation.responses ?? {});
          return statuses.some((s) => Number(s) >= 400) && !path.startsWith('/health');
        })
        .filter(([, operation]) => {
          const statuses = Object.keys(operation.responses ?? {});
          return !statuses.includes('401') || !statuses.includes('403');
        })
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    );

    for (const route of manquantes) {
      expect(
        route.includes('/auth/') ||
          route.includes('/app-updates/') ||
          route.includes('/formulaire-public/'),
        `${route} n’annonce ni 401 ni 403 alors qu’elle est authentifiée`,
      ).toBe(true);
    }
  });
});
