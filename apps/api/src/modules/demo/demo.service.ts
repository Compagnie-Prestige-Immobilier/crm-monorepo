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

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: DemoVisibilityService,
  ) {}

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

  /**
   * Allume la bascule d'affichage.
   *
   * N'ensemence QUE si le jeu de démonstration n'existe pas encore. Une fois
   * semé, il reste en base ; allumer et éteindre ne fait plus que changer sa
   * visibilité. C'est ce qui rend l'interrupteur sans danger : il ne détruit
   * rien, ni côté réel, ni côté démonstration.
   */
  async enable(adminId: string): Promise<DemoStatusDto> {
    const guard = this.guard();
    if (!guard.allowed) {
      throw new ForbiddenException({ code: 'DEMO_MODE_NOT_ALLOWED', message: guard.reason });
    }

    const alreadySeeded = await this.prisma.demoEntity.count();
    if (alreadySeeded > 0) {
      // Le jeu existe : on se contente d'allumer. Aucune écriture de données.
      await this.prisma.$transaction(async (tx) => {
        await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
      });
      this.logger.log('Mode démonstration allumé (jeu déjà en place).');
      return this.status();
    }

    const registry = new DemoRegistry();
    await this.prisma.$transaction(
      async (tx) => {
        await seedDemoData(tx, registry);

        // Le registre est écrit DANS la même transaction que les données. Il ne
        // sert plus à la bascule — c'est la colonne `isDemo` qui porte la
        // visibilité — mais il reste l'inventaire exact de ce qui a été créé,
        // et donc la seule base sûre d'une suppression définitive.
        await tx.demoEntity.createMany({ data: registry.toRows() });
        await this.setSetting(tx, DEMO_MODE_SETTING, 'true', adminId);
        await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, new Date().toISOString(), adminId);
      },
      { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
    );

    this.logger.log(`Mode démonstration semé et allumé : ${String(registry.size)} entités.`);
    return this.status();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Désactivation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Éteint la bascule. NE SUPPRIME RIEN.
   *
   * Les lignes de démonstration restent en base, invisibles : aucune lecture ne
   * les rend plus, export Excel compris. C'est ce qui empêche une fiche fictive
   * de se retrouver dans un document transmis au siège.
   *
   * La suppression définitive est une action SÉPARÉE et explicite (`purge`) :
   * confondre les deux, c'est risquer qu'un administrateur qui voulait
   * simplement masquer la démonstration efface les données.
   */
  async disable(adminId: string): Promise<DemoStatusDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
    });
    this.logger.log('Mode démonstration éteint — aucune donnée supprimée.');
    return this.status();
  }

  /**
   * Supprime DÉFINITIVEMENT le jeu de démonstration.
   *
   * Supprime exactement ce que le registre liste, dans l'ordre inverse de
   * création. Aucune heuristique n'intervient : ni motif de nom, ni fenêtre de
   * dates, ni appartenance à un compte. Une ligne absente du registre n'est
   * jamais touchée, quelle que soit sa ressemblance avec une donnée de
   * démonstration.
   *
   * Action distincte de `disable` : celle-ci est irréversible et l'interface
   * doit la faire confirmer explicitement.
   */
  async purge(adminId: string): Promise<DemoStatusDto> {
    const entries = await this.prisma.demoEntity.findMany({
      orderBy: { sequence: 'desc' },
    });

    if (entries.length === 0) {
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
          if (!DEMO_ENTITY_TYPES.includes(group.type)) {
            throw new Error(`Type d’entité de démonstration inconnu : ${group.type}`);
          }
          await DEMO_DELETERS[group.type](tx, group.ids);
        }
        await tx.demoEntity.deleteMany({});
        await this.setSetting(tx, DEMO_MODE_SETTING, 'false', adminId);
        await this.setSetting(tx, DEMO_SEEDED_AT_SETTING, '', adminId);
      },
      { timeout: DEMO_TRANSACTION_TIMEOUT_MS },
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
    // `updatedById` est une information d'audit, pas une dépendance dure : si
    // l'auteur a disparu entre-temps — typiquement l'administrateur de
    // démonstration, supprimé par la purge en cours — le réglage doit tout de
    // même s'écrire. Sans ce garde-fou, purger emporte l'auteur puis échoue en
    // voulant enregistrer l'extinction, et le mode reste allumé sur une base
    // vide.
    const author = await tx.user.findUnique({ where: { id: adminId }, select: { id: true } });
    const updatedById = author ? adminId : null;

    await tx.appSetting.upsert({
      where: { key },
      create: { key, value, updatedById },
      update: { value, updatedById },
    });

    // Le cache de visibilité est vidé ICI, dans l'unique fonction qui écrit un
    // réglage, et non à la sortie de `enable` / `disable` / `purge` : ces trois
    // méthodes ont sept points de retour à elles trois, et il suffirait d'en
    // oublier un pour qu'un administrateur bascule l'interrupteur sans que
    // l'écran change — le pire symptôme possible pour un interrupteur.
    this.visibility.invalidate();
  }
}
