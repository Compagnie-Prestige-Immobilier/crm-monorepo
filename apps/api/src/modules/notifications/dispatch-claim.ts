import { randomUUID } from 'node:crypto';
import { NotificationStatus, type Prisma } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Durée du BAIL posé sur une notification prise en charge par une expédition.
 *
 * ═══ POURQUOI UN BAIL ET NON UN SIMPLE STATUT ═══
 *
 * `SCHEDULED -> SENDING` est une prise en charge, pas une garantie d'envoi. Un
 * processus tué entre les deux, un conteneur évincé, un déploiement au mauvais
 * moment, et la ligne reste `SENDING` pour toujours : les passages suivants ne
 * regardaient que `SCHEDULED` et ne la revoyaient jamais. La notification
 * n'était ni envoyée, ni en échec, ni visible comme telle.
 *
 * `SENDING` est donc lu comme un bail daté par `updatedAt`, sur le motif que
 * `SyncBatchStore` applique déjà à ses lots : on pose le marqueur AVANT le
 * travail, et un marqueur trop vieux redevient prenable.
 *
 * ═══ POURQUOI QUINZE MINUTES ═══
 *
 * PLANCHER, sous peine de DOUBLE ENVOI. Reprendre une notification dont
 * l'expédition tourne encore fait relire ses livraisons restées `PENDING` et
 * repartir les e-mails que le premier passage venait de confier à Brevo. Le
 * bail doit donc couvrir l'expédition la plus lente qui soit LÉGITIME : un
 * appel Brevo est coupé à `BREVO_REQUEST_TIMEOUT_MS` (15 s), les destinataires
 * sont découpés par lots de `BREVO_MAX_RECIPIENTS_PER_CALL` (99) servis
 * `BREVO_MAX_CONCURRENT_CALLS` (8) à la fois, puis chaque livraison est écrite
 * une par une. Une annonce générale à quelques milliers de comptes se compte
 * ainsi en minutes, pas en heures.
 *
 * Ce n'est PLUS la seule protection, et c'est important : le détenteur
 * renouvelle son bail à chaque vague (voir `renew`), et le jeton de propriété
 * ci-dessous fait taire celui qui l'a perdu. La borne n'a donc plus à être
 * une estimation juste, seulement un ordre de grandeur raisonnable.
 *
 * PLAFOND, sous peine de rappel PÉRIMÉ. Un rappel dit « il vous reste 12 fiches
 * à appeler » : il n'a de sens que dans la journée qu'il décrit. Le balayage ne
 * tique qu'une fois par jour, mais `dispatchDue` tique chaque minute : un
 * rappel abandonné à 8 h repart donc à 8 h 15, très loin de la fin de sa
 * journée. Une heure passerait encore, un jour non.
 *
 * C'EST AUSSI LA CADENCE DE RÉESSAI. Une notification qu'un incident passager
 * laisse `SENDING` garde son bail jusqu'à expiration : le passage suivant la
 * reprend au bout de quinze minutes, et pas à la minute suivante. Relâcher le
 * bail en fin de passage ferait repartir l'envoi à chaque tick, c'est-à-dire
 * marteler un transport déjà en panne soixante fois par heure.
 */
export const SENDING_LEASE_MS = 15 * 60_000;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DROIT D'EXPÉDIER, MATÉRIALISÉ PAR UN OBJET QUE NUL NE PEUT FABRIQUER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ═══ LE DÉFAUT QUI A SURVÉCU À CINQ RELECTURES ═══
 *
 * La prise en charge vivait chez L'APPELANT : `dispatchDue` posait son
 * `updateMany` conditionnel, puis appelait `dispatch()`. Les autres appelants,
 * eux, n'en posaient aucune. `retryStalled` relisait une livraison en file et
 * appelait `dispatch()` DIRECTEMENT, sans rien réclamer : deux ticks de rappel
 * simultanés, ou un réessai croisant `dispatchDue`, envoyaient tous les deux
 * avant que le premier n'ait écrit `SENT`. Cinq rondes de corrections ont porté
 * sur la porte que `dispatchDue` gardait, pendant que celle-ci restait ouverte.
 *
 * Une consigne « penser à réclamer avant d'appeler `dispatch()` » ne répare
 * rien : c'est une liste que personne n'est obligé de tenir, et le prochain
 * appelant l'ignorera comme les précédents. La prise est donc DESCENDUE dans
 * l'expédition elle-même, et le droit d'envoyer a pris la forme d'un TYPE :
 *
 *   · le constructeur est privé, et la classe n'expose aucune autre fabrique
 *     que `take()`, qui exécute la prise atomique en base. Il est donc
 *     impossible d'obtenir une instance sans avoir GAGNÉ le bail ;
 *   · tout ce qui envoie, de près ou de loin, exige une instance en paramètre.
 *     Un futur chemin d'envoi qui ne réclamerait rien ne compile pas.
 *
 * Il n'y a plus de liste d'appelants à tenir, donc plus rien à oublier.
 *
 * ═══ UN BAIL SANS IDENTITÉ DE PROPRIÉTAIRE N'EST PAS UN BAIL ═══
 *
 * Le renouvellement s'écrivait « mettre `SENDING` sur une ligne `SENDING` ».
 * Cela prouve QU'UN processus est vivant, jamais que c'est LE BON. Le scénario
 * complet, et il n'a rien d'exotique : un expéditeur se fige plus longtemps que
 * le bail (base lente, transport en 429 sur chaque vague), un second le reprend
 * légitimement, puis le premier se réveille. Le premier renouvelait alors le
 * bail DU SECOND, ce qui empêchait toute autre reprise, et continuait d'envoyer
 * sur les mêmes livraisons `PENDING`.
 *
 * Chaque prise écrit donc un JETON neuf, et toute écriture d'expédition le
 * porte dans son `where` (voir `fence`). Celui qui a perdu le jeton n'écrit
 * plus rien, et le constate immédiatement : `renew()` rend `false`, et
 * l'expédition s'arrête sur-le-champ, avant la vague suivante.
 *
 * C'est la forme déjà retenue par l'outbox du mobile, où `claimToken` garde
 * chaque mutation d'une ligne en cours d'envoi.
 */
