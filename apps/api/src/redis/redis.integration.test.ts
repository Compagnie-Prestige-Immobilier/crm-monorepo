process.env.NODE_ENV ??= 'test';
process.env.REDIS_URL ??= 'redis://localhost:6381';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fakeWorkspace } from '../workspaces/fake-workspace.js';
import { RedisService } from './redis.service.js';

const TAG = `it-redis-${process.pid}`;
const client = RedisService.open(process.env.REDIS_URL);
const live = new RedisService(fakeWorkspace(), client);
const dead = new RedisService(fakeWorkspace(), RedisService.open('redis://127.0.0.1:1'));

// Connexion paresseuse : avant `ready`, chaque commande est refusée et le
// cache se comporte comme absent. Le test attend le vrai état connecté.
beforeAll(
  () =>
    new Promise<void>((resolve) => {
      if (client?.status === 'ready') resolve();
      else client?.once('ready', () => resolve());
    }),
);

afterAll(async () => {
  await live.bust(TAG);
  await Promise.all([live.onModuleDestroy(), dead.onModuleDestroy()]);
});

describe('RedisService contre un vrai serveur', () => {
  it('met en cache puis relit sans rappeler le chargeur', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return { calls };
    };
    expect(await live.cached(TAG, 30, load)).toEqual({ calls: 1 });
    expect(await live.cached(TAG, 30, load)).toEqual({ calls: 1 });
    await live.bust(TAG);
    expect(await live.cached(TAG, 30, load)).toEqual({ calls: 2 });
  });

  it('sert le chargeur quand le serveur est injoignable', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return calls;
    };
    expect(await dead.cached(TAG, 30, load)).toBe(1);
    expect(await dead.cached(TAG, 30, load)).toBe(2);
  });
});
