import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { readEnv } from '../../env.js';
import {
  DEMO_DELETERS,
  DEMO_ENTITY_TYPES,
  DEMO_MODE_SETTING,
  DEMO_SEEDED_AT_SETTING,
  DemoRegistry,
  type DemoEntityType,
} from './demo-registry.js';
import { seedDemoData } from './demo-seeder.js';
import type { DemoCountsDto, DemoStatusDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

// L'ensemencement touche plusieurs milliers de lignes : le défaut de Prisma (5 s) ne suffit pas,
// et découper en plusieurs transactions laisserait une démonstration à moitié semée.
const DEMO_TRANSACTION_TIMEOUT_MS = 120_000;

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: DemoVisibilityService,
  ) {}

  // En production, rien ne s'active sans `DEMO_MODE_ALLOWED` : c'est ce qui empêche des fiches
  // fictives de se mêler aux vraies. Variable d'environnement et non réglage en base, pour rester
  // hors de portée de l'interface, y compris pour un administrateur.
  private guard(): { allowed: boolean; reason: string | null } {
    const env = readEnv();
    if (env.NODE_ENV !== 'production') return { allowed: true, reason: null };
    if (env.DEMO_MODE_ALLOWED) return { allowed: true, reason: null };
    return {
      allowed: false,
      reason:
        'Le mode démonstration est désactivé en production. Pour l’autoriser, ' +
        'positionnez DEMO_MODE_ALLOWED=true sur le serveur et redémarrez l’API.',
    };
  }

  async status(): Promise<DemoStatusDto> {
    const [mode, seededAt, rows] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: DEMO_MODE_SETTING } }),
      this.prisma.appSetting.findUnique({ where: { key: DEMO_SEEDED_AT_SETTING } }),
      this.prisma.demoEntity.groupBy({ by: ['entityType'], _count: { _all: true } }),
    ]);

    const byType = new Map(rows.map((row) => [row.entityType, row._count._all]));
    const counts: DemoCountsDto = {
      users: byType.get('user') ?? 0,
      representants: byType.get('representant') ?? 0,
      prospects: byType.get('prospect') ?? 0,
      campaigns: byType.get('callCampaign') ?? 0,
      campaignCommerciaux: byType.get('callCampaignCommercial') ?? 0,
      callTasks: byType.get('callTask') ?? 0,
      callAttempts: byType.get('callAttempt') ?? 0,
      bankCases: byType.get('bankCase') ?? 0,
      bankCaseTransitions: byType.get('bankCaseTransition') ?? 0,
    };

    const guard = this.guard();
    return {
      enabled: mode?.value === 'true' && rows.length > 0,
      seededAt: seededAt?.value ?? null,
      canToggle: guard.allowed,
      reason: guard.reason,
      counts,
    };
  }

  // N'ensemence QUE si le jeu n'existe pas déjà : allumer et éteindre ne fait ensuite que changer
  // sa visibilité, jamais détruire, ni côté réel ni côté démonstration.
  async enable(adminId: string): Promise<DemoStatusDto> {
    const guard = this.guard();
    if (!guard.allowed) {
      throw new ForbiddenException({ code: 'DEMO_MODE_NOT_ALLOWED', message: guard.reason });
    }

    // Décompte restreint aux types connus, pendant exact de la purge : elle laisse les types
    // inconnus derrière elle, et un décompte nu les prendrait pour un jeu encore en place.
    const alreadySeeded = await this.prisma.demoEntity.count({
      where: { entityType: { in: [...DEMO_ENTITY_TYPES] } },
    });
    if (alreadySeeded > 0) {
      await this.afterCommit(
        this.prisma.$transaction(async (tx) => {
          await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
        }),
      );
      this.logger.log('Mode démonstration allumé (jeu déjà en place).');
      return this.status();
    }

    const registry = new DemoRegistry();
    await this.afterCommit(
      this.prisma.$transaction(
        async (tx) => {
          await seedDemoData(tx, registry);

          await tx.demoEntity.createMany({ data: registry.toRows() });
          await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
          await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, new Date().toISOString(), adminId);
        },
        { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
      ),
    );

    this.logger.log(`Mode démonstration semé et allumé : ${String(registry.size)} entités.`);
    return this.status();
  }

  // Éteint la bascule et NE SUPPRIME RIEN : les lignes restent en base, invisibles à toute lecture,
  // export compris. La suppression définitive est une action séparée et explicite, `purge`.
  async disable(adminId: string): Promise<DemoStatusDto> {
    await this.afterCommit(
      this.prisma.$transaction(async (tx) => {
        await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
      }),
    );
    this.logger.log('Mode démonstration éteint, aucune donnée supprimée.');
    return this.status();
  }

  // Supprime DÉFINITIVEMENT, et exactement ce que le registre liste : aucune heuristique de nom,
  // de date ni de compte, pour qu'une donnée réelle ne soit jamais emportée par ressemblance.
  async purge(adminId: string): Promise<DemoStatusDto> {
    const entries = await this.prisma.demoEntity.findMany({
      orderBy: { sequence: 'desc' },
    });

    if (entries.length === 0) {
      await this.afterCommit(
        this.prisma.$transaction(async (tx) => {
          await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
        }),
      );
      return this.status();
    }

    const byType = new Map<DemoEntityType, string[]>();
    const unknown: string[] = [];
    for (const entry of entries) {
      const type = entry.entityType as DemoEntityType;
      if (!DEMO_ENTITY_TYPES.includes(type)) {
        unknown.push(entry.entityType);
        continue;
      }
      const bucket = byType.get(type);
      if (bucket) bucket.push(entry.entityId);
      else byType.set(type, [entry.entityId]);
    }

    if (unknown.length) {
      this.logger.error(
        `Registre de démonstration : ${String(unknown.length)} ligne(s) de type inconnu, ` +
          `laissées en place et NON supprimées (${[...new Set(unknown)].join(', ')}). ` +
          'La purge a traité tout le reste. Ces lignes désignent des données ' +
          'qu’aucun code ne sait effacer : elles demandent une intervention manuelle.',
      );
    }

    // L'ordre de suppression suit les TYPES à l'envers, pas les séquences : le registre est aussi
    // alimenté hors ensemenceur, où un enfant peut porter un rang inférieur à son parent.
    const groups = [...DEMO_ENTITY_TYPES]
      .reverse()
      .map((type) => ({ type, ids: byType.get(type) ?? [] }))
      .filter((group) => group.ids.length > 0);

    await this.afterCommit(
      this.prisma.$transaction(
        async (tx) => {
          for (const group of groups) {
            await DEMO_DELETERS[group.type](tx, group.ids);
          }
          // Le registre n'est vidé que de ce qui a réellement été supprimé : effacer les lignes de
          // type inconnu ferait disparaître la seule trace de données que plus rien ne sait viser.
          await tx.demoEntity.deleteMany({
            where: { entityType: { in: [...DEMO_ENTITY_TYPES] } },
          });
          await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
          await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, '', adminId);
        },
        { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
      ),
    );

    this.logger.log(`Jeu de démonstration supprimé : ${String(entries.length)} entités.`);
    return this.status();
  }

  private async setSetting(
    tx: Prisma.TransactionClient,
    key: string,
    value: string,
    adminId: string,
  ): Promise<void> {
    // Audit, pas dépendance dure : la purge en cours vient peut-être de supprimer l'auteur, et
    // sans ce repli elle échouerait en enregistrant l'extinction, laissant le mode allumé à vide.
    const author = await tx.user.findUnique({ where: { id: adminId }, select: { id: true } });
    const updatedById = author ? adminId : null;

    await tx.appSetting.upsert({
      where: { key },
      create: { key, value, updatedById },
      update: { value, updatedById },
    });

    this.visibility.invalidate();
  }

  // Second vidage du cache, indispensable : celui de `setSetting` a lieu DANS la transaction, donc
  // une lecture concurrente y remettrait l'ancienne valeur en cache pour tout le TTL.
  private async afterCommit<T>(work: Promise<T>): Promise<T> {
    try {
      return await work;
    } finally {
      this.visibility.invalidate();
    }
  }
}
