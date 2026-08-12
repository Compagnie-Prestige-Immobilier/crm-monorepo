import createClient, { type Client, type Middleware } from 'openapi-fetch';

import type { paths } from './generated/schema.js';

export type { paths } from './generated/schema.js';
export type { components, operations } from './generated/schema.js';

export type ApiClient = Client<paths>;

/** Awaitable because the token usually comes out of async storage on mobile-ish clients. */
export type TokenProvider = () => string | null | undefined | Promise<string | null | undefined>;

export interface ApiClientOptions {
  /**
   * Called before every request. Returning a falsy value sends the request
   * unauthenticated, which is what the login and refresh routes need.
   */
  getAccessToken?: TokenProvider;
  /**
   * Called on any 401. This is the single place the app learns its session
   * died — refresh the token, or clear it and bounce to /login. It runs before
   * the caller sees the response, so a refresh-and-retry strategy belongs here.
   */
  onUnauthorized?: (response: Response) => void | Promise<void>;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Injectable for tests. */
  fetch?: typeof globalThis.fetch;
}

/**
 * The auth middleware. Split out so tests can exercise it without a server and
 * so a second client (server-side route handlers, for instance) can reuse it.
 *
 * `onRequest` must return the Request for the mutation to take effect;
 * returning undefined means "leave it alone".
 */
export const createAuthMiddleware = (options: ApiClientOptions): Middleware => ({
  async onRequest({ request }) {
    const token = await options.getAccessToken?.();
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) await options.onUnauthorized?.(response);
    return response;
  },
});

/**
 * The only supported way to talk to @crm/api.
 *
 * Every path, query parameter, body and response is typed off
 * src/generated/schema.ts, which is generated from apps/api/openapi.json.
 * Nothing in this package is written against a hand-maintained model.
 */
export const createApiClient = (baseUrl: string, options: ApiClientOptions = {}): ApiClient => {
  const client = createClient<paths>({
    baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
  });

  client.use(createAuthMiddleware(options));

  return client;
};
