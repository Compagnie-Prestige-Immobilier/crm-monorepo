import { describe, expect, it } from 'vitest';

import { createGrandPublicClient } from './index.js';

describe('createGrandPublicClient', () => {
  it('pose le jeton Bearer sur chaque requête', async () => {
    let authorization: string | null = null;
    const fetch: typeof globalThis.fetch = async (input) => {
      authorization = new Request(input).headers.get('Authorization');
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const client = createGrandPublicClient('https://gp.test/api', { fetch, getAccessToken: () => 'jeton' });

    await client.GET('/auth/me');

    expect(authorization).toBe('Bearer jeton');
  });
});
