import { UnprocessableEntityException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Role } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { SyncController } from './sync.controller.js';
import type { SyncService } from './sync.service.js';
import type { SyncPushDto } from './dto.js';

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

const controllerWith = (push: SyncService['push']): SyncController =>
  new SyncController({ push } as unknown as SyncService);

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
