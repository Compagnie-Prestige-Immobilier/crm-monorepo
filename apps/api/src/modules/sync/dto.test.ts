import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SyncPullQueryDto, SyncPushDto } from './dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const asBody = async <T>(metatype: new () => T, value: unknown): Promise<T> =>
  (await pipe.transform(value, { type: 'body', metatype })) as T;

const asQuery = async <T>(metatype: new () => T, value: Record<string, string>): Promise<T> =>
  (await pipe.transform(value, { type: 'query', metatype })) as T;

const OPERATION = {
  opId: '01931f3c-1a2b-7c4d-8e5f-000000000010',
  seq: 0,
  entity: 'prospect',
  op: 'create',
  entityId: '01931f3c-1a2b-7c4d-8e5f-000000000011',
  clientUpdatedAt: '2026-08-18T10:00:00.000Z',
};

const push = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  clientBatchId: '01931f3c-1a2b-7c4d-8e5f-000000000001',
  payloadVersion: 1,
  operations: [OPERATION],
  ...over,
});

/**
 * `forbidNonWhitelisted` rejette le LOT ENTIER sur un champ inconnu, et non
 * l'opération fautive : un téléphone qui déclarerait sa file d'attente sans que
 * le serveur connaisse le champ ne synchroniserait plus du tout.
 */
describe('ce que le lot de synchronisation accepte', () => {
  it('un lot qui ne déclare rien de lui-même passe', async () => {
    const parsed = await asBody(SyncPushDto, push());

    expect(parsed.pendingOps).toBeUndefined();
    expect(parsed.appVersion).toBeUndefined();
  });

  it('un lot qui déclare sa file d’attente et sa version passe', async () => {
    const parsed = await asBody(SyncPushDto, push({ pendingOps: 12, appVersion: '1.4.2' }));

    expect(parsed.pendingOps).toBe(12);
    expect(parsed.appVersion).toBe('1.4.2');
  });

  it('un champ inconnu reste refusé, lot compris', async () => {
    await expect(asBody(SyncPushDto, push({ batteryLevel: 42 }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('une file d’attente négative est refusée', async () => {
    await expect(asBody(SyncPushDto, push({ pendingOps: -1 }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ce que la requête de pull accepte', () => {
  it('une requête sans rien déclarer passe', async () => {
    const parsed = await asQuery(SyncPullQueryDto, {});

    expect(parsed.pendingOps).toBeUndefined();
  });

  it('convertit la file d’attente annoncée en nombre', async () => {
    const parsed = await asQuery(SyncPullQueryDto, { pendingOps: '12', appVersion: '1.4.2' });

    expect(parsed.pendingOps).toBe(12);
    expect(parsed.appVersion).toBe('1.4.2');
  });
});
