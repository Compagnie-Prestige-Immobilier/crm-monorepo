import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import {
  DEMO_MODE_READ_ONLY,
  DEMO_MODE_READ_ONLY_MESSAGE,
  DemoReadOnlyGuard,
} from './demo-read-only.guard.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { DEMO_MODE_STATE_UNKNOWN } from '../../prisma/demo-visibility.service.js';

import { AuthController } from '../../modules/auth/auth.controller.js';
import { DemoController } from '../../modules/demo/demo.controller.js';
import { NotificationsController } from '../../modules/notifications/notifications.controller.js';
import { NotificationTemplatesController } from '../../modules/notifications/templates.controller.js';
import { ProspectsController } from '../../modules/prospects/prospects.controller.js';
import { SyncController } from '../../modules/sync/sync.controller.js';

const contextFor = (
  method: string,
  target: { prototype: object },
  handlerName: string,
): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
    getClass: () => target,
    getHandler: () => (target.prototype as Record<string, unknown>)[handlerName],
  }) as unknown as ExecutionContext;

const guardWithDemo = (enabled: boolean | 'unknown'): DemoReadOnlyGuard =>
  new DemoReadOnlyGuard(new Reflector(), fakeDemoVisibility(enabled));

const refusalOf = async (
  guard: DemoReadOnlyGuard,
  context: ExecutionContext,
): Promise<{ status: number; body: unknown }> => {
  try {
    await guard.canActivate(context);
  } catch (error) {
    const exception = error as { getStatus: () => number; getResponse: () => unknown };
    return { status: exception.getStatus(), body: exception.getResponse() };
  }
  throw new Error('La garde a laissé passer une écriture alors qu’elle devait refuser.');
};

describe('lecture seule pendant une démonstration', () => {
  it('refuse une écriture interactive quand le mode est ALLUMÉ', async () => {
    const refusal = await refusalOf(
      guardWithDemo(true),
      contextFor('POST', ProspectsController, 'create'),
    );

    expect(refusal.status).toBe(409);
    expect(refusal.body).toEqual({
      code: DEMO_MODE_READ_ONLY,
      message: DEMO_MODE_READ_ONLY_MESSAGE,
    });
  });

  it('laisse passer la MÊME écriture quand le mode est éteint', async () => {
    await expect(
      guardWithDemo(false).canActivate(contextFor('POST', ProspectsController, 'create')),
    ).resolves.toBe(true);
  });

  it('couvre les quatre méthodes mutantes, et elles seules', async () => {
    const guard = guardWithDemo(true);

    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      await expect(
        guard.canActivate(contextFor(method, ProspectsController, 'create')),
      ).rejects.toThrow();
    }

    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      await expect(
        guard.canActivate(contextFor(method, ProspectsController, 'create')),
      ).resolves.toBe(true);
    }
  });

  it('reconnaît la méthode quelle que soit sa casse', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('post', ProspectsController, 'create')),
    ).rejects.toThrow();
  });

  it('REFUSE l’écriture quand l’état du mode est indéterminé', async () => {
    await expect(
      guardWithDemo('unknown').canActivate(contextFor('POST', ProspectsController, 'create')),
    ).rejects.toThrow();
  });

  it('et il NOMME LA VRAIE CAUSE au lieu d’annoncer une démonstration', async () => {
    const refusal = await refusalOf(
      guardWithDemo('unknown'),
      contextFor('POST', ProspectsController, 'create'),
    );

    expect(refusal.status).toBe(409);
    expect((refusal.body as { code: string }).code).toBe(DEMO_MODE_STATE_UNKNOWN);
    expect((refusal.body as { message: string }).message).not.toContain('administrateur');
  });

  it('laisse néanmoins passer une route dispensée, même dans le doute', async () => {
    await expect(
      guardWithDemo('unknown').canActivate(contextFor('POST', SyncController, 'push')),
    ).resolves.toBe(true);
  });

  it('ne lit pas le réglage sur une requête non mutante', async () => {
    let reads = 0;
    const counting = {
      enabled: () => {
        reads += 1;
        return Promise.resolve(true);
      },
      state: () => {
        reads += 1;
        return Promise.resolve('on' as const);
      },
      invalidate: () => undefined,
    };

    const guard = new DemoReadOnlyGuard(
      new Reflector(),
      counting as unknown as ReturnType<typeof fakeDemoVisibility>,
    );

    await guard.canActivate(contextFor('GET', ProspectsController, 'list'));
    expect(reads).toBe(0);

    await expect(
      guard.canActivate(contextFor('POST', ProspectsController, 'create')),
    ).rejects.toThrow();
    expect(reads).toBe(1);
  });
});

describe('les dispenses, une par une', () => {
  it('le mode démonstration peut encore être ÉTEINT alors qu’il est allumé', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('POST', DemoController, 'disable')),
    ).resolves.toBe(true);
  });

  it('et il peut aussi être PURGÉ et RÉ-ACTIVÉ pendant qu’il est allumé', async () => {
    const guard = guardWithDemo(true);
    await expect(guard.canActivate(contextFor('POST', DemoController, 'purge'))).resolves.toBe(
      true,
    );
    await expect(guard.canActivate(contextFor('POST', DemoController, 'enable'))).resolves.toBe(
      true,
    );
  });

  it('la remontée hors ligne du mobile passe', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('POST', SyncController, 'push')),
    ).resolves.toBe(true);
  });

  it('les trois routes d’authentification passent', async () => {
    const guard = guardWithDemo(true);
    for (const route of ['login', 'refresh', 'logout']) {
      await expect(guard.canActivate(contextFor('POST', AuthController, route))).resolves.toBe(
        true,
      );
    }
  });

  it('marquer lue sa propre notification passe', async () => {
    await expect(
      guardWithDemo(true).canActivate(contextFor('POST', NotificationsController, 'markRead')),
    ).resolves.toBe(true);
  });

  it('l’aperçu d’un gabarit passe, il n’écrit rien malgré sa méthode POST', async () => {
    await expect(
      guardWithDemo(true).canActivate(
        contextFor('POST', NotificationTemplatesController, 'render'),
      ),
    ).resolves.toBe(true);
  });

  it('les autres routes du MÊME contrôleur restent bloquées', async () => {
    const guard = guardWithDemo(true);
    for (const route of ['create', 'cancel']) {
      await expect(
        guard.canActivate(contextFor('POST', NotificationsController, route)),
      ).rejects.toThrow();
    }
  });
});
