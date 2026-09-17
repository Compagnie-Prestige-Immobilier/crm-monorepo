import createClient, { type Client } from 'openapi-fetch';

import type { paths } from '@/api/schema';

export type { components, operations, paths } from '@/api/schema';
export type ApiClient = Client<paths>;

/** Une seule origine, un seul client : le cookie de session fait l'authentification. */
export function createApiClient(_origin?: string, _options?: unknown): ApiClient {
  return createClient<paths>({
    baseUrl: '',
    credentials: 'same-origin',
    // huma lit un tableau en query séparé par des virgules, pas en clé répétée.
    querySerializer: { array: { style: 'form', explode: false } },
  });
}
