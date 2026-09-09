import { queryOptions } from '@tanstack/react-query';

import { ApiError, apiClient } from '@/api/client';
import type { SessionUser } from '@/lib/types';

/** `null` veut dire anonyme, et rien d'autre : une panne doit se voir. */
async function fetchMe(): Promise<SessionUser | null> {
  const { data, error, response } = await apiClient.GET('/api/v1/auth/me');
  if (error) {
    if (response.status === 401) return null;
    throw new ApiError(response.status, error, 'Session non vérifiée.');
  }
  return data.user;
}

export const meQueryOptions = queryOptions({
  queryKey: ['auth', 'me'],
  queryFn: fetchMe,
});
