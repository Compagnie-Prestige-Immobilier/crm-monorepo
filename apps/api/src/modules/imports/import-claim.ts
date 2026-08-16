import { randomUUID } from 'node:crypto';
import { ImportStatus, type Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { IMPORT_CLOCK_SKEW_TOLERANCE_MS, IMPORT_LEASE_MS } from './imports.job.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DROIT DE TRAVAILLER SUR UN IMPORT, MATÉRIALISÉ PAR UN OBJET QUE NUL NE
 * PEUT FABRIQUER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le constructeur est PRIVÉ, et la classe n'expose aucune autre fabrique que
 * `take()`, qui exécute la prise atomique en base. Il est donc impossible
 * d'obtenir une instance sans avoir GAGNÉ le bail, et tout ce qui écrit sur le
 * travail en exige une en paramètre : un chemin d'exécution futur qui ne
 * réclamerait rien NE COMPILE PAS.
 *
 * C'est la discipline de `dispatch-claim.ts`, reprise telle quelle, et pour la
 * même raison : une consigne « penser à réclamer avant d'écrire » est une liste
 * que personne n'est obligé de tenir, et que le prochain appelant ignorera.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN BAIL SANS IDENTITÉ DE PROPRIÉTAIRE N'EST PAS UN BAIL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le scénario complet, et il n'a rien d'exotique : un travailleur se fige plus
 * longtemps que le bail (base lente, classeur monstrueux), un second le reprend
 * légitimement à partir de `processedRows`, puis le premier se réveille au
 * milieu d'une tranche. Sans jeton, le premier écrirait ses cinq cents lignes
 * PAR-DESSUS celles du second et ferait reculer `processedRows` : le fichier
 * serait importé deux fois, et le compteur mentirait dans les deux sens.
 *
 * Chaque prise écrit donc un jeton NEUF, et toute écriture le porte dans son
 * `where` (voir `fence`). Celui qui l'a perdu écrit sur ZÉRO ligne, et le
 * constate immédiatement : la transaction de la tranche est ANNULÉE, donc les
 * lignes qu'elle contenait ne sont jamais nées.
 */
export class ImportClaim {
  private constructor(
    readonly jobId: string,
    private readonly token: string,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Réclame le travail, ou rend `null` parce qu'un autre le tient.
   *
   * LES TROIS FORMES DE « PRENABLE », ET PAS UNE DE PLUS :
   *
   * 1. `queued` que PERSONNE n'a jamais revendiqué : le cas ordinaire, celui du
   *    travail que la route vient de créer ;
   * 2. `queued` ou `running` dont le BAIL a expiré : le détenteur est réputé
   *    mort. `queued` en fait partie, et ce n'est pas un détail — un conteneur
   *    qui meurt entre la revendication et l'écriture de `running` laisse une
   *    ligne `queued` déjà revendiquée, que « `queued` est forcément libre »
   *    ferait reprendre à tort, à deux ;
   * 3. `queued` ou `running` revendiqué DANS LE FUTUR : l'horloge a reculé, et
   *    l'âge du bail ne franchira plus jamais sa borne. Voir
   *    `IMPORT_CLOCK_SKEW_TOLERANCE_MS`.
   *
   * Tout le reste est refusé : un travail `succeeded`, `failed`, `expired` ou
   * tenu par un bail vivant n'a rien à recevoir de plus.
   *
   * LA PRISE EST UN `updateMany` CONDITIONNEL, jamais une lecture suivie d'une
   * écriture : de deux instances qui voient la même ligne, une seule voit
   * `count === 1`. C'est PostgreSQL qui arbitre, pas notre ordonnancement.
   *
   * ELLE ÉCRIT AUSSI `running`. La transition fait donc partie de la prise, ce
   * qui referme la fenêtre `queued`-déjà-revendiqué au lieu de la documenter.
   */
  static async take(prisma: PrismaService, jobId: string, now: Date): Promise<ImportClaim | null> {
    const leaseExpired = new Date(now.getTime() - IMPORT_LEASE_MS);
    const clockJumpedBack = new Date(now.getTime() + IMPORT_CLOCK_SKEW_TOLERANCE_MS);
    const inFlight = [ImportStatus.queued, ImportStatus.running];
    const token = randomUUID();

    const claimed = await prisma.importJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: ImportStatus.queued, claimedAt: null },
          { status: { in: inFlight }, claimedAt: { lt: leaseExpired } },
          { status: { in: inFlight }, claimedAt: { gt: clockJumpedBack } },
        ],
      },
      data: { status: ImportStatus.running, claimToken: token, claimedAt: now },
    });

    return claimed.count === 1 ? new ImportClaim(jobId, token, prisma) : null;
  }

  /**
   * Le `where` de TOUTE écriture du travailleur, jeton compris.
   *
   * Ce n'est pas une précaution de style : c'est ce qui rend une écriture
   * TARDIVE inoffensive. Un processus qui reprend la main après avoir perdu son
   * bail écrit sur zéro ligne, au lieu de ramener en arrière l'état qu'un autre
   * vient d'établir.
   *
   * Le statut n'y figure PAS aux côtés du jeton : le travailleur écrit lui-même
   * l'état final (`succeeded`, `failed`) et doit pouvoir le faire par la même
   * porte que ses tranches. Le jeton suffit à l'exclusivité, il est neuf à
   * chaque prise.
   */
  get fence(): Prisma.ImportJobWhereInput {
    return { id: this.jobId, claimToken: this.token };
  }

  /**
   * Écrit sur le travail, SOUS bail, et dit si le bail est toujours à nous.
   *
   * ═══ POURQUOI LA RÉPONSE EST UN BOOLÉEN, ET POURQUOI IL FAUT LE LIRE ═══
   *
   * `false` dit « quelqu'un d'autre tient ce travail ». Continuer à écrire
   * après ça, c'est exactement la double exécution que tout ce fichier existe
   * pour empêcher. L'appelant LÈVE sur `false` depuis l'intérieur de la
   * transaction de tranche, ce qui annule les lignes de la tranche : perdre son
   * bail ne coûte alors rien à personne, pas même une ligne en trop.
   *
   * `claimedAt` est repoussé à chaque écriture : c'est le RENOUVELLEMENT du
   * bail. Sans lui, un import de cinquante mille lignes verrait son bail expirer
   * en cours de route et un second travailleur le reprendrait pendant que le
   * premier travaille encore.
   */
  async write(data: Prisma.ImportJobUpdateManyMutationInput, now: Date): Promise<boolean> {
    const written = await this.prisma.importJob.updateMany({
      where: this.fence,
      data: { ...data, claimedAt: now },
    });
    return written.count === 1;
  }

  /**
   * La même écriture, mais DANS la transaction de la tranche.
   *
   * C'est l'unique façon d'avancer `processedRows` en même temps que les lignes
   * qu'il compte. Écrit hors transaction, le compteur pourrait avancer sans les
   * lignes (le conteneur meurt entre les deux) et la reprise sauterait des
   * lignes jamais écrites.
   */
  async writeIn(
    tx: Prisma.TransactionClient,
    data: Prisma.ImportJobUpdateManyMutationInput,
    now: Date,
  ): Promise<boolean> {
    const written = await tx.importJob.updateMany({
      where: this.fence,
      data: { ...data, claimedAt: now },
    });
    return written.count === 1;
  }
}
