import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DEMO_MODE_SETTING, DEMO_SEEDED_AT_SETTING } from '../demo/demo-registry.js';
import type { PurgeCatalogDto, PurgeRequestDto, PurgeResultDto } from './dto.js';
import { findFirstAdmin, matchesConfirmation, type FirstAdmin } from './first-admin.js';
import {
  PURGE_DOMAINS,
  expandPurgeSelection,
  purgeDomain,
  purgeSteps,
  type PurgeDomainKey,
  type PurgeStepKey,
} from './purge-plan.js';
import { DEMO_TRACKED_STEPS, PURGE_STEPS, type PurgeContext } from './purge-steps.js';

/**
 * Purge de la base, depuis les réglages du panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TROIS VERROUS, ET AUCUN N'EST DÉCORATIF.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. RÔLE. Le contrôleur porte `@Roles(ADMIN)`.
 * 2. PREMIER ADMINISTRATEUR. Vérifié ICI, dans le service, et non seulement à
 *    l'affichage : un second administrateur qui appellerait l'endpoint à la
 *    main obtiendrait sinon une base vide. L'écran cache le bouton ; le service
 *    refuse l'opération. Les deux sont nécessaires, aucun ne remplace l'autre.
 * 3. RESSAISIE. L'administrateur retape son identifiant de connexion. Une case
 *    à cocher se coche par réflexe ; un identifiant se tape en conscience.
 *
 * L'opération est TRANSACTIONNELLE. Une purge à moitié faite laisserait une base
 * incohérente — des prospects sans représentants, des dossiers sans banque — ce
 * qui est strictement pire que l'état de départ.
 */

/**
 * Une purge peut porter sur des centaines de milliers de lignes. Le délai par
 * défaut de Prisma (5 s) la ferait échouer sur une base réelle, et un
 * administrateur qui voit « échec » sur un écran pareil ne réessaie pas : il
 * appelle. On prend la marge.
 */
