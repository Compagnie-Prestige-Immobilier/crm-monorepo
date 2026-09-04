import { describe, expect, it } from 'vitest';

import { createChuesClient } from './index.js';

describe('createChuesClient', () => {
  it('pose le jeton Bearer sur chaque requête', async () => {
    let authorization: string | null = null;
    const fetch: typeof globalThis.fetch = async (input) => {
      authorization = new Request(input).headers.get('Authorization');
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const client = createChuesClient('https://chues.test/api', { fetch, getAccessToken: () => 'jeton' });

    await client.GET('/accounts');

    expect(authorization).toBe('Bearer jeton');
  });
});
