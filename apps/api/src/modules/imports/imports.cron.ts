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
 * LE BALAYAGE, et c'est lui qui fait vivre la fonctionnalité.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX RÔLES, ET LE SECOND EST CELUI QU'ON OUBLIE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. DÉMARRER ce qui attend. La route lance déjà le travail sans l'attendre,
 *    mais ce départ-là meurt avec le processus : un conteneur évincé entre
 *    l'inscription et la première tranche laisserait un `queued` que personne
 *    ne regarde plus ;
 * 2. RANIMER ce qui est mort. L'état vit en base, le processus vit dans le
 *    conteneur. Un redéploiement au milieu d'un import de cinquante mille
 *    lignes laisse une ligne `running` figée à 38 %, et RIEN d'autre que ce
 *    balayage ne la reprendra.
 *
 * `queued` EST AUSSI RANIMABLE, et ce n'est pas une subtilité : la fenêtre
 * entre la revendication et l'écriture de `running` est étroite, mais un
 * conteneur peut y mourir, et la ligne porterait alors un `claimToken` sans
 * travailleur. Voir `isClaimable`, qui tranche, et `ImportClaim.take`, qui
 * l'applique.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE BALAYAGE ÉCHAPPE À `DemoReadOnlyGuard`, DONC IL N'INTERROGE PAS LE MODE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une tâche planifiée n'est pas une requête HTTP : aucune garde ne s'applique.
 * Tout ce que ce chemin écrit porte donc `isDemo: false` EN TOUTES LETTRES, sans
 * jamais consulter l'interrupteur. Même doctrine, et même raison, que
 * `reminders.service.ts` : une ligne fictive écrite hors ensemenceur n'est ni
 * lisible, ni exportable, ni supprimable.
 */

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

    // LECTURE GLOBALE délibérée, et elle ne peut pas être autre chose : ce
    // balayage est une tâche planifiée, hors de toute requête HTTP, donc hors de
    // portée de la garde de démonstration. Y consulter l'interrupteur ferait
    // dépendre la REPRISE d'un import réel de l'état d'une démonstration :
    // allumer le mode figerait tous les travaux en cours, et un import de
    // cinquante mille lignes resterait à mi-chemin sans que rien ne le dise.
    // Aucun travail fictif n'existe par ailleurs — tout ce qui est inscrit ici
    // porte `isDemo: false` en toutes lettres — donc le filtre n'écarterait
    // rien, il ne ferait que casser la reprise.
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
