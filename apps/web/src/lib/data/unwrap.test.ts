import { createApiClient } from '@crm/api-client';
import { ApiError } from '@crm/api-client/query';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { fetchProspects } from '@/lib/data/prospects';
import { fetchDashboardStats } from '@/lib/data/stats';
import { fetchUsers } from '@/lib/data/users';
import { EMPTY_FILTERS } from '@/lib/filters';
import { DEFAULT_USER_FILTERS } from '@/lib/data/users';

/**
 * LE test de non-régression du panel.
 *
 * `openapi-fetch` ne lève JAMAIS : un 500 et un 200 reviennent tous deux comme
 * une promesse tenue, `{ data, error, response }`. TanStack Query, lui, ne
 * distingue succès et erreur qu'à la rejection de la promesse du `queryFn`.
 *
 * Oublier un `unwrap()` ne casse donc rien de visible : la requête passe en
 * `isSuccess`, `data` vaut `undefined`, et l'écran affiche « aucun prospect »
 * au lieu de « le serveur a répondu 500 ». C'est un mensonge silencieux, et
 * c'est exactement ce que ces tests interdisent.
 *
 * On ne teste pas `unwrap` lui-même — il est couvert dans `@crm/api-client`.
 * On teste que CHAQUE fonction de `src/lib/data` le traverse, et que l'erreur
 * arrive bien jusqu'à l'état d'erreur de React Query.
 */

/** Client d'API dont le `fetch` répond ce qu'on lui dit, sans réseau. */
function clientReplying(status: number, body: unknown) {
  const fetchImpl = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  return { client: createApiClient('http://api.test', { fetch: fetchImpl }), fetchImpl };
}

const errorBody = {
  statusCode: 500,
  message: 'Le calcul des statistiques a échoué.',
  error: 'Internal Server Error',
};

describe('propagation des erreurs par unwrap()', () => {
  it('fetchProspects rejette en ApiError plutôt que de renvoyer undefined', async () => {
    const { client } = clientReplying(500, errorBody);

    const failure = await fetchProspects(EMPTY_FILTERS, client).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(500);
    // Le message du backend est conservé : sans lui, l'écran ne peut afficher
    // qu'un « Erreur » nu, ce que docs/design.md interdit.
    expect((failure as ApiError).message).toBe('Le calcul des statistiques a échoué.');
  });

  it('fetchUsers rejette sur 403 — un COMMERCIAL ne doit pas voir une liste vide', async () => {
    const { client } = clientReplying(403, { statusCode: 403, message: 'Accès refusé.' });

    const failure = await fetchUsers(DEFAULT_USER_FILTERS, client).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(403);
  });

  it('fetchDashboardStats rejette si UN SEUL des sept appels échoue', async () => {
    // Le tableau de bord agrège sept endpoints en parallèle. Si l'un tombe et
    // que l'erreur est avalée, les KPI affichent des zéros crédibles — le pire
    // cas possible pour un écran de direction.
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
      // Le 3e appel (top-commercials) échoue, les autres réussissent.
      if (call === 3) {
        return Promise.resolve(
          new Response(JSON.stringify(errorBody), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ items: [], buckets: [], prospects: 0, representants: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    const client = createApiClient('http://api.test', { fetch: fetchImpl });

    await expect(fetchDashboardStats(EMPTY_FILTERS, client)).rejects.toBeInstanceOf(ApiError);
  });

  it("l'erreur atteint l'état d'erreur de React Query, pas son état de succès", async () => {
    // C'est l'assertion qui compte vraiment : la preuve de bout en bout que la
    // requête bascule en `isError` et non en `isSuccess` avec `data`
    // `undefined`.
    const { client } = clientReplying(500, errorBody);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const observer = new QueryObserver(queryClient, {
      queryKey: ['prospects', 'test'],
      queryFn: () => fetchProspects(EMPTY_FILTERS, client),
      retry: false,
    });

    const result = await new Promise<ReturnType<typeof observer.getCurrentResult>>((resolve) => {
      const unsubscribe = observer.subscribe((next) => {
        if (next.isError || next.isSuccess) {
          unsubscribe();
          resolve(next);
        }
      });
    });

    expect(result.isError).toBe(true);
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ApiError);
    // La régression exacte que l'on interdit : un succès dont les données sont
    // absentes.
    expect(result.status === 'success' && (result.data as unknown) === undefined).toBe(false);

    queryClient.clear();
  });

  it('un 200 traverse unwrap sans dommage', async () => {
    const { client } = clientReplying(200, {
      items: [{ id: 'p1', nom: 'Sarr' }],
      meta: { total: 1, page: 1, pageSize: 25, pageCount: 1 },
    });

    const page = await fetchProspects(EMPTY_FILTERS, client);

    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
  });

  it('un 204 sans corps n’est PAS traité comme une erreur', async () => {
    // `unwrap` ne lève que sur un `error` renseigné. Une suppression logique
    // répond 204 : la confondre avec un échec afficherait un message rouge
    // après une opération réussie.
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = createApiClient('http://api.test', { fetch: fetchImpl });
    const { deleteProspect } = await import('@/lib/data/prospects');

    await expect(deleteProspect('p1', client)).resolves.toBeUndefined();
  });
});
