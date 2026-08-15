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

/**
 * Deux propriétés de `DemoService` qu'aucune doublure existante ne pouvait
 * démontrer, et que `demo.integration.test.ts` ne démontre pas non plus.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE À CÔTÉ DE L'ÉPREUVE D'INTÉGRATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'épreuve d'intégration purge un jeu SEMÉ, dont les rangs sortent tous du
 * même ensemenceur et sont donc cohérents par construction. Elle ne peut pas
 * produire le registre incohérent que la remontée hors ligne fabrique, parce
 * qu'elle ne passe pas par elle. Le registre est ici composé À LA MAIN, dans
 * l'état exact où un animateur le laisse.
 *
 * Les doublures de ce fichier n'imitent qu'UNE chose que Postgres fait et que
 * `fake-prisma.ts` ignore : la clé étrangère `Prospect.representantId`, en
 * `onDelete: Restrict`. C'est elle qui bloque la purge, et son absence dans les
 * doublures est la raison pour laquelle cinq tests couvrant ce chemin
 * passaient au vert sur un défaut bien réel.
 */

/** Erreur de contrainte, forme de message proche de celle de Postgres. */
const restrictViolation = (representantId: string): Error =>
  new Error(
    `update or delete on table "representants" violates foreign key constraint ` +
      `"prospects_representantId_fkey" (${representantId})`,
  );

/**
 * Base minimale : deux tables liées, le registre, et les réglages.
 *
 * `representant.deleteMany` REFUSE de supprimer une ligne encore référencée par
 * un prospect, exactement comme la vraie base. C'est tout l'intérêt de cette
 * doublure ; sans ce refus, n'importe quel ordre de suppression passerait.
 */
class FakeDemoDb {
  readonly representants = new Set<string>();
  /** Prospect vers son représentant. */
  readonly prospects = new Map<string, string>();
  entries: { entityType: string; entityId: string; sequence: number }[] = [];
  readonly settings = new Map<string, string>();

  readonly demoEntity = {
    count: () => Promise.resolve(this.entries.length),
    findMany: () =>
      Promise.resolve([...this.entries].sort((left, right) => right.sequence - left.sequence)),
    deleteMany: () => {
      const count = this.entries.length;
      this.entries = [];
      return Promise.resolve({ count });
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
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE JEU DE DÉMONSTRATION NE DOIT JAMAIS DEVENIR INDÉBOULONNABLE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le registre décrit ici est celui que laisse une séance ordinaire :
   * l'animateur saisit un prospect, crée ENSUITE un second représentant, puis
   * rattache le prospect à ce représentant-là. Le prospect est déjà inscrit, il
   * n'est pas re-numéroté, et porte donc un rang INFÉRIEUR à son parent.
   *
   * Une purge qui suit les rangs supprime alors le représentant en premier, la
   * clé étrangère `Restrict` refuse, et la transaction entière échoue : plus
   * aucune purge ne passera jamais, et le jeu de démonstration reste en base
   * pour toujours.
   */
  it('supprime le prospect AVANT son représentant, même si son rang est plus bas', async () => {
    const db = new FakeDemoDb();
    db.representants.add('rep-1');
    db.representants.add('rep-2');
    db.prospects.set('pro-1', 'rep-2');
    db.entries = [
      { entityType: 'representant', entityId: 'rep-1', sequence: 0 },
      // Le prospect est inscrit AVANT le représentant auquel il finira rattaché.
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
    // Contre-épreuve : la correction ne doit pas casser le cas semé, où le
    // parent porte bien un rang inférieur à son enfant.
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
});

/**
 * Base réduite aux réglages, avec un COMMIT explicite.
 *
 * Tant que la transaction n'a pas commis, `findUnique` rend l'ANCIENNE valeur :
 * c'est ce que voit toute autre requête de l'API pendant ce temps-là, et c'est
 * la seule chose que cette doublure a besoin d'imiter fidèlement.
 */
class TransactionalSettingsDb {
  private committed = new Map<string, string>();
  private pending = new Map<string, string>();
  /** Joué entre la fin du corps de transaction et le commit. */
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
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * VIDER LE CACHE AVANT LE COMMIT NE VIDE RIEN DU TOUT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `setSetting` vide le cache DANS la transaction. Une requête concurrente qui
   * arrive juste après lit l'ancienne valeur en base, puisque le commit n'a pas
   * eu lieu, et la met en cache pour la durée pleine du TTL. Plus rien ne
   * l'invalide ensuite : la bascule est déjà passée.
   *
   * Le mode reste donc réputé ALLUMÉ pendant deux secondes après avoir été
   * éteint, sur la garde d'écriture comme sur l'émission de jetons, et le
   * doc-bloc de `DemoVisibilityService` affirmait le contraire.
   */
  it('est vidé APRÈS le commit, pas seulement avant', async () => {
    const db = new TransactionalSettingsDb();
    const visibility = new DemoVisibilityService(db.asService());
    const service = new DemoService(db.asService(), visibility);

    // Un lecteur concurrent tombe pile dans la fenêtre : entre le vidage fait
    // par `setSetting` et le commit.
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

    // C'est le sens qui compte le plus : un compte fictif ne doit pas obtenir
    // de jeton deux secondes après l'extinction.
    expect(await visibility.state()).toBe('off');
  });

  it('le réglage écrit est bien celui que la base rend ensuite', async () => {
    // Contre-épreuve : sans elle, une doublure qui ne commettrait jamais rien
    // ferait passer les deux tests ci-dessus pour de mauvaises raisons.
    const db = new TransactionalSettingsDb();
    const visibility = new DemoVisibilityService(db.asService());
    const service = new DemoService(db.asService(), visibility);

    await service.enable('adm-1');

    const row = await db.appSetting.findUnique({ where: { key: DEMO_MODE_SETTING } });
    expect(row?.value).toBe('true');
  });
});
