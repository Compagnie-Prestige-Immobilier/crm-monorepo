import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { HeartbeatService } from './heartbeat.service.js';

interface UpsertArgs {
  where: { userId: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}

const serviceWith = (
  upsert: ReturnType<typeof vi.fn>,
): { service: HeartbeatService; upsert: typeof upsert } => {
  const prisma = { agentHeartbeat: { upsert }, $executeRaw: vi.fn().mockResolvedValue(1) };
  return { service: new HeartbeatService(prisma as unknown as PrismaService), upsert };
};

const argsOf = (upsert: ReturnType<typeof vi.fn>): UpsertArgs =>
  upsert.mock.calls[0]?.[0] as UpsertArgs;

const AT = new Date('2026-08-18T14:30:00.000Z');

describe('ce que le battement de cœur écrit', () => {
  it('un pull ne touche qu’à la date de pull', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const { service } = serviceWith(upsert);

    await service.record('usr-1', 'pull', {}, AT);

    expect(argsOf(upsert).where).toEqual({ userId: 'usr-1' });
    expect(argsOf(upsert).update).toEqual({ lastPullAt: AT });
  });

  it('un push ne touche qu’à la date de push', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const { service } = serviceWith(upsert);

    await service.record('usr-1', 'push', {}, AT);

    expect(argsOf(upsert).update).toEqual({ lastPushAt: AT });
  });

  it('reporte ce que l’appareil déclare', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const { service } = serviceWith(upsert);

    await service.record('usr-1', 'pull', { pendingOps: 12, appVersion: '1.4.2' }, AT);

    expect(argsOf(upsert).update).toEqual({
      lastPullAt: AT,
      pendingOps: 12,
      appVersion: '1.4.2',
    });
  });

  /**
   * Un téléphone déjà déployé n'annoncera JAMAIS ces champs. Les écrire à
   * `null` par défaut effacerait ce qu'une autre version, plus récente, vient
   * de déclarer sur le même compte.
   */
  it('n’écrase pas ce qui est connu quand l’appareil ne déclare rien', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const { service } = serviceWith(upsert);

    await service.record('usr-1', 'pull', {}, AT);

    expect(Object.keys(argsOf(upsert).update)).toEqual(['lastPullAt']);
    expect(Object.keys(argsOf(upsert).create)).toEqual(['userId', 'lastPullAt']);
  });

  it('une panne d’écriture ne fait pas échouer la synchronisation', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('base injoignable'));
    const { service } = serviceWith(upsert);

    await expect(service.record('usr-1', 'pull', {}, AT)).resolves.toBeUndefined();
  });
});
