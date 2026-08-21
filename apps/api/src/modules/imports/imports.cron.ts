import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImportStatus } from '@crm/database';

import { isOpenApiGeneration } from '../../env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ImportRunnerService } from './import-runner.service.js';
import { readImportsEnv } from './imports.env.js';
import { IMPORT_CLOCK_SKEW_TOLERANCE_MS, IMPORT_LEASE_MS } from './imports.job.js';
import { ImportsService } from './imports.service.js';

/**
 * Travaux démarrés par passage.
 *
 * Trois, et le chiffre compte peu : c'est le drapeau `working` qui empêche
 * l'empilement, pas cette borne. Elle évite simplement qu'un passage ne
 * s'engage à traiter cent travaux d'affilée alors que le suivant arrive dans
 * une minute.
 */
const MAX_JOBS_PER_TICK = 3;

@Injectable()
export class ImportsCron {
  private readonly logger = new Logger(ImportsCron.name);
  private readonly config = readImportsEnv();

  /**
   * Un passage à la fois DANS CE PROCESSUS.
   *
   * Ce n'est PAS le mécanisme d'exclusion — il ne vaut que pour une réplique, et
   * le bail en base est le seul arbitre entre plusieurs. C'est une politesse
   * locale : un import de cinquante mille lignes dure plus d'une minute, et sans
   * ce drapeau chaque tick empilerait un passage de plus sur le même conteneur,
   * qui tous se heurteraient au bail sans rien faire d'utile.
   */
  private working = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ImportRunnerService,
    private readonly imports: ImportsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'cpi.imports.sweep' })
  async sweepTick(): Promise<void> {
    // Le conteneur est monté sans base pendant `pnpm openapi:generate`.
    if (isOpenApiGeneration()) return;
    if (!this.config.IMPORTS_SWEEP_ENABLED) return;
    if (this.working) return;

    this.working = true;
    try {
      await this.sweep();
    } catch (error) {
      this.logger.error(`Imports : balayage impossible. ${String(error)}`);
    } finally {
      this.working = false;
    }
  }

  /**
   * Un passage : échéances d'abord, travail ensuite.
   *
   * L'ORDRE EST DÉLIBÉRÉ. Traiter les échéances en premier évite de reprendre un
   * travail dont le fichier va être détruit dans la seconde qui suit, ce qui
   * produirait un « fichier illisible » parfaitement trompeur là où la vraie
   * cause est l'échéance.
   */
  async sweep(now = new Date()): Promise<{ expired: number; started: number }> {
    const expired = await this.imports.expireDue(now);

    const leaseExpired = new Date(now.getTime() - IMPORT_LEASE_MS);
    const clockJumpedBack = new Date(now.getTime() + IMPORT_CLOCK_SKEW_TOLERANCE_MS);

    const candidates = await this.prisma.importJob.findMany({
      where: {
        status: { in: [ImportStatus.queued, ImportStatus.running] },
        expiresAt: { gt: now },
        OR: [
          { claimedAt: null },
          { claimedAt: { lt: leaseExpired } },
          { claimedAt: { gt: clockJumpedBack } },
        ],
      },
      // Le plus ancien d'abord : un import déposé il y a dix minutes passe avant
      // celui d'il y a dix secondes, sans quoi une file chargée affamerait
      // indéfiniment le premier arrivé.
      orderBy: { createdAt: 'asc' },
      take: MAX_JOBS_PER_TICK,
      select: { id: true },
    });

    let started = 0;
    for (const candidate of candidates) {
      // SÉQUENTIEL, jamais en parallèle : deux imports simultanés ouvrent deux
      // transactions d'écriture de masse sur la même base, et le second n'irait
      // pas plus vite pour autant.
      const outcome = await this.runner.run(candidate.id, new Date());
      if (outcome.result !== 'busy') started += 1;
      if (outcome.result === 'failed') {
        this.logger.warn(`Import ${candidate.id} : échec, ${outcome.code}.`);
      }
    }

    return { expired, started };
  }
}
