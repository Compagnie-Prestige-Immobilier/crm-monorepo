import { UnprocessableEntityException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { SyncController } from './sync.controller.js';
import type { SyncService } from './sync.service.js';
import type { HeartbeatService } from '../heartbeat/heartbeat.service.js';
import type { SyncPullQueryDto, SyncPushDto } from './dto.js';

const user: AuthenticatedUser = {
  id: 'com-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Sow',
  role: Role.COMMERCIAL,
};

const BATCH = '01931f3c-1a2b-7c4d-8e5f-000000000001';

const body = (over: Partial<SyncPushDto> = {}): SyncPushDto =>
  ({ clientBatchId: BATCH, operations: [], ...over }) as SyncPushDto;

const replyStub = (): FastifyReply & { header: ReturnType<typeof vi.fn> } =>
  ({ header: vi.fn() }) as unknown as FastifyReply & { header: ReturnType<typeof vi.fn> };

const battements: { userId: string; kind: string; signal: unknown }[] = [];

const heartbeatStub = (): HeartbeatService =>
  ({
    record: (userId: string, kind: string, signal: unknown) => {
      battements.push({ userId, kind, signal });
      return Promise.resolve();
    },
  }) as unknown as HeartbeatService;

const controllerWith = (push: SyncService['push']): SyncController =>
  new SyncController({ push } as unknown as SyncService, heartbeatStub());

const controllerPulling = (pull: SyncService['pull']): SyncController =>
  new SyncController({ pull } as unknown as SyncService, heartbeatStub());

beforeEach(() => {
  battements.length = 0;
});

describe('clé d’idempotence du push', () => {
  it('refuse une clé absente en 422, jamais en 400', async () => {
    const controller = controllerWith(vi.fn());

    const error = await controller
      .push(user, body(), undefined, replyStub())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getStatus()).toBe(422);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  });

  it('refuse une clé qui diverge de clientBatchId en 422', async () => {
    const controller = controllerWith(vi.fn());

    const error = await controller
      .push(user, body(), 'une-autre-cle', replyStub())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect((error as UnprocessableEntityException).getStatus()).toBe(422);
    expect((error as UnprocessableEntityException).getResponse()).toMatchObject({
      code: 'IDEMPOTENCY_KEY_MISMATCH',
    });
  });

  it('annonce un rejeu par l’en-tête Idempotency-Replayed', async () => {
    const reply = replyStub();
    const controller = controllerWith(
      vi.fn().mockResolvedValue({ replayed: true, body: { results: [] } }),
    );

    await controller.push(user, body(), BATCH, reply);

    expect(reply.header).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
  });

  it('ne pose rien quand le lot est réellement traité', async () => {
    const reply = replyStub();
    const controller = controllerWith(
      vi.fn().mockResolvedValue({ replayed: false, body: { results: [] } }),
    );

    await controller.push(user, body(), BATCH, reply);

    expect(reply.header).not.toHaveBeenCalled();
  });
});

describe('battement de cœur du terrain', () => {
  it('marque un pull, qui ne laisse aucune autre trace en base', async () => {
    const controller = controllerPulling(vi.fn().mockResolvedValue({ changes: {} }));

    const query: SyncPullQueryDto = { pendingOps: 12, appVersion: '1.4.2' };
    await controller.pull(user, query);

    expect(battements).toEqual([
      { userId: 'com-1', kind: 'pull', signal: { pendingOps: 12, appVersion: '1.4.2' } },
    ]);
  });

  it('marque un push, et sur le lot réellement traité', async () => {
    const controller = controllerWith(
      vi.fn().mockResolvedValue({ replayed: false, body: { results: [] } }),
    );

    await controller.push(user, body({ pendingOps: 0 }), BATCH, replyStub());

    expect(battements).toHaveLength(1);
    expect(battements[0]?.kind).toBe('push');
  });

  it('ne marque rien quand le push échoue', async () => {
    const controller = controllerWith(vi.fn().mockRejectedValue(new Error('base injoignable')));

    await controller.push(user, body(), BATCH, replyStub()).catch(() => undefined);

    expect(battements).toEqual([]);
  });
});
