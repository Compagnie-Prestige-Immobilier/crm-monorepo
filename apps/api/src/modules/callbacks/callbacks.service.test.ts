import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, ScheduledCallbackStatus } from '@crm/database';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { CallbacksService, dakarDayEnd } from './callbacks.service.js';
import { CallbackScope } from './dto.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  scheduledCallback: Record<'findMany' | 'findFirst' | 'updateMany', MockFn>;
}

const NOW = new Date('2026-08-18T10:00:00.000Z');

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

const AWA: AuthenticatedUser = {
  id: 'com-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Ndiaye',
  role: Role.COMMERCIAL,
};

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'cb-1',
  prospectId: 'p-1',
  scheduledAt: new Date('2026-08-18T15:00:00.000Z'),
  comment: 'rappeler après la prière',
  assignedToId: AWA.id,
  campaignId: 'camp-1',
  taskId: 'task-1',
  prospect: { phoneE164: '+221771234567' },
  assignedTo: { fullName: 'Awa Ndiaye' },
  ...over,
});

let db: MockDb;

const service = (demoEnabled = false): CallbacksService =>
  new CallbacksService(db as unknown as PrismaService, fakeDemoVisibility(demoEnabled));

const whereOf = (call: MockFn): Record<string, unknown> =>
  (call.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  db = {
    scheduledCallback: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('bornes de journée', () => {
  it('ferme la journée à Dakar, pas à l’instant de la lecture', () => {
    expect(dakarDayEnd(NOW, 0).toISOString()).toBe('2026-08-18T23:59:59.999Z');
  });

  it('la semaine couvre sept journées, celle du jour comprise', () => {
    expect(dakarDayEnd(NOW, 6).toISOString()).toBe('2026-08-24T23:59:59.999Z');
  });

  it('franchit le mois sans se tromper de borne', () => {
    expect(dakarDayEnd(new Date('2026-08-31T22:00:00.000Z'), 1).toISOString()).toBe(
      '2026-09-01T23:59:59.999Z',
    );
  });
});

describe('file des rappels', () => {
  it('la journée court jusqu’à son terme, et ramasse donc les retards', async () => {
    await service().list(AWA, { scope: CallbackScope.TODAY });

    expect(whereOf(db.scheduledCallback.findMany)).toEqual({
      isDemo: false,
      status: ScheduledCallbackStatus.PENDING,
      assignedToId: AWA.id,
      scheduledAt: { lte: new Date('2026-08-18T23:59:59.999Z') },
    });
  });

  it('un rappel de la veille remonte dans la file du jour, marqué en retard', async () => {
    db.scheduledCallback.findMany.mockResolvedValue([
      row({ id: 'cb-hier', scheduledAt: new Date('2026-08-17T15:00:00.000Z') }),
      row({ id: 'cb-ce-soir', scheduledAt: new Date('2026-08-18T18:00:00.000Z') }),
    ]);

    const result = await service().list(AWA, {});

    expect(result.items.map((item) => item.id)).toEqual(['cb-hier', 'cb-ce-soir']);
    expect(result.items.map((item) => item.overdue)).toEqual([true, false]);
  });

  it('le retard se lit sur la date, il n’est jamais demandé à la base', async () => {
    await service().list(AWA, {});

    expect(JSON.stringify(whereOf(db.scheduledCallback.findMany))).not.toContain('missed');
    expect(JSON.stringify(db.scheduledCallback.findMany.mock.calls[0]?.[0])).not.toContain(
      'overdue',
    );
  });

  it('le périmètre « en retard » s’arrête à l’instant présent', async () => {
    await service().list(AWA, { scope: CallbackScope.OVERDUE });

    expect(whereOf(db.scheduledCallback.findMany).scheduledAt).toEqual({ lt: NOW });
  });

  it('le périmètre « semaine » va jusqu’au sixième jour suivant', async () => {
    await service().list(AWA, { scope: CallbackScope.WEEK });

    expect(whereOf(db.scheduledCallback.findMany).scheduledAt).toEqual({
      lte: new Date('2026-08-24T23:59:59.999Z'),
    });
  });

  it('un téléconseiller ne lit que SA file, même en réclamant celle d’un autre', async () => {
    await service().list(AWA, { assignedToId: 'com-2' });

    expect(whereOf(db.scheduledCallback.findMany).assignedToId).toBe(AWA.id);
  });

  it('un administrateur voit tout, et peut se restreindre à un téléconseiller', async () => {
    await service().list(ADMIN, {});
    expect(whereOf(db.scheduledCallback.findMany)).not.toHaveProperty('assignedToId');

    db.scheduledCallback.findMany.mockClear();
    await service().list(ADMIN, { assignedToId: 'com-2' });
    expect(whereOf(db.scheduledCallback.findMany).assignedToId).toBe('com-2');
  });

  it('CLOISONNE la file quand le mode démonstration est éteint', async () => {
    await service(false).list(AWA, {});
    expect(whereOf(db.scheduledCallback.findMany).isDemo).toBe(false);

    db.scheduledCallback.findMany.mockClear();
    await service(true).list(AWA, {});
    expect(whereOf(db.scheduledCallback.findMany)).not.toHaveProperty('isDemo');
  });

  it('rend le numéro à composer et le code court, jamais le nom du prospect', async () => {
    db.scheduledCallback.findMany.mockResolvedValue([row()]);

    const result = await service().list(AWA, {});

    expect(result.items[0]?.phoneE164).toBe('+221771234567');
    expect(result.items[0]?.shortCode).toHaveLength(6);
    expect(Object.keys(result.items[0] ?? {})).not.toContain('nom');
    expect(result.serverTime).toBe(NOW.toISOString());
  });
});

describe('annulation d’un rappel', () => {
  it('annule celui qu’on a promis', async () => {
    db.scheduledCallback.findFirst.mockResolvedValue({
      ...row(),
      status: ScheduledCallbackStatus.PENDING,
    });

    await service().cancel(AWA, 'cb-1');

    expect(db.scheduledCallback.updateMany).toHaveBeenCalledWith({
      where: { id: 'cb-1', status: ScheduledCallbackStatus.PENDING },
      data: { status: ScheduledCallbackStatus.CANCELLED },
    });
  });

  it('refuse d’annuler le rappel d’un autre téléconseiller', async () => {
    db.scheduledCallback.findFirst.mockResolvedValue({
      ...row({ assignedToId: 'com-2' }),
      status: ScheduledCallbackStatus.PENDING,
    });

    await expect(service().cancel(AWA, 'cb-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('un administrateur peut annuler le rappel d’un téléconseiller', async () => {
    db.scheduledCallback.findFirst.mockResolvedValue({
      ...row({ assignedToId: 'com-2' }),
      status: ScheduledCallbackStatus.PENDING,
    });

    await service().cancel(ADMIN, 'cb-1');

    expect(db.scheduledCallback.updateMany).toHaveBeenCalled();
  });

  it('un rappel déjà clos n’est pas réécrit', async () => {
    db.scheduledCallback.findFirst.mockResolvedValue({
      ...row(),
      status: ScheduledCallbackStatus.DONE,
    });

    await service().cancel(AWA, 'cb-1');

    expect(db.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('un rappel introuvable est un 404, pas un 403', async () => {
    await expect(service().cancel(AWA, 'cb-inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('file de rappels vue par un SUPERVISEUR', () => {
  const SUP: AuthenticatedUser = {
    id: 'sup-1',
    email: 'sup@cpi.sn',
    username: 'sup',
    fullName: 'Awa Sy',
    role: Role.SUPERVISEUR,
  };

  it('sans filtre, il voit la file de tout le monde', async () => {
    await service().list(SUP, {});

    expect(whereOf(db.scheduledCallback.findMany).assignedToId).toBeUndefined();
  });

  it('son filtre par téléconseiller RÉPOND, au lieu de rendre sa propre file vide', async () => {
    await service().list(SUP, { assignedToId: AWA.id });

    expect(whereOf(db.scheduledCallback.findMany).assignedToId).toBe(AWA.id);
  });

  it('n’annule aucun rappel : il ne tient pas le téléphone', async () => {
    db.scheduledCallback.findFirst.mockResolvedValue({
      ...row(),
      status: ScheduledCallbackStatus.PENDING,
    });

    await expect(service().cancel(SUP, 'cb-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });
});
