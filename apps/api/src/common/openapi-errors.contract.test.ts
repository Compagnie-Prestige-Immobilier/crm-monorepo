import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Garde sur les réponses d'ERREUR du contrat publié.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE TEST EMPÊCHE DE REVENIR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Sur 119 opérations, 55 déclarations `@ApiResponse` 4xx existaient et DEUX
 * portaient un schéma. OpenAPI publiait donc, pour presque toutes les erreurs,
 * une réponse sans `content`, dont les générateurs TypeScript et Dart ne
 * pouvaient tirer qu'`unknown`. Les deux clients ont fini par écrire chacun
 * son propre décodeur d'erreur, et par deviner la forme du corps.
 *
 * Le remède n'est pas d'ajouter `type: ApiErrorDto` à la main partout : c'est
 * exactement ce qui a été oublié 53 fois. Il tient dans le décorateur
 * `ApiErrors` et dans ce test, qui refuse la prochaine omission.
 *
 * Le test lit le document RÉELLEMENT publié, pas les décorateurs : c'est lui
 * que consomment les générateurs.
 */

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

/** Toutes les réponses d'erreur du contrat, aplaties. */
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

/**
 * Schémas admis pour un corps d'erreur : `ApiErrorDto`, ou l'un de ses
 * SPÉCIALISATIONS. `ProspectConflictDto` en est une : elle hérite des trois
 * champs garantis et ajoute la fiche déjà enregistrée, ce qui reste un corps
 * d'erreur exploitable de la même façon.
 */
const ERROR_SCHEMAS = new Set(['ApiErrorDto', 'ProspectConflictDto']);

const refOf = (response: Response): string | undefined => {
  // Toujours `application/json` : une erreur sort en JSON même sur une route
  // qui produit un PDF ou un APK. C'est précisément ce que `@ApiProduces`
  // faisait mentir, en collant son type binaire à TOUTES les réponses.
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
    // Toujours présents : c'est la promesse sur laquelle un client branche.
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

  // 401 et 403 n'étaient déclarés que 3 et 4 fois sur 119 opérations, alors que
  // la garde de rôles s'applique à toutes : le contrat laissait croire que la
  // plupart des routes ne pouvaient pas refuser un jeton ou un rôle.
  it('toute opération authentifiée annonce 401 et 403', () => {
    const manquantes = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.entries(item)
        .filter(([, operation]) => {
          const statuses = Object.keys(operation.responses ?? {});
          // Les sondes et les routes publiques n'ont pas de 4xx d'authentification.
          return statuses.some((s) => Number(s) >= 400) && !path.startsWith('/health');
        })
        .filter(([, operation]) => {
          const statuses = Object.keys(operation.responses ?? {});
          return !statuses.includes('401') || !statuses.includes('403');
        })
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    );

    // Les routes publiques (authentification, mise à jour Android) sont les
    // seules admises : elles refusent pour d'autres raisons.
    for (const route of manquantes) {
      expect(
        route.includes('/auth/') || route.includes('/app-updates/'),
        `${route} n’annonce ni 401 ni 403 alors qu’elle est authentifiée`,
      ).toBe(true);
    }
  });
});
