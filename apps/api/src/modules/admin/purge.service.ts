import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@crm/database';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
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
import { PURGE_STEPS, type PurgeContext } from './purge-steps.js';

// Le défaut Prisma (5 s) fait échouer une purge de plusieurs centaines de milliers de lignes.
const PURGE_TRANSACTION_TIMEOUT_MS = 300_000;

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async catalog(actor: AuthenticatedUser): Promise<PurgeCatalogDto> {
    const firstAdmin = await this.findFirstAdmin();
    const allowed = firstAdmin !== null && firstAdmin.id === actor.id;

    const context: PurgeContext = { actorId: actor.id };
    const rows = await this.countAllSteps(context);

    return {
      allowed,
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

  async purge(actor: AuthenticatedUser, body: PurgeRequestDto): Promise<PurgeResultDto> {
    const firstAdmin = await this.requireFirstAdmin(actor);

    if (!matchesConfirmation(firstAdmin, body.confirmation)) {
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
        for (const step of steps) {
          removed.set(step, await PURGE_STEPS[step].remove(tx, context));
        }

        // APRÈS les suppressions : l'étape `auditLogs` effacerait une trace écrite en amont.
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

  private findFirstAdmin(): Promise<FirstAdmin | null> {
    return findFirstAdmin({ findFirst: (args) => this.prisma.user.findFirst(args) });
  }

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