const PURGE_TRANSACTION_TIMEOUT_MS = 300_000;

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Catalogue
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Ce que l'écran affiche AVANT toute décision : les domaines, leurs
   * dépendances, et le nombre de lignes que chacun emporterait aujourd'hui.
   *
   * Les décomptes utilisent EXACTEMENT la clause de suppression (voir
   * `PURGE_STEPS`) : le chiffre annoncé est celui qui sera supprimé, et non
   * l'estimation d'un autre critère.
   */
  async catalog(actor: AuthenticatedUser): Promise<PurgeCatalogDto> {
    const firstAdmin = await this.findFirstAdmin();
    const allowed = firstAdmin !== null && firstAdmin.id === actor.id;

    const context: PurgeContext = { actorId: actor.id };
    const rows = await this.countAllSteps(context);

    return {
      allowed,
      // Ce que l'administrateur devra retaper. L'afficher n'affaiblit rien : la
      // ressaisie sert à interrompre un geste automatique, pas à prouver une
      // identité — celle-ci est déjà établie par le jeton.
      confirmationHint: allowed ? firstAdmin.username : '',
      domains: PURGE_DOMAINS.map((domain) => ({
        key: domain.key,
        label: domain.label,
        hint: domain.hint,
        requires: [...domain.requires],
        rows: domain.steps.reduce((sum, step) => sum + (rows.get(step) ?? 0), 0),
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Purge
  // ───────────────────────────────────────────────────────────────────────────

  async purge(actor: AuthenticatedUser, body: PurgeRequestDto): Promise<PurgeResultDto> {
    const firstAdmin = await this.requireFirstAdmin(actor);

    if (!matchesConfirmation(firstAdmin, body.confirmation)) {
      // 401 et non 400 : ce n'est pas la forme de la requête qui est en cause,
      // c'est la confirmation d'identité qui n'a pas été donnée.
      throw new UnauthorizedException({
        code: 'PURGE_CONFIRMATION_MISMATCH',
        message: 'Identifiant incorrect. Saisissez celui de votre connexion.',
      });
    }

    const domains = expandPurgeSelection(body.domains);
    const steps = purgeSteps(domains);
    const context: PurgeContext = { actorId: actor.id };

    const removed = new Map<PurgeStepKey, number>();

    await this.prisma.$transaction(
      async (tx) => {
        // L'ordre vient de `PURGE_STEP_ORDER`, enfants avant parents. Il ne
        // dépend NI de l'ordre des cases cochées, NI de l'ordre des domaines.
        for (const step of steps) {
          removed.set(step, await PURGE_STEPS[step].remove(tx, context));
        }

        // Le registre de démonstration désignerait des lignes disparues : les
        // paramètres continueraient d'annoncer un jeu en place, et la
        // désactivation ne supprimerait rien. On remet l'interrupteur à zéro
        // dans la MÊME transaction, plutôt que de laisser deux sources se
        // contredire.
        if (steps.some((step) => DEMO_TRACKED_STEPS.includes(step))) {
          await tx.demoEntity.deleteMany({});
          for (const [key, value] of [
            [DEMO_MODE_SETTING, 'false'],
            [DEMO_SEEDED_AT_SETTING, ''],
          ] as const) {
            await tx.appSetting.upsert({
              where: { key },
              create: { key, value, updatedById: actor.id },
              update: { value, updatedById: actor.id },
            });
          }
        }

        // La trace est écrite APRÈS les suppressions, jamais avant : si le
        // journal d'audit fait lui-même partie de la purge, la trace de CETTE
        // purge doit survivre. Écrite en amont, elle serait effacée par
        // l'étape `auditLogs` et l'opération ne laisserait rien derrière elle.
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: 'DATABASE_PURGE',
            entity: 'database',
            entityId: actor.id,
            after: this.auditPayload(domains, removed),
          },
        });
      },
      { timeout: PURGE_TRANSACTION_TIMEOUT_MS },
    );

    const deleted = domains
      .map((key) => {
        const domain = purgeDomain(key);
        return {
          key,
          label: domain.label,
          rows: domain.steps.reduce((sum, step) => sum + (removed.get(step) ?? 0), 0),
        };
      })
      .filter((entry) => entry.rows > 0);

    const total = deleted.reduce((sum, entry) => sum + entry.rows, 0);
    this.logger.warn(
      `Purge exécutée par ${actor.username} : ${String(total)} lignes, domaines ${domains.join(', ')}.`,
    );

    return { deleted, total, purgedAt: new Date().toISOString() };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Interne
  // ───────────────────────────────────────────────────────────────────────────

  private findFirstAdmin(): Promise<FirstAdmin | null> {
    // Adapté plutôt que passé tel quel : `findFirstAdmin` ne demande qu'une
    // méthode `findFirst` à la signature concrète, ce qui la rend testable avec
    // un double de trois lignes. Le délégué Prisma, lui, est générique.
    return findFirstAdmin({ findFirst: (args) => this.prisma.user.findFirst(args) });
  }

  /**
   * Le compte appelant EST-IL le premier administrateur ?
   *
   * Refuser par 403 et non par 404 : l'endpoint existe, il est simplement
   * fermé à ce compte. Le message nomme la raison, sinon un second
   * administrateur conclut à une panne et rouvre un ticket par jour.
   */
  private async requireFirstAdmin(actor: AuthenticatedUser): Promise<FirstAdmin> {
    const firstAdmin = await this.findFirstAdmin();
    if (firstAdmin === null || firstAdmin.id !== actor.id) {
      throw new ForbiddenException({
        code: 'PURGE_NOT_FIRST_ADMIN',
        message: 'Purge réservée au premier compte administrateur.',
      });
    }
    return firstAdmin;
  }

  /** Décompte de chaque étape, avec la clause exacte de sa suppression. */
  private async countAllSteps(context: PurgeContext): Promise<Map<PurgeStepKey, number>> {
    const entries = Object.entries(PURGE_STEPS) as [
      PurgeStepKey,
      (typeof PURGE_STEPS)[PurgeStepKey],
    ][];
    const counts = await Promise.all(
      entries.map(async ([key, step]): Promise<[PurgeStepKey, number]> => [
        key,
        await step.count(this.prisma, context),
      ]),
    );
    return new Map(counts);
  }

  /** Détail par TABLE, et non par domaine : le journal doit rester lisible
   *  même si le découpage en domaines change plus tard. */
  private auditPayload(
    domains: readonly PurgeDomainKey[],
    removed: ReadonlyMap<PurgeStepKey, number>,
  ): Prisma.InputJsonObject {
    const deleted: Record<string, number> = {};
    let total = 0;
    for (const [step, rows] of removed) {
      if (rows === 0) continue;
      const table = PURGE_STEPS[step].table;
      deleted[table] = (deleted[table] ?? 0) + rows;
      total += rows;
    }
    return { domains: [...domains], deleted, total };
  }
}
