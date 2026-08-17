process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'demo-service-access-secret-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'demo-service-refresh-secret-32-characters';

import { describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { DEMO_MODE_SETTING } from './demo-registry.js';
import { DemoService } from './demo.service.js';

const restrictViolation = (representantId: string): Error =>
  new Error(
    `update or delete on table "representants" violates foreign key constraint ` +
      `"prospects_representantId_fkey" (${representantId})`,
  );

interface EntityTypeFilter {
  where?: { entityType?: { in?: readonly string[] } };
}

const keeps = (entry: { entityType: string }, args?: EntityTypeFilter): boolean => {
  const wanted = args?.where?.entityType?.in;
  return wanted === undefined || wanted.includes(entry.entityType);
};

class FakeDemoDb {
  readonly representants = new Set<string>();
  readonly prospects = new Map<string, string>();
  entries: { entityType: string; entityId: string; sequence: number }[] = [];
  readonly settings = new Map<string, string>();

  readonly demoEntity = {
    count: (args?: EntityTypeFilter) =>
      Promise.resolve(this.entries.filter((entry) => keeps(entry, args)).length),
    findMany: () =>
      Promise.resolve([...this.entries].sort((left, right) => right.sequence - left.sequence)),
    deleteMany: (args?: EntityTypeFilter) => {
      const before = this.entries.length;
      this.entries = this.entries.filter((entry) => !keeps(entry, args));
      return Promise.resolve({ count: before - this.entries.length });
    },
    groupBy: () => {
      const buckets = new Map<string, number>();
      for (const entry of this.entries) {
        buckets.set(entry.entityType, (buckets.get(entry.entityType) ?? 0) + 1);
      }
      return Promise.resolve(
        [...buckets.entries()].map(([entityType, count]) => ({
          entityType,
          _count: { _all: count },
        })),
      );
    },
  };

  readonly prospect = {
    deleteMany: (args: { where: { id: { in: string[] } } }) => {
      for (const id of args.where.id.in) this.prospects.delete(id);
      return Promise.resolve({ count: args.where.id.in.length });
    },
  };

  readonly representant = {
    deleteMany: (args: { where: { id: { in: string[] } } }) => {
      for (const id of args.where.id.in) {
        const held = [...this.prospects.values()].includes(id);
        if (held) return Promise.reject(restrictViolation(id));
        this.representants.delete(id);
      }
      return Promise.resolve({ count: args.where.id.in.length });
    },
  };

  readonly user = {
    findUnique: () => Promise.resolve(null),
  };

  readonly appSetting = {
    findUnique: (args: { where: { key: string } }) => {
      const value = this.settings.get(args.where.key);
      return Promise.resolve(value === undefined ? null : { key: args.where.key, value });
    },
    upsert: (args: { where: { key: string }; create: { value: string } }) => {
      this.settings.set(args.where.key, args.create.value);
      return Promise.resolve({ key: args.where.key, value: args.create.value });
    },
  };

  $transaction = <T>(run: (tx: FakeDemoDb) => Promise<T>): Promise<T> => run(this);

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

describe('purge : l’ordre de suppression', () => {
  it('supprime le prospect AVANT son représentant, même si son rang est plus bas', async () => {
    const db = new FakeDemoDb();
    db.representants.add('rep-1');
    db.representants.add('rep-2');
    db.prospects.set('pro-1', 'rep-2');
    db.entries = [
      { entityType: 'representant', entityId: 'rep-1', sequence: 0 },
      { entityType: 'prospect', entityId: 'pro-1', sequence: 1 },
      { entityType: 'representant', entityId: 'rep-2', sequence: 2 },
    ];
    const service = new DemoService(db.asService(), fakeDemoVisibility(true));

    const status = await service.purge('adm-1');

    expect(db.prospects.size).toBe(0);
    expect(db.representants.size).toBe(0);
    expect(db.entries).toHaveLength(0);
    expect(status.enabled).toBe(false);
  });

  it('et l’ordre habituel, rangs cohérents, continue de passer', async () => {
    const db = new FakeDemoDb();
    db.representants.add('rep-1');
    db.prospects.set('pro-1', 'rep-1');
    db.entries = [
      { entityType: 'representant', entityId: 'rep-1', sequence: 0 },
      { entityType: 'prospect', entityId: 'pro-1', sequence: 1 },
    ];
    const service = new DemoService(db.asService(), fakeDemoVisibility(true));

    await service.purge('adm-1');

    expect(db.prospects.size).toBe(0);
    expect(db.representants.size).toBe(0);
  });

  it('purge tout ce qu’elle sait supprimer malgré une ligne de type inconnu', async () => {
    const db = new FakeDemoDb();
    db.representants.add('rep-1');
    db.prospects.set('pro-1', 'rep-1');
    db.entries = [
      { entityType: 'representant', entityId: 'rep-1', sequence: 0 },
      { entityType: 'prospect', entityId: 'pro-1', sequence: 1 },
      { entityType: 'anciensTruc', entityId: 'x-1', sequence: 2 },
    ];
    const service = new DemoService(db.asService(), fakeDemoVisibility(true));

    const status = await service.purge('adm-1');

    expect(db.prospects.size).toBe(0);
    expect(db.representants.size).toBe(0);
    expect(status.enabled).toBe(false);

    expect(db.entries).toEqual([{ entityType: 'anciensTruc', entityId: 'x-1', sequence: 2 }]);
  });

  it('ne prend pas un reliquat inconnu pour un jeu déjà semé', async () => {
    const db = new FakeDemoDb();
    db.entries = [{ entityType: 'anciensTruc', entityId: 'x-1', sequence: 0 }];
    const service = new DemoService(db.asService(), fakeDemoVisibility(false));

    const seme = await db.demoEntity.count({ where: { entityType: { in: ['representant'] } } });
    expect(seme).toBe(0);
    await expect(service.purge('adm-1')).resolves.toBeDefined();
  });
});

class TransactionalSettingsDb {
  private committed = new Map<string, string>();
  private pending = new Map<string, string>();
  duringCommit: (() => Promise<void>) | null = null;

  readonly demoEntity = {
    count: () => Promise.resolve(1),
    groupBy: () => Promise.resolve([]),
  };

  readonly user = { findUnique: () => Promise.resolve(null) };

  readonly appSetting = {
    findUnique: (args: { where: { key: string } }) => {
      const value = this.committed.get(args.where.key);
      return Promise.resolve(value === undefined ? null : { key: args.where.key, value });
    },
    upsert: (args: { where: { key: string }; create: { value: string } }) => {
      this.pending.set(args.where.key, args.create.value);
      return Promise.resolve({ key: args.where.key, value: args.create.value });
    },
  };

  $transaction = async <T>(run: (tx: TransactionalSettingsDb) => Promise<T>): Promise<T> => {
    const result = await run(this);
    if (this.duringCommit) await this.duringCommit();
    this.committed = new Map([...this.committed, ...this.pending]);
    this.pending = new Map();
    return result;
  };

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

describe('bascule : le cache de visibilité', () => {
  it('est vidé APRÈS le commit, pas seulement avant', async () => {
    const db = new TransactionalSettingsDb();
    const visibility = new DemoVisibilityService(db.asService());
    const service = new DemoService(db.asService(), visibility);

    db.duringCommit = async () => {
      await visibility.state();
    };

    await service.enable('adm-1');

    expect(await visibility.state()).toBe('on');
    expect(await visibility.enabled()).toBe(true);
  });

  it('et l’extinction se voit tout de suite elle aussi', async () => {
    const db = new TransactionalSettingsDb();
    const visibility = new DemoVisibilityService(db.asService());
    const service = new DemoService(db.asService(), visibility);

    await service.enable('adm-1');
    db.duringCommit = async () => {
      await visibility.state();
    };
    await service.disable('adm-1');

    expect(await visibility.state()).toBe('off');
  });

  it('le réglage écrit est bien celui que la base rend ensuite', async () => {
    const db = new TransactionalSettingsDb();
    const visibility = new DemoVisibilityService(db.asService());
    const service = new DemoService(db.asService(), visibility);

    await service.enable('adm-1');

    const row = await db.appSetting.findUnique({ where: { key: DEMO_MODE_SETTING } });
    expect(row?.value).toBe('true');
  });
});
