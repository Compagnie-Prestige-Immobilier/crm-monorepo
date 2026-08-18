process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';

import { PrismaClient, PrismaPg, Role } from '@crm/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { HeartbeatService } from './heartbeat.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const heartbeat = new HeartbeatService(prisma as unknown as PrismaService);

const TAG = 'it-heartbeat';
let userId: string;

beforeAll(async () => {
  const row = await prisma.user.upsert({
    where: { email: `awa.${TAG}@cpi.test` },
    create: {
      email: `awa.${TAG}@cpi.test`,
      username: `awa.${TAG}`,
      fullName: 'Awa Diop',
      passwordHash: 'x',
      role: Role.COMMERCIAL,
    },
    update: {},
  });
  userId = row.id;
});

beforeEach(async () => {
  await prisma.agentHeartbeat.deleteMany({ where: { userId } });
});

afterAll(async () => {
  await prisma.agentHeartbeat.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('battement de cœur, en base', () => {
  it('n’écrit qu’UNE ligne par agent, et c’est le dernier passage qu’elle porte', async () => {
    const passages = 20;
    for (let index = 0; index < passages; index += 1) {
      await heartbeat.record(userId, 'pull', {}, new Date(Date.UTC(2026, 7, 18, 9, index)));
    }

    expect(await prisma.agentHeartbeat.count({ where: { userId } })).toBe(1);
    const row = await prisma.agentHeartbeat.findUniqueOrThrow({ where: { userId } });
    expect(row.lastPullAt?.toISOString()).toBe(
      new Date(Date.UTC(2026, 7, 18, 9, passages - 1)).toISOString(),
    );
  });

  it('garde la déclaration précédente quand un appareil plus ancien ne dit rien', async () => {
    await heartbeat.record(userId, 'pull', { pendingOps: 12, appVersion: '1.4.2' });
    await heartbeat.record(userId, 'pull', {});

    const row = await prisma.agentHeartbeat.findUniqueOrThrow({ where: { userId } });
    expect(row.pendingOps).toBe(12);
    expect(row.appVersion).toBe('1.4.2');
  });

  it('sépare la dernière descente de la dernière remontée', async () => {
    await heartbeat.record(userId, 'pull', {}, new Date('2026-08-18T09:00:00.000Z'));
    await heartbeat.record(userId, 'push', {}, new Date('2026-08-18T10:00:00.000Z'));

    const row = await prisma.agentHeartbeat.findUniqueOrThrow({ where: { userId } });
    expect(row.lastPullAt?.toISOString()).toBe('2026-08-18T09:00:00.000Z');
    expect(row.lastPushAt?.toISOString()).toBe('2026-08-18T10:00:00.000Z');
  });

  it('part avec le compte, sans bloquer sa suppression', async () => {
    const jetable = await prisma.user.create({
      data: {
        email: `jetable.${TAG}@cpi.test`,
        username: `jetable.${TAG}`,
        fullName: 'Compte jetable',
        passwordHash: 'x',
        role: Role.COMMERCIAL,
      },
    });
    await heartbeat.record(jetable.id, 'pull', {});

    await prisma.user.delete({ where: { id: jetable.id } });

    expect(await prisma.agentHeartbeat.count({ where: { userId: jetable.id } })).toBe(0);
  });
});
