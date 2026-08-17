import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { PurgeService } from './purge.service.js';

const FIRST_ADMIN = { id: 'admin-1', email: 'direction@cpi.sn', username: 'direction' };

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: FIRST_ADMIN.id,
    email: FIRST_ADMIN.email,
    username: FIRST_ADMIN.username,
    fullName: 'Direction CPI',
    role: Role.ADMIN,
    ...overrides,
  };
}

interface DeleteCall {
  readonly model: string;
  readonly args: unknown;
}

interface Trace {
  readonly deletes: DeleteCall[];
  readonly upserts: string[];
  readonly audits: Record<string, unknown>[];
}

function indexOfModel(trace: Trace, model: string): number {
  return trace.deletes.findIndex((call) => call.model === model);
}

function makePrisma(options: { firstAdmin?: typeof FIRST_ADMIN | null } = {}): {
  prisma: PrismaService;
  trace: Trace;
} {
  const trace: Trace = { deletes: [], upserts: [], audits: [] };

  const delegate = (model: string): Record<string, unknown> => ({
    count: () => Promise.resolve(model === 'user' ? 2 : 7),
    deleteMany: (args: unknown) => {
      trace.deletes.push({ model, args });
      return Promise.resolve({ count: model === 'demoEntity' ? 0 : 5 });
    },
    upsert: (args: { where: { key: string } }) => {
      trace.upserts.push(args.where.key);
      return Promise.resolve({});
    },
    create: (args: { data: Record<string, unknown> }) => {
      trace.audits.push(args.data);
      return Promise.resolve({});
    },
    findFirst: () =>
      Promise.resolve(options.firstAdmin === undefined ? FIRST_ADMIN : options.firstAdmin),
  });

  const client: unknown = new Proxy(
    {},
    {
      get(_target, property): unknown {
        if (property === '$transaction') {
          return (run: (tx: unknown) => Promise<void>) => run(client);
        }
        if (typeof property !== 'string') return undefined;
        return delegate(property);
      },
    },
  );

  return { prisma: client as PrismaService, trace };
}

describe('PurgeService, autorisation', () => {
  it('refuse un administrateur qui n’est pas le premier', async () => {
    const { prisma, trace } = makePrisma();
    const service = new PurgeService(prisma);

    await expect(
      service.purge(actor({ id: 'admin-2', username: 'second' }), {
        domains: ['journal'],
        confirmation: 'second',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(trace.deletes).toEqual([]);
  });

  it('refuse quand aucun administrateur d’amorçage n’est trouvé', async () => {
    const { prisma } = makePrisma({ firstAdmin: null });
    const service = new PurgeService(prisma);

    await expect(
      service.purge(actor(), { domains: ['journal'], confirmation: 'direction' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse une confirmation qui ne reprend pas l’identifiant', async () => {
    const { prisma, trace } = makePrisma();
    const service = new PurgeService(prisma);

    await expect(
      service.purge(actor(), { domains: ['journal'], confirmation: 'purger' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(trace.deletes).toEqual([]);
  });

  it('accepte l’e-mail à la place du nom d’utilisateur, casse et espaces mis à part', async () => {
    const { prisma } = makePrisma();
    const service = new PurgeService(prisma);

    await expect(
      service.purge(actor(), { domains: ['journal'], confirmation: '  DIRECTION@CPI.SN ' }),
    ).resolves.toMatchObject({ total: 5 });
  });

  it('ne dévoile l’identifiant à ressaisir qu’au premier administrateur', async () => {
    const { prisma } = makePrisma();
    const service = new PurgeService(prisma);

    await expect(service.catalog(actor())).resolves.toMatchObject({
      allowed: true,
      confirmationHint: 'direction',
    });
    await expect(service.catalog(actor({ id: 'admin-2' }))).resolves.toMatchObject({
      allowed: false,
      confirmationHint: '',
    });
  });

  it('annonce, pour chaque domaine, le nombre de lignes de ses étapes', async () => {
    const { prisma } = makePrisma();
    const catalog = await new PurgeService(prisma).catalog(actor());

    expect(catalog.domains.find((domain) => domain.key === 'dossiers')?.rows).toBe(14);
    expect(catalog.domains.find((domain) => domain.key === 'journal')?.rows).toBe(7);
  });
});

describe('PurgeService, exécution', () => {
  it('supprime les enfants avant les parents', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['representants'],
      confirmation: 'direction',
    });

    expect(indexOfModel(trace, 'bankCaseTransition')).toBeLessThan(indexOfModel(trace, 'bankCase'));
    expect(indexOfModel(trace, 'bankCase')).toBeLessThan(indexOfModel(trace, 'prospect'));
    expect(indexOfModel(trace, 'prospect')).toBeLessThan(indexOfModel(trace, 'representant'));
  });

  it('coche les domaines entraînés sans qu’on les demande', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['representants'],
      confirmation: 'direction',
    });

    const models = trace.deletes.map((call) => call.model);
    expect(models).toContain('prospect');
    expect(models).toContain('bankCase');
    expect(models).toContain('callTask');
    expect(models).toContain('callAttempt');
  });

  it('n’exécute que les étapes des domaines demandés', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['journal'],
      confirmation: 'direction',
    });

    expect(trace.deletes.map((call) => call.model)).toEqual(['auditLog']);
  });

  it('exclut le compte appelant de la suppression des comptes', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['teleconseillers'],
      confirmation: 'direction',
    });

    const userDeletes = trace.deletes.filter((call) => call.model === 'user');
    expect(userDeletes.length).toBeGreaterThan(0);
    for (const call of userDeletes) {
      expect(call.args).toMatchObject({ where: { id: { not: FIRST_ADMIN.id } } });
    }
  });

  it('ne vise jamais les comptes administrateurs', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['teleconseillers', 'finances'],
      confirmation: 'direction',
    });

    const roles = trace.deletes
      .filter((call) => call.model === 'user')
      .map((call) => (call.args as { where: { role: Role } }).where.role);
    expect(roles).toEqual([Role.COMMERCIAL, Role.BANQUE_FINANCE]);
    expect(roles).not.toContain(Role.ADMIN);
  });

  it('remet le mode démonstration à zéro quand la purge emporte ses lignes', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['prospects'],
      confirmation: 'direction',
    });

    expect(trace.deletes.map((call) => call.model)).toContain('demoEntity');
    expect(trace.upserts).toEqual(['demo_mode', 'demo_seeded_at']);
  });

  it('laisse le registre de démonstration intact pour un domaine sans rapport', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['journal'],
      confirmation: 'direction',
    });

    expect(trace.deletes.map((call) => call.model)).not.toContain('demoEntity');
    expect(trace.upserts).toEqual([]);
  });

  it('journalise la purge après les suppressions, pour que la trace survive', async () => {
    const { prisma, trace } = makePrisma();
    await new PurgeService(prisma).purge(actor(), {
      domains: ['journal'],
      confirmation: 'direction',
    });

    expect(trace.audits).toHaveLength(1);
    expect(trace.audits[0]).toMatchObject({
      action: 'DATABASE_PURGE',
      entity: 'database',
      userId: FIRST_ADMIN.id,
    });
  });

  it('rend le détail par domaine et le total', async () => {
    const { prisma } = makePrisma();
    const result = await new PurgeService(prisma).purge(actor(), {
      domains: ['dossiers'],
      confirmation: 'direction',
    });

    expect(result.deleted).toEqual([{ key: 'dossiers', label: 'Dossiers bancaires', rows: 10 }]);
    expect(result.total).toBe(10);
    expect(Number.isNaN(Date.parse(result.purgedAt))).toBe(false);
  });
});
