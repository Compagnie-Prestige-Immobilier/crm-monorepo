import createClient, { type Client } from 'openapi-fetch';

import type { paths } from '@/api/schema-v1';

/**
 * Le panneau v1 est repris tel quel, avec le contrat qu'il connaît
 * (`contrat-v1.openapi.json`, figé au commit 68217387). Le binaire Go le sert ;
 * l'écart entre les deux contrats se mesure, il ne se cache pas dans des casts.
 */
export type { components, operations, paths } from '@/api/schema-v1';
export type ApiClient = Client<paths>;

/** Une seule origine, un seul client : le cookie de session fait l'authentification. */
export function createApiClient(_origin?: string, _options?: unknown): ApiClient {
  return createClient<paths>({ baseUrl: '', credentials: 'same-origin' });
}