export class DispatchClaim {
  private constructor(
    readonly notificationId: string,
    private readonly token: string,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Réclame l'envoi, ou rend `null` parce qu'un autre le tient.
   *
   * ═══ LES TROIS FORMES DE « PRENABLE », ET PAS UNE DE PLUS ═══
   *
   * 1. `SCHEDULED` dont l'heure est passée : le cas ordinaire. L'échéance est
   *    réévaluée ICI et non chez l'appelant, faute de quoi un appel direct à
   *    `dispatch()` enverrait un envoi programmé pour la semaine prochaine.
   * 2. `SENDING` que PERSONNE n'a jamais réclamée (`dispatchClaim` à `null`) :
   *    c'est l'état d'une notification qu'on vient de composer, et d'elle
   *    seule. Sans cette branche, une composition immédiate devrait attendre
   *    l'expiration d'un bail que personne n'a posé.
   * 3. `SENDING` dont le BAIL a expiré : le détenteur est réputé mort. Le jeton
   *    change, ce qui fait taire l'ancien s'il se réveille.
   *
   * Tout le reste est refusé, et c'est délibéré : une notification `SENT`,
   * `CANCELLED`, ou tenue par un bail vivant n'a rien à recevoir de plus.
   *
   * LA PRISE EST UN `updateMany` CONDITIONNEL, jamais une lecture suivie d'une
   * écriture : de deux instances qui voient la même ligne, une seule voit
   * `count === 1`. C'est PostgreSQL qui arbitre, pas notre ordonnancement.
   */
  static async take(
    prisma: PrismaService,
    notificationId: string,
    now: Date,
  ): Promise<DispatchClaim | null> {
    const leaseExpired = new Date(now.getTime() - SENDING_LEASE_MS);
    const token = randomUUID();

    const claimed = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        OR: [
          { status: NotificationStatus.SCHEDULED, scheduledFor: { lte: now } },
          { status: NotificationStatus.SENDING, dispatchClaim: null },
          { status: NotificationStatus.SENDING, updatedAt: { lt: leaseExpired } },
        ],
      },
      data: { status: NotificationStatus.SENDING, dispatchClaim: token },
    });

    return claimed.count === 1 ? new DispatchClaim(notificationId, token, prisma) : null;
  }

  /**
   * Le `where` de toute écriture d'expédition, jeton compris.
   *
   * Il ne s'agit pas d'une précaution de style : c'est ce qui rend une écriture
   * TARDIVE inoffensive. Un processus qui reprend la main après avoir perdu son
   * bail écrit sur zéro ligne, au lieu de ramener en arrière l'état qu'un autre
   * vient d'établir.
   */
  get fence(): Prisma.NotificationWhereInput {
    return {
      id: this.notificationId,
      status: NotificationStatus.SENDING,
      dispatchClaim: this.token,
    };
  }

  /**
   * Renouvelle le bail, et dit s'il est TOUJOURS À NOUS.
   *
   * ═══ POURQUOI RENOUVELER ═══
   *
   * `dispatchDue` reprend une notification `SENDING` dont `updatedAt` a plus de
   * `SENDING_LEASE_MS`. Or RIEN n'écrivait la notification pendant l'expédition :
   * les verdicts touchent les LIVRAISONS, et la clôture n'écrit qu'à la fin. Une
   * annonce générale plus longue que le bail voyait donc son `updatedAt` figé
   * sur l'instant de la prise, et un second passage la réclamait pendant que le
   * premier envoyait encore. Les deux servaient les mêmes livraisons.
   *
   * ═══ POURQUOI LA RÉPONSE EST UN BOOLÉEN, ET POURQUOI IL FAUT LE LIRE ═══
   *
   * L'échec n'est pas anodin et ne doit surtout pas être avalé : `false` dit
   * « quelqu'un d'autre tient cet envoi ». Continuer à envoyer après ça, c'est
   * exactement le double envoi que tout ce fichier existe pour empêcher.
   * L'expédition s'arrête donc sur `false`, sans écrire quoi que ce soit de
   * plus.
   *
   * La valeur écrite ne change pas, et ce n'est pas le sujet : c'est
   * `@updatedAt` qu'on vient chercher, posé par Prisma sur toute écriture.
   */
  async renew(): Promise<boolean> {
    const renewed = await this.prisma.notification.updateMany({
      where: this.fence,
      data: { status: NotificationStatus.SENDING },
    });
    return renewed.count === 1;
  }
}
