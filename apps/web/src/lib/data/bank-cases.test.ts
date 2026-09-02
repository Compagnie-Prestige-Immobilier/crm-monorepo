import type { ApiClient } from '@crm/api-client';
import { describe, expect, it, vi } from 'vitest';

import { fetchBankCase } from '@/lib/data/bank-cases';
import { queryKeys } from '@/lib/query-keys';

function detailClient(): { GET: ReturnType<typeof vi.fn>; client: ApiClient } {
  const GET = vi.fn().mockResolvedValue({
    data: { bankCase: { id: 'bc-1' }, transitions: [] },
    response: new Response(null, { status: 200 }),
  });
  return { GET, client: { GET } as unknown as ApiClient };
}

describe('fetchBankCase', () => {
  it('borne la lecture au projet de la coque', async () => {
    const { GET, client } = detailClient();

    await fetchBankCase('bc-1', 'GRAND_PUBLIC', client);

    expect(GET).toHaveBeenCalledWith('/api/v1/bank-cases/{id}', {
      params: { path: { id: 'bc-1' }, query: { projet: 'GRAND_PUBLIC' } },
    });
  });

  it('sépare les deux coques dans le cache', () => {
    expect(queryKeys.bankCase('bc-1', 'CHUES')).not.toEqual(
      queryKeys.bankCase('bc-1', 'GRAND_PUBLIC'),
    );
  });
});
