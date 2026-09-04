import { type ApiClientOptions, createAuthMiddleware } from '@crm/api-client';
import createClient, { type Client } from 'openapi-fetch';

import type { paths } from './generated/schema.js';

export type { components, operations, paths } from './generated/schema.js';

export type GrandPublicClient = Client<paths>;

/**
 * Client typé de la plateforme d'enrôlement Grand Public (Laravel, spec Scramble).
 * Tout vient de src/generated/schema.ts, généré depuis openapi.json.
 */
export const createGrandPublicClient = (baseUrl: string, options: ApiClientOptions = {}): GrandPublicClient => {
  const client = createClient<paths>({
    baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
  });
  client.use(createAuthMiddleware(options));
  return client;
};
