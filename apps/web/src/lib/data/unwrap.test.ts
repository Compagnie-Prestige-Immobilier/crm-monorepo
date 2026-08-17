import { createApiClient } from '@crm/api-client';
import { ApiError } from '@crm/api-client/query';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { fetchProspects } from '@/lib/data/prospects';
import { fetchDashboardStats } from '@/lib/data/stats';
import { fetchUsers } from '@/lib/data/users';
import { EMPTY_FILTERS } from '@/lib/filters';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

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
    expect((failure as ApiError).message).toBe('Le calcul des statistiques a échoué.');
  });

  it('fetchUsers rejette sur 403 : un COMMERCIAL ne doit pas voir une liste vide', async () => {
    const { client } = clientReplying(403, { statusCode: 403, message: 'Accès refusé.' });

    const failure = await fetchUsers(EMPTY_USER_FILTERS, client).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(403);
  });

  it('fetchDashboardStats rejette si UN SEUL des sept appels échoue', async () => {
    let call = 0;
    const fetchImpl = vi.fn(() => {
      call += 1;
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
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const client = createApiClient('http://api.test', { fetch: fetchImpl });
    const { deleteProspect } = await import('@/lib/data/prospects');

    await expect(deleteProspect('p1', client)).resolves.toBeUndefined();
  });
});
