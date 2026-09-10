import { queryOptions } from '@tanstack/react-query';
import { createApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import type { SessionUser } from '@/lib/types';

/** Un client sans le renvoi vers la connexion : un visiteur anonyme n'a pas de session expirée. */
const clientSansRenvoi = createApiClient();

/** `null` veut dire anonyme, et rien d'autre : une panne doit se voir. */
async function fetchMe(): Promise<SessionUser | null> {
  const result = await clientSansRenvoi.GET('/api/v1/auth/me');
  if (result.response.status === 401) return null;
  return unwrap(result);
}

export const meQueryOptions = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: fetchMe,
});
