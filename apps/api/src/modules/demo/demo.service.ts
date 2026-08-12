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

/**
 * L'ensemencement touche plusieurs milliers de lignes : le délai par défaut de
 * Prisma (5 s) ne suffit pas, et il n'est pas question de découper en plusieurs
 * transactions — une démonstration à moitié semée est pire qu'une démonstration
 * absente.
 */
const DEMO_TRANSACTION_TIMEOUT_MS = 120_000;

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Garde-fou d'environnement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * En production, activer le mode démonstration est refusé tant que
   * `DEMO_MODE_ALLOWED` ne vaut pas `true`.
   *
   * Des prospects fictifs mêlés à de vraies fiches dans un export transmis au
   * siège serait un incident sérieux, et la fiabilité de la base tout entière
   * deviendrait suspecte. Le garde-fou est délibérément une variable
   * d'environnement et non un réglage en base : il doit rester hors de portée
   * de l'interface, y compris pour un administrateur.
   */
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

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture
  // ───────────────────────────────────────────────────────────────────────────

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
      // L'état fait foi sur le registre, pas sur le réglage : si les deux
      // divergent, ce qui existe réellement en base est ce qui compte.
      enabled: mode?.value === 'true' && rows.length > 0,
      seededAt: seededAt?.value ?? null,
      canToggle: guard.allowed,
      reason: guard.reason,
      counts,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Activation
  // ───────────────────────────────────────────────────────────────────────────

  async enable(adminId: string): Promise<DemoStatusDto> {
    const guard = this.guard();
    if (!guard.allowed) {
      throw new ForbiddenException({ code: 'DEMO_MODE_NOT_ALLOWED', message: guard.reason });
    }

    // Idempotent : réactiver alors que des données existent déjà ne double pas
    // le jeu. L'administrateur qui appuie deux fois n'a pas à s'en inquiéter.
    const existing = await this.prisma.demoEntity.count();
    if (existing > 0) {
      this.logger.log('Mode démonstration déjà actif — ensemencement ignoré.');
      return this.status();
    }

    const registry = new DemoRegistry();
    await this.prisma.$transaction(
      async (tx) => {
        await seedDemoData(tx, registry);

        // Le registre est écrit DANS la même transaction que les données. Si
        // celle-ci échoue, ni les données ni leurs traces ne subsistent : jamais
        // l'une sans l'autre, ce qui laisserait des lignes intraçables.
        await tx.demoEntity.createMany({ data: registry.toRows() });
        await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
        await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, new Date().toISOString(), adminId);
      },
      { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
    );

    this.logger.log(`Mode démonstration activé : ${String(registry.size)} entités créées.`);
    return this.status();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Désactivation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Supprime EXACTEMENT ce que le registre liste.
   *
   * Aucune heuristique n'intervient : ni motif de nom, ni fenêtre de dates, ni
   * appartenance à un compte. Une ligne absente du registre n'est jamais
   * touchée, quelle que soit sa ressemblance avec une donnée de démonstration.
   */
  async disable(adminId: string): Promise<DemoStatusDto> {
    const entries = await this.prisma.demoEntity.findMany({
      orderBy: { sequence: 'desc' },
    });

    if (entries.length === 0) {
      // Idempotent, comme l'activation.
      await this.prisma.$transaction(async (tx) => {
        await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
      });
      return this.status();
    }

    // Regroupé par type EN CONSERVANT l'ordre décroissant de séquence : les
    // enfants partent avant leurs parents, ce qui satisfait les clés étrangères
    // sans avoir à connaître le graphe des dépendances.
    const groups: { type: DemoEntityType; ids: string[] }[] = [];
    for (const entry of entries) {
      const type = entry.entityType as DemoEntityType;
      const last = groups.at(-1);
      if (last && last.type === type) last.ids.push(entry.entityId);
      else groups.push({ type, ids: [entry.entityId] });
    }

    await this.prisma.$transaction(
      async (tx) => {
        for (const group of groups) {
          const deleter = DEMO_DELETERS[group.type];
          // Un type inconnu signalerait un registre écrit par une version
          // ultérieure : on refuse plutôt que d'abandonner des lignes derrière.
          if (!DEMO_ENTITY_TYPES.includes(group.type)) {
            throw new Error(`Type d’entité de démonstration inconnu : ${group.type}`);
          }
          await deleter(tx, group.ids);
        }
        await tx.demoEntity.deleteMany({});
        await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
        await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, '', adminId);
      },
      { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
    );

    this.logger.log(`Mode démonstration désactivé : ${String(entries.length)} entités retirées.`);
    return this.status();
  }

  private async setSetting(
    tx: Prisma.TransactionClient,
    key: string,
    value: string,
    adminId: string,
  ): Promise<void> {
    await tx.appSetting.upsert({
      where: { key },
      create: { key, value, updatedById: adminId },
      update: { value, updatedById: adminId },
    });
  }
}
