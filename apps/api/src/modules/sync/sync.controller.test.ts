import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { MIN_PULL_PAYLOAD_VERSION, SyncController } from './sync.controller.js';
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
    await controller.pull(user, query, String(MIN_PULL_PAYLOAD_VERSION));

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

describe('format de charge utile annoncé au tirage', () => {
  const refus = async (annonce: string | undefined) => {
    const pull = vi.fn().mockResolvedValue({ changes: {} });
    const error = await controllerPulling(pull)
      .pull(user, {}, annonce)
      .catch((e: unknown) => e);
    return { error, pull };
  };

  it('refuse un client qui n’annonce aucun format, sans lui servir la page', async () => {
    const { error, pull } = await refus(undefined);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(426);
    expect((error as HttpException).getResponse()).toMatchObject({ code: 'APP_UPDATE_REQUIRED' });
    expect(pull).not.toHaveBeenCalled();
  });

  it('dit au téléconseiller quoi faire, et que ses saisies partent quand même', async () => {
    const { error } = await refus(undefined);
    const { message } = (error as HttpException).getResponse() as { message: string };

    expect(message).toContain('mise à jour');
    expect(message).toContain('Vos saisies continuent de partir');
  });

  it('refuse un format antérieur au palier', async () => {
    const { error, pull } = await refus(String(MIN_PULL_PAYLOAD_VERSION - 1));

    expect((error as HttpException).getStatus()).toBe(426);
    expect(pull).not.toHaveBeenCalled();
  });

  it('refuse une annonce qui n’est pas un entier plutôt que de l’arrondir', async () => {
    for (const annonce of ['', 'quatre', String(MIN_PULL_PAYLOAD_VERSION) + '.5']) {
      const { error, pull } = await refus(annonce);
      expect((error as HttpException).getStatus(), annonce).toBe(426);
      expect(pull, annonce).not.toHaveBeenCalled();
    }
  });

  it('n’enregistre aucun battement de cœur sur un refus', async () => {
    await refus(undefined);

    expect(battements).toEqual([]);
  });

  it('sert le tirage au palier et au-dessus', async () => {
    for (const annonce of [MIN_PULL_PAYLOAD_VERSION, MIN_PULL_PAYLOAD_VERSION + 1]) {
      const pull = vi.fn().mockResolvedValue({ changes: {} });
      await controllerPulling(pull).pull(user, {}, String(annonce));
      expect(pull, String(annonce)).toHaveBeenCalledOnce();
    }
  });

  it('laisse la remontée hors ligne passer, elle, sans annonce de format', async () => {
    const controller = controllerWith(
      vi.fn().mockResolvedValue({ replayed: false, body: { results: [] } }),
    );

    await expect(controller.push(user, body(), BATCH, replyStub())).resolves.toEqual({
      results: [],
    });
  });
});
