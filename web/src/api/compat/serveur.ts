import createClient, { type Client } from 'openapi-fetch';

import type { paths } from '@/api/schema';

import { redirectToLogin } from '@/lib/api/session-expiry';

/**
 * Le contrat que le binaire Go engendre, à côté du contrat v1 figé. Les routes
 * d'exploitation n'existent pas en v1 : elles se typent ici plutôt que dans un
 * cast ou une interface recopiée.
 */
export type ServeurClient = Client<paths>;
export type { components } from '@/api/schema';

let client: ServeurClient | undefined;

export function getServeurClient(): ServeurClient {
  if (client === undefined) {
    client = createClient<paths>({ baseUrl: '', credentials: 'same-origin' });
    client.use({
      onResponse({ response }) {
        if (response.status === 401) redirectToLogin();
        return response;
      },
    });
  }
  return client;
}
