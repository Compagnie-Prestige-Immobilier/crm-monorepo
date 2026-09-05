import { describe, expect, it, vi } from 'vitest';

import { fakeWorkspace } from '../workspaces/fake-workspace.js';
import { FakeRedis } from './fake-redis.js';
import { RedisService } from './redis.service.js';

const loaderOf = (value: unknown) => vi.fn(async () => value);

describe('RedisService.cached', () => {
  it('sert la valeur en cache au second appel sans rappeler le chargeur', async () => {
    const redis = new RedisService(fakeWorkspace(), new FakeRedis());
    const load = loaderOf({ total: 3 });

    expect(await redis.cached('sup', 30, load)).toEqual({ total: 3 });
    expect(await redis.cached('sup', 30, load)).toEqual({ total: 3 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('recharge une fois la durée de vie écoulée', async () => {
    const client = new FakeRedis();
    const redis = new RedisService(fakeWorkspace(), client);
    const load = loaderOf(1);

    await redis.cached('sup', 30, load);
    client.now += 30_001;
    await redis.cached('sup', 30, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('isole les espaces public et demo', async () => {
    const client = new FakeRedis();
    const publicRedis = new RedisService(fakeWorkspace(), client);
    const demoRedis = new RedisService(fakeWorkspace(true), client);

    await publicRedis.cached('sup', 30, loaderOf('prod'));
    expect(await demoRedis.cached('sup', 30, loaderOf('demo'))).toBe('demo');
    expect([...client.store.keys()]).toEqual(['cpi:public:sup', 'cpi:demo:sup']);
  });

  it('passe au chargeur sans client', async () => {
    const redis = new RedisService(fakeWorkspace(), null);
    const load = loaderOf('direct');

    expect(await redis.cached('sup', 30, load)).toBe('direct');
    expect(await redis.cached('sup', 30, load)).toBe('direct');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('passe au chargeur quand Redis échoue, sans propager', async () => {
    const client = new FakeRedis();
    client.failing = true;
    const redis = new RedisService(fakeWorkspace(), client);

    expect(await redis.cached('sup', 30, loaderOf('direct'))).toBe('direct');
    await expect(redis.bust('sup')).resolves.toBeUndefined();
  });

  it('bump invalide tout un groupe sans toucher aux autres clés', async () => {
    const redis = new RedisService(fakeWorkspace(), new FakeRedis());
    const ref = loaderOf('ref');
    const sup = loaderOf('sup');

    await redis.cached('banques', 60, ref, 'ref');
    await redis.cached('activite', 30, sup);
    await redis.bump('ref');
    await redis.cached('banques', 60, ref, 'ref');
    await redis.cached('activite', 30, sup);
    expect(ref).toHaveBeenCalledTimes(2);
    expect(sup).toHaveBeenCalledTimes(1);
  });

  it('ne met pas en cache une réponse absente (handler qui écrit lui-même la réponse)', async () => {
    const client = new FakeRedis();
    const redis = new RedisService(fakeWorkspace(), client);

    await redis.cached('download', 30, async () => undefined);
    expect(client.store.size).toBe(0);
  });

  it('bust retire la clé et force un rechargement', async () => {
    const redis = new RedisService(fakeWorkspace(), new FakeRedis());
    const load = loaderOf('v1');

    await redis.cached('user:1', 30, load);
    await redis.bust('user:1');
    await redis.cached('user:1', 30, load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
