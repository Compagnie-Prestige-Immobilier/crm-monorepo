import { NotificationCategory } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationTemplatesService } from './templates.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  notificationTemplate: Record<'findMany' | 'findFirst' | 'create' | 'update', MockFn>;
}

const templateRow = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'tpl-1',
  name: 'Relance hebdomadaire',
  category: NotificationCategory.ANNONCE,
  titleTemplate: 'Bonjour {{nom}}',
  bodyTemplate: 'Il vous reste {{nombre}} fiche(s).',
  route: null,
  variables: ['nom', 'nombre'],
  isActive: true,
  updatedAt: new Date('2026-08-01T09:00:00.000Z'),
  ...overrides,
});

let db: MockDb;

beforeEach(() => {
  db = {
    notificationTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(templateRow()),
      update: vi.fn().mockResolvedValue(templateRow()),
    },
  };
});

const service = (): NotificationTemplatesService =>
  new NotificationTemplatesService(db as unknown as PrismaService);

const whereOf = (fn: MockFn): Record<string, unknown> =>
  (fn.mock.calls[0]?.[0] as { where?: Record<string, unknown> }).where ?? {};

describe('cloisonnement des lectures', () => {
  it('le filtre de visibilité s’AJOUTE au filtre d’activité, il ne le remplace pas', async () => {
    await service().list(false);

    const where = whereOf(db.notificationTemplate.findMany);
    expect(where.isActive).toBe(true);
  });

  it.each([
    ['get', (s: NotificationTemplatesService) => s.get('tpl-1')],
    ['update', (s: NotificationTemplatesService) => s.update('tpl-1', { name: 'Autre' })],
    ['render', (s: NotificationTemplatesService) => s.render('tpl-1', {})],
  ])('%s répond « introuvable » sur un gabarit masqué', async (_label, run) => {
    db.notificationTemplate.findFirst.mockResolvedValue(null);

    await expect(run(service())).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_TEMPLATE_NOT_FOUND' },
    });

    expect(whereOf(db.notificationTemplate.findFirst)).toMatchObject({
      id: 'tpl-1',
    });
  });

  it('mode ALLUMÉ, le même gabarit s’ouvre : il est masqué, pas supprimé', async () => {
    db.notificationTemplate.findFirst.mockResolvedValue(templateRow());

    await expect(service().get('tpl-1')).resolves.toMatchObject({ id: 'tpl-1' });
  });
});
