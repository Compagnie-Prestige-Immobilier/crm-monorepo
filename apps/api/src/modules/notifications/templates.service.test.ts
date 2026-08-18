import { NotificationCategory, Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { NotificationTemplatesService } from './templates.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  notificationTemplate: Record<'findMany' | 'findFirst' | 'create' | 'update', MockFn>;
}

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

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

const service = (demoEnabled: boolean): NotificationTemplatesService =>
  new NotificationTemplatesService(db as unknown as PrismaService, fakeDemoVisibility(demoEnabled));

const whereOf = (fn: MockFn): Record<string, unknown> =>
  (fn.mock.calls[0]?.[0] as { where?: Record<string, unknown> }).where ?? {};

const saisie = {
  name: 'Relance hebdomadaire',
  titleTemplate: 'Bonjour {{nom}}',
  bodyTemplate: 'Il vous reste {{nombre}} fiche(s).',
};

describe('nature du gabarit créé', () => {
  it('mode ÉTEINT : le gabarit est réel', async () => {
    await service(false).create(admin, saisie);

    const data = (
      db.notificationTemplate.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    ).data;
    expect(data.isDemo).toBe(false);
  });

  it('mode ALLUMÉ : le gabarit est un gabarit de démonstration', async () => {
    await service(true).create(admin, saisie);

    const data = (
      db.notificationTemplate.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    ).data;
    expect(data.isDemo).toBe(true);
  });
});

describe('cloisonnement des lectures', () => {
  it('la liste écarte les gabarits de démonstration quand le mode est éteint', async () => {
    await service(false).list(true);
    expect(whereOf(db.notificationTemplate.findMany).isDemo).toBe(false);
  });

  it('la liste ne filtre plus rien quand le mode est allumé', async () => {
    await service(true).list(true);
    expect(whereOf(db.notificationTemplate.findMany).isDemo).toBeUndefined();
  });

  it('le filtre de visibilité s’AJOUTE au filtre d’activité, il ne le remplace pas', async () => {
    await service(false).list(false);

    const where = whereOf(db.notificationTemplate.findMany);
    expect(where.isActive).toBe(true);
    expect(where.isDemo).toBe(false);
  });

  it.each([
    ['get', (s: NotificationTemplatesService) => s.get('tpl-1')],
    ['update', (s: NotificationTemplatesService) => s.update('tpl-1', { name: 'Autre' })],
    ['render', (s: NotificationTemplatesService) => s.render('tpl-1', {})],
  ])('%s répond « introuvable » sur un gabarit masqué', async (_label, run) => {
    db.notificationTemplate.findFirst.mockResolvedValue(null);

    await expect(run(service(false))).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_TEMPLATE_NOT_FOUND' },
    });

    expect(whereOf(db.notificationTemplate.findFirst)).toMatchObject({
      id: 'tpl-1',
      isDemo: false,
    });
  });

  it('mode ALLUMÉ, le même gabarit s’ouvre : il est masqué, pas supprimé', async () => {
    db.notificationTemplate.findFirst.mockResolvedValue(templateRow());

    await expect(service(true).get('tpl-1')).resolves.toMatchObject({ id: 'tpl-1' });
    expect(whereOf(db.notificationTemplate.findFirst).isDemo).toBeUndefined();
  });
});
