import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@crm/database';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { LiveService } from '../modules/live/live.service.js';
import { fakeWorkspace } from '../workspaces/fake-workspace.js';
import { CacheInterceptor, Cached } from './cache.interceptor.js';
import { FakeRedis } from './fake-redis.js';
import { RedisService } from './redis.service.js';

@Cached(60, 'referentiels')
class ReferentielsEssai {
  liste(): string {
    return 'liste';
  }
  cree(): string {
    return 'cree';
  }
}

class SupervisionEssai {
  @Cached(30)
  activite(): string {
    return 'activite';
  }
  brut(): string {
    return 'brut';
  }
}

const userOf = (role: Role, id = 'u1'): AuthenticatedUser => ({
  id,
  email: `${id}@cpi.sn`,
  username: id,
  fullName: id,
  role,
});

const contextOf = (
  target: object,
  method: string,
  request: { method: string; url: string; user?: AuthenticatedUser },
): ExecutionContext =>
  ({
    getType: () => 'http',
    getHandler: () => (target as Record<string, () => string>)[method],
    getClass: () => target.constructor,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const handlerOf = (value: unknown): CallHandler & { calls: number } => {
  const handler = {
    calls: 0,
    handle: () => {
      handler.calls += 1;
      return of(value);
    },
  };
  return handler;
};

const setup = () => {
  const client = new FakeRedis();
  const live = new LiveService(fakeWorkspace());
  const interceptor = new CacheInterceptor(
    new Reflector(),
    new RedisService(fakeWorkspace(), client),
    live,
  );
  return { client, interceptor, live };
};

describe('CacheInterceptor', () => {
  it('sert le second GET depuis le cache', async () => {
    const { interceptor } = setup();
    const context = contextOf(new SupervisionEssai(), 'activite', {
      method: 'GET',
      url: '/api/v1/supervision/activite',
      user: userOf(Role.ADMIN),
    });
    const handler = handlerOf({ total: 1 });

    expect(await lastValueFrom(interceptor.intercept(context, handler))).toEqual({ total: 1 });
    expect(await lastValueFrom(interceptor.intercept(context, handler))).toEqual({ total: 1 });
    expect(handler.calls).toBe(1);
  });

  it('ignore un handler sans @Cached', async () => {
    const { interceptor, client } = setup();
    const context = contextOf(new SupervisionEssai(), 'brut', { method: 'GET', url: '/x' });
    const handler = handlerOf('brut');

    await lastValueFrom(interceptor.intercept(context, handler));
    await lastValueFrom(interceptor.intercept(context, handler));
    expect(handler.calls).toBe(2);
    expect(client.store.size).toBe(0);
  });

  it('sépare un téléconseiller des lecteurs globaux, et les lecteurs globaux entre rôles', async () => {
    const { interceptor, client } = setup();
    const target = new SupervisionEssai();
    const url = '/api/v1/analytics/funnel?projet=CHUES';
    for (const user of [
      userOf(Role.COMMERCIAL, 'c1'),
      userOf(Role.ADMIN, 'a1'),
      userOf(Role.SUPERVISEUR, 's1'),
    ]) {
      await lastValueFrom(
        interceptor.intercept(
          contextOf(target, 'activite', { method: 'GET', url, user }),
          handlerOf(1),
        ),
      );
    }
    expect([...client.store.keys()].sort()).toEqual([
      `cpi:public:http:ADMIN:${url}`,
      `cpi:public:http:SUPERVISEUR:${url}`,
      `cpi:public:http:c1:${url}`,
    ]);
  });

  it('une mutation sur une classe groupée invalide ses GET et prévient le flux', async () => {
    const { interceptor, live } = setup();
    const target = new ReferentielsEssai();
    const liste = handlerOf(['a']);
    const get = contextOf(target, 'liste', { method: 'GET', url: '/api/v1/referentiels/banques' });
    const post = contextOf(target, 'cree', { method: 'POST', url: '/api/v1/referentiels/banques' });
    const emitted = vi.fn();
    live.subscribe('public', emitted);

    await lastValueFrom(interceptor.intercept(get, liste));
    await lastValueFrom(interceptor.intercept(post, handlerOf({ id: 'b' })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await lastValueFrom(interceptor.intercept(get, liste));
    expect(liste.calls).toBe(2);
    expect(emitted).toHaveBeenCalledWith('referentiels');
  });

  it('ne cache pas une mutation même sur une classe groupée', async () => {
    const { interceptor, client } = setup();
    const post = contextOf(new ReferentielsEssai(), 'cree', { method: 'POST', url: '/x' });
    const handler = handlerOf('ok');

    await lastValueFrom(interceptor.intercept(post, handler));
    await lastValueFrom(interceptor.intercept(post, handler));
    expect(handler.calls).toBe(2);
    expect([...client.store.keys()]).toEqual(['cpi:public:v:referentiels']);
  });

  it('laisse passer hors HTTP', () => {
    const { interceptor } = setup();
    const context = { getType: () => 'ws' } as unknown as ExecutionContext;
    const handler = handlerOf('ws');
    const spy = vi.spyOn(handler, 'handle');

    interceptor.intercept(context, handler);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
