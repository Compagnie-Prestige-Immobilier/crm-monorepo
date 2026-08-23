import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
  type Prisma,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { buildAudienceWhere, dedupe, type AudienceSelector } from './audience.js';
import {
  BREVO_MAX_CONCURRENT_CALLS,
  BREVO_MAX_RECIPIENTS_PER_CALL,
  BREVO_TRANSPORT,
  chunkRecipients,
  type BrevoRecipient,
  type BrevoTransport,
  type BrevoTransportStatus,
} from './brevo.transport.js';
import { renderTemplate } from './template.js';
import {
  audienceEmpty,
  notScheduled,
  notificationNotFound,
  routeInvalid,
  scheduleInPast,
} from './errors.js';
import {
  ROUTE_PATTERN,
  type AudiencePreviewDto,
  type CreateNotificationDto,
  type InboxDto,
  type InboxQueryDto,
  type NotificationDetailDto,
  type NotificationDto,
  type NotificationListDto,
  type NotificationQueryDto,
} from './dto.js';
import { DispatchClaim, SENDING_LEASE_MS } from './dispatch-claim.js';
import { WorkspaceContext } from '../../workspaces/workspace.js';

/** Motif d'une livraison `PENDING` conservée pour un nouvel essai. */
export const DELIVERY_RETRY_ERROR = 'EMAIL_RETRY';

/** Terminal pour les destinataires servis uniquement dans la boîte interne. */
export const DELIVERY_INBOX_ONLY = 'INBOX_ONLY';

/** Motif terminal d'une livraison restée en attente au-delà de la limite. */
export const DELIVERY_ABANDONED = 'EMAIL_ABANDONED';

/** Après 24 heures, les livraisons e-mail en attente passent à `FAILED` sans rejeu. */
export const DISPATCH_DEADLINE_MS = 24 * 60 * 60 * 1_000;

/** Écrit une vague du transport avant de lancer la suivante. */
export const EMAIL_PERSIST_GROUP_SIZE = BREVO_MAX_RECIPIENTS_PER_CALL * BREVO_MAX_CONCURRENT_CALLS;

/**
 * Ce que l'éventail a réellement produit. Sert aux tests et au journal.
 *
 * LES TROIS COMPTEURS PARLENT DE LA SEULE BRANCHE QUI RESTE, l'e-mail. Depuis
 * le retrait de Firebase du mobile, aucun push ne part, et la boîte de
 * réception sert TOUT LE MONDE sans distinction : elle n'a donc rien à compter,
 * elle n'échoue pas.
 *
 *   · `sent`    : livraisons passées à SENT, l'e-mail a été accepté par Brevo ;
 *   · `failed`  : livraisons passées à FAILED sur un refus définitif ;
 *   · `pending` : livraisons LAISSÉES EN FILE, soit parce que le destinataire
 *     n'est pas servi par e-mail (il lira dans l'application), soit parce que
 *     l'échec est passager et qu'un prochain passage doit réessayer.
 *
 * `pending` n'est donc pas un synonyme d'échec, et c'est délibéré : sur une
 * annonce générale, la majorité des destinataires y tombe légitimement.
 */
export interface DispatchSummary {
  /**
   * L'expédition a-t-elle seulement EU LIEU ?
   *
   * `false` veut dire « un autre processus tient cet envoi, ou il n'y a rien à
   * tenir » : la notification est déjà partie, annulée, programmée plus tard,
   * ou aux mains d'un expéditeur vivant. Tous les compteurs valent alors zéro
   * parce que RIEN n'a été tenté, ce qui n'est pas la même chose que « tenté
   * sans succès ». Les deux se confondraient sans ce drapeau.
   */
  readonly claimed: boolean;
  readonly sent: number;
  readonly failed: number;
  readonly pending: number;
  /**
   * Adresses acceptées par Brevo, comptées sur les ISSUES du transport.
   *
   * PAS un synonyme de `sent`, qui compte des LIGNES DE LIVRAISON. Les deux
   * divergent sur l'ISSUE MUETTE : un transport qui ne dit rien d'une adresse
   * qu'il a reçue la fait compter `sent` (la ligne passe à SENT, voir le
   * verdict par défaut plus bas) sans être comptée `emailed`, qui n'additionne
   * que des issues explicitement acceptées. Le chiffre du journal est
   * `emailed`, celui de la base est `sent`.
   */
  readonly emailed: number;
  /** `null` quand rien n'a été tenté : voir `claimed`. */
  readonly emailStatus: BrevoTransportStatus | null;
}

/** Résumé d'un passage qui n'a RIEN fait, faute de tenir l'envoi. */
const NOT_CLAIMED: DispatchSummary = {
  claimed: false,
  sent: 0,
  failed: 0,
  pending: 0,
  emailed: 0,
  emailStatus: null,
};

/** Sort réservé à UNE ligne de livraison par la branche e-mail. */
type DeliveryVerdict =
  | { readonly kind: 'sent' }
  | { readonly kind: 'retry'; readonly error: string }
  | { readonly kind: 'failed'; readonly error: string };

/** Ce que la branche e-mail a produit. Interne à `dispatchMany()`. */
interface EmailLegResult {
  /** Livraisons dont le transport a EXPLICITEMENT accepté l'adresse. */
  readonly accepted: ReadonlySet<string>;
  readonly status: BrevoTransportStatus;
  /**
   * Verdict par LIVRAISON, pour les seules lignes réellement servies. Une
   * livraison absente de cette table n'a pas reçu de verdict : soit elle n'a pas
   * d'e-mail à recevoir, soit le transport n'a pas pu être sollicité.
   */
  readonly verdicts: ReadonlyMap<string, DeliveryVerdict>;
  /**
   * Qui est SERVI PAR E-MAIL, indépendamment de l'état du transport.
   *
   * C'est ce qui distingue « cette personne ne recevra jamais d'e-mail »
   * (téléconseiller, non, ou pas d'adresse) de « personne n'a pu être servi
   * parce qu'aucune clé n'est branchée ». Les deux produisaient une ligne
   * `PENDING` sans verdict, et étaient donc confondues : sans clé, TOUT le
   * monde était estampillé « boîte de réception seule » puis la notification se
   * refermait sur SENT, ce qui enterrait définitivement des e-mails jamais
   * partis.
   *
   * `null` veut dire « on n'a pas pu savoir » : la lecture des comptes elle-
   * même a échoué. Dans ce cas on n'estampille PERSONNE, parce qu'affirmer
   * qu'un destinataire ne sera jamais servi par e-mail est une décision qu'on
   * ne prend pas sur une panne de base.
   */
  readonly emailable: ReadonlySet<string> | null;
}

interface DeliveryRowSeed {
  readonly userId: string;
}

/** Une livraison encore en file, avec de quoi la servir puis l'écrire. */
interface PendingDelivery {
  readonly id: string;
  readonly userId: string;
  readonly notificationId: string;
  readonly error: string | null;
}

interface EmailRecipient extends PendingDelivery {
  readonly email: string;
  readonly fullName: string;
}

/** Un appel de transport : un contenu, ses destinataires. */
interface EmailJob {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly rows: readonly EmailRecipient[];
}

/**
 * UNE LIVRAISON QUI ATTEND ENCORE QUELQUE CHOSE.
 *
 * Écrit une seule fois parce que deux endroits en dépendent et qu'ils doivent
 * dire EXACTEMENT la même chose : la clôture d'un envoi (qui ne se referme que
 * s'il n'en reste aucune) et l'abandon (qui ne tranche que celles-là). Deux
 * copies auraient divergé, et la divergence se serait vue soit par un envoi
 * refermé sur des e-mails jamais partis, soit par un envoi qui ne se referme
 * jamais.
 *
 * `PENDING` sans `INBOX_ONLY` : la ligne marquée `INBOX_ONLY` a beau être
 * `PENDING`, elle est TERMINALE, son destinataire lit dans l'application.
 */
const OUTSTANDING_DELIVERY: Prisma.NotificationDeliveryWhereInput = {
  status: NotificationDeliveryStatus.PENDING,
  OR: [{ error: null }, { error: { not: DELIVERY_INBOX_ONLY } }],
};

/** Sélection minimale d'un envoi, avec de quoi construire le DTO. */
const NOTIFICATION_SELECT = {
  id: true,
  title: true,
  body: true,
  category: true,
  route: true,
  audience: true,
  audienceRole: true,
  audienceDepartementId: true,
  audienceUserIds: true,
  status: true,
  scheduledFor: true,
  sentAt: true,
  cancelledAt: true,
  transportStatus: true,
  createdAt: true,
  createdBy: { select: { fullName: true } },
} satisfies Prisma.NotificationSelect;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>;

/** Le détenteur du bail se lit avec l'envoi, sans requête de plus. */
const DISPATCH_SELECT = {
  ...NOTIFICATION_SELECT,
  dispatchClaim: true,
} satisfies Prisma.NotificationSelect;

type DispatchRow = Prisma.NotificationGetPayload<{ select: typeof DISPATCH_SELECT }>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceContext,
    @Inject(BREVO_TRANSPORT) private readonly email: BrevoTransport,
  ) {}

  // Composition

  /**
   * Compose un envoi, immédiat ou programmé.
   *
   * L'ORDRE COMPTE. Le public est résolu et les lignes de livraison écrites
   * AVANT toute tentative de remise, et dans la même transaction que l'envoi.
   * Le contraire, envoyer d'abord, tracer ensuite, laisse un trou : un
   * redémarrage entre les deux produit des e-mails partis et une base qui les
   * ignore, donc une question « qui a reçu ? » sans réponse.
   */
  async create(user: AuthenticatedUser, body: CreateNotificationDto): Promise<NotificationDto> {
    if (body.route !== undefined && !ROUTE_PATTERN.test(body.route)) throw routeInvalid();

    const now = new Date();
    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null;
    if (scheduledFor && scheduledFor.getTime() <= now.getTime()) throw scheduleInPast();

    const recipients = await this.resolveRecipients({
      audience: body.audience,
      audienceRole: body.audienceRole ?? null,
      audienceDepartementId: body.audienceDepartementId ?? null,
      audienceUserIds: body.audienceUserIds ?? null,
    });
    if (!recipients.length) throw audienceEmpty();

    const created = await this.prisma.notification.create({
      data: {
        title: body.title,
        body: body.body,
        category: body.category ?? NotificationCategory.ANNONCE,
        route: body.route ?? null,
        audience: body.audience,
        audienceRole: body.audienceRole ?? null,
        audienceDepartementId: body.audienceDepartementId ?? null,
        audienceUserIds:
          body.audience === NotificationAudience.USERS ? dedupe(body.audienceUserIds ?? []) : [],
        status: scheduledFor ? NotificationStatus.SCHEDULED : NotificationStatus.SENDING,
        scheduledFor,
        templateId: body.templateId ?? null,
        createdById: user.id,
        deliveries: {
          createMany: {
            data: recipients.map(
              (recipient): Prisma.NotificationDeliveryCreateManyNotificationInput => ({
                userId: recipient.userId,
                status: NotificationDeliveryStatus.PENDING,
              }),
            ),
          },
        },
      },
      select: NOTIFICATION_SELECT,
    });

    if (!scheduledFor) await this.dispatch(created.id);

    return this.get(created.id).then((detail) => detail.notification);
  }

  /**
   * Résout le public en identifiants de comptes.
   *
   * Lit uniquement les identifiants : charger les fiches complètes de 400
   * commerciaux pour n'en garder que la clé primaire est un gaspillage qui se
   * remarque à la première campagne générale.
   */
  private async resolveRecipients(selector: AudienceSelector): Promise<DeliveryRowSeed[]> {
    const rows = await this.prisma.user.findMany({
      // Le filtre de demonstration s'ajoute a l'audience choisie, il ne la
      // remplace pas : une campagne « tous les commerciaux » ne doit pas
      // notifier des comptes fictifs quand le mode est eteint.
      where: { ...buildAudienceWhere(selector) },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => ({ userId: row.id }));
  }

  /**
   * Compteur annoncé au compositeur AVANT confirmation.
   *
   * Il n'y a plus de « joignable » distinct de « visé » : la boîte de réception
   * sert tout le monde, sans appareil à enregistrer et sans transport à
   * configurer. Le seul chiffre honnête est donc le nombre de comptes visés.
   */
  async previewAudience(selector: AudienceSelector): Promise<AudiencePreviewDto> {
    const recipients = await this.resolveRecipients(selector);
    return { recipientCount: recipients.length };
  }

  // Éventail

  /**
   * Sert une notification à ses destinataires, puis écrit ce qui s'est passé.
   *
   * DEUX CANAUX, UN SEUL SORTANT. Tout destinataire lit la notification dans sa
   * boîte de réception dès qu'il ouvre l'application : c'est la ligne de
   * livraison elle-même qui la lui rend visible, il n'y a rien à « remettre ».
   * Le seul canal qui part vers l'extérieur est l'e-mail des téléconseillers.
   *
   * TROIS PROPRIÉTÉS, toutes testées.
   *
   * 1. UN REFUS N'EMPORTE PAS LE LOT. Les issues sont traitées adresse par
   *    adresse ; une adresse refusée marque SA ligne et laisse les autres
   *    passer.
   * 2. UN ÉCHEC PASSAGER RESTE EN FILE. 429, 5xx, socket coupée, délai dépassé :
   *    la ligne reste `PENDING` avec le marqueur de réessai, et le passage
   *    suivant la reprendra. L'écrire `FAILED` enterrerait définitivement un
   *    envoi que la seule attente aurait fait passer.
   * 3. LE NON-DESTINATAIRE D'E-MAIL N'EST PAS UN ÉCHEC. Un agent du pôle banque
   *    n'est pas servi par e-mail, par choix ; sa ligne reste en file et il lit
   *    dans l'application.
   *
   * RIEN ICI NE LÈVE À CAUSE DE L'E-MAIL : une panne Brevo laisse les lignes en
   * file, elle ne fait pas échouer l'appel.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * LA PRISE EN CHARGE EST FAITE ICI, ET NON CHEZ L'APPELANT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Elle vivait chez `dispatchDue`, qui posait son `updateMany` conditionnel
   * avant d'appeler cette méthode. Les trois autres appelants n'en posaient
   * aucune : `create()`, `emit()` et surtout `retryStalled()`, qui relit une
   * livraison en file et expédie sans rien réclamer. Deux ticks de rappel
   * simultanés, ou un réessai croisant `dispatchDue`, envoyaient donc tous les
   * deux. Cinq rondes de corrections ont porté sur la porte gardée pendant que
   * celle-là restait ouverte.
   *
   * Réclamer ICI supprime la question : il n'existe aucun moyen d'expédier sans
   * passer par cette méthode, donc aucun moyen d'envoyer sans détenir le bail,
   * y compris pour un appelant qui n'est pas encore écrit. Voir `DispatchClaim`
   * pour ce qui rend la chose structurelle plutôt que disciplinaire.
   *
   * `claimed: false` n'est PAS une erreur : c'est le cas ordinaire d'une
   * notification déjà partie, annulée, programmée plus tard, ou tenue par un
   * expéditeur vivant.
   */
  async dispatch(notificationId: string, now: Date = new Date()): Promise<DispatchSummary> {
    const summary = (await this.dispatchMany([notificationId], now)).get(notificationId);
    if (!summary) throw notificationNotFound();
    return summary;
  }

  /**
   * Le MÊME chemin, pour une vague entière.
   *
   * Une notification par téléconseiller multipliait les allers-retours par le
   * nombre de personnes : neuf requêtes et un appel Brevo chacun, soit quelques
   * milliers de requêtes pour un seul tick de rappels. Tout ce qui suit est donc
   * écrit en nombre CONSTANT de requêtes, quelle que soit la taille de la vague,
   * et le transport reçoit des destinataires groupés par contenu rendu.
   *
   * Rien n'est relâché de ce que `dispatch()` garantissait : le bail est pris en
   * une écriture pour toute la vague, mais la relecture dit envoi par envoi
   * lequel porte réellement le jeton, et chaque écriture suivante le reporte
   * dans son `where`. Un envoi absent de la réponse n'existe pas ; un envoi
   * présent avec `claimed: false` n'a rien tenté.
   */
  async dispatchMany(
    notificationIds: readonly string[],
    now: Date = new Date(),
  ): Promise<Map<string, DispatchSummary>> {
    const summaries = new Map<string, DispatchSummary>();
    if (!notificationIds.length) return summaries;

    const attempt = await DispatchClaim.take(this.prisma, notificationIds, now);

    const rows = await this.prisma.notification.findMany({
      where: { id: { in: [...notificationIds] } },
      select: DISPATCH_SELECT,
    });

    const held: DispatchRow[] = [];
    for (const row of rows) {
      if (row.status === NotificationStatus.SENDING && row.dispatchClaim === attempt.token) {
        held.push(row);
        continue;
      }
      summaries.set(row.id, NOT_CLAIMED);
      this.logger.debug(`Notification ${row.id} : envoi non réclamé (état ${row.status}).`);
    }
    if (!held.length) return summaries;

    // LECTURE GLOBALE délibérée : l'expédition doit servir TOUTES les
    // livraisons des notifications qu'on lui a désignées. Une livraison écartée
    // ici resterait `PENDING` pour toujours, sans qu'aucun passage ne la
    // reprenne jamais, et le compteur annoncé au compositeur mentirait. La
    // nature de la ligne est déjà tranchée en amont : les livraisons portent
    // celle de leur notification, posée dans la même transaction que sa
    // création.
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: {
        notificationId: { in: held.map((row) => row.id) },
        status: NotificationDeliveryStatus.PENDING,
      },
      select: { id: true, userId: true, notificationId: true, error: true },
    });

    // L'ABANDON SE DÉCIDE AVANT D'ENVOYER, jamais après : passé le délai, il
    // n'y a plus de tentative à faire, et en faire une de plus serait
    // exactement la boucle sans fin qu'on ferme ici.
    const expired = held.filter((row) => this.pastDeadline(row, now));
    if (expired.length) {
      const doomed = new Set(expired.map((row) => row.id));
      await this.abandon(
        attempt,
        expired,
        deliveries.filter((delivery) => doomed.has(delivery.notificationId)),
        now,
        summaries,
      );
    }

    const live = held.filter((row) => !summaries.has(row.id));
    if (!live.length) return summaries;

    const claim = attempt.holding(live.map((row) => row.id));
    const byId = new Map(live.map((row) => [row.id, row]));
    const served = deliveries.filter((delivery) => byId.has(delivery.notificationId));

    const email = await this.sendByEmail(claim, byId, served);

    const counters = new Map(live.map((row) => [row.id, { sent: 0, failed: 0, pending: 0 }]));
    const emailed = new Map(live.map((row) => [row.id, 0]));
    const inboxOnly: string[] = [];

    for (const delivery of served) {
      const bucket = counters.get(delivery.notificationId);
      if (!bucket) continue;
      if (email.accepted.has(delivery.id)) {
        emailed.set(delivery.notificationId, (emailed.get(delivery.notificationId) ?? 0) + 1);
      }

      const verdict = email.verdicts.get(delivery.id);
      if (verdict === undefined) {
        // Aucun verdict. `PENDING` et non `FAILED` : rien n'a échoué. Reste à
        // dire POURQUOI, et c'est `emailable` qui tranche, pas le transport.
        bucket.pending += 1;
        if (email.emailable !== null && !email.emailable.has(delivery.userId)) {
          inboxOnly.push(delivery.id);
        }
        continue;
      }

      // Le sort des livraisons SERVIES est déjà écrit : `sendByEmail` l'a posé
      // vague par vague, au fur et à mesure des acceptations. Il ne reste ici
      // qu'à compter.
      if (verdict.kind === 'sent') {
        bucket.sent += 1;
        continue;
      }
      if (verdict.kind === 'retry') {
        bucket.pending += 1;
        continue;
      }
      bucket.failed += 1;
    }

    // LE MARQUEUR DÉCRIT LE DESTINATAIRE, il ne dépend donc plus de l'état du
    // transport : `emailable` vient de la base, pas de la clé Brevo. Il est
    // écrit AVANT `settleNotifications`, qui le relit pour savoir quelles
    // livraisons attendent encore quelque chose.
    if (inboxOnly.length) {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: { in: inboxOnly } },
        data: { error: DELIVERY_INBOX_ONLY },
      });
    }

    let outstanding = 0;
    for (const bucket of counters.values()) outstanding += bucket.pending;
    await this.settleNotifications(claim, email.status, outstanding, now);

    for (const row of live) {
      const bucket = counters.get(row.id) ?? { sent: 0, failed: 0, pending: 0 };
      summaries.set(row.id, {
        claimed: true,
        ...bucket,
        emailed: emailed.get(row.id) ?? 0,
        emailStatus: email.status,
      });
    }
    return summaries;
  }

  /** L'envoi a-t-il dépassé le délai que la plateforme s'accorde ? */
  private pastDeadline(notification: NotificationRow, now: Date): boolean {
    // `scheduledFor` d'abord : un envoi programmé pour dans trois jours n'est
    // pas en retard parce qu'il a été COMPOSÉ il y a trois jours.
    const origin = notification.scheduledFor ?? notification.createdAt;
    return now.getTime() - origin.getTime() > DISPATCH_DEADLINE_MS;
  }

  /**
   * Arrête définitivement un envoi que le transport n'a jamais pu servir.
   *
   * Voir `DISPATCH_DEADLINE_MS` pour la borne et pour ce qui la justifie. Les
   * livraisons DÉJÀ tranchées ne sont pas touchées : le `where` ne prend que les
   * lignes encore en file, et celles qui portent `INBOX_ONLY` n'attendent rien.
   *
   * Le journal est le SEUL endroit où un exploitant apprend qu'il vient de
   * perdre des destinataires sans ouvrir la base ; c'est la seule ligne de
   * niveau ERREUR de tout le module, et elle porte de quoi agir : l'envoi, le
   * nombre de personnes, et l'état du transport qui l'a causé.
   */
  private async abandon(
    attempt: DispatchClaim,
    notifications: readonly DispatchRow[],
    deliveries: readonly PendingDelivery[],
    now: Date,
    summaries: Map<string, DispatchSummary>,
  ): Promise<void> {
    // Les lignes marquées `INBOX_ONLY` n'attendent rien : elles ne comptent pas
    // dans ce qu'on vient de perdre, et le `where` les écarte de toute façon.
    const doomed = deliveries.filter((delivery) => delivery.error !== DELIVERY_INBOX_ONLY);

    if (doomed.length) {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: { in: doomed.map((delivery) => delivery.id) }, ...OUTSTANDING_DELIVERY },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          error: DELIVERY_ABANDONED,
          failedAt: now,
        },
      });
    }

    const byNotification = new Map<string, number>();
    for (const delivery of doomed) {
      byNotification.set(
        delivery.notificationId,
        (byNotification.get(delivery.notificationId) ?? 0) + 1,
      );
    }

    // Le journal est le SEUL endroit où un exploitant apprend qu'il vient de
    // perdre des destinataires sans ouvrir la base ; c'est la seule ligne de
    // niveau ERREUR de tout le module, et elle porte de quoi agir : l'envoi, le
    // nombre de personnes, et l'état du transport qui l'a causé.
    const byTransport = new Map<string | null, string[]>();
    for (const notification of notifications) {
      const failed = byNotification.get(notification.id) ?? 0;
      this.logger.error(
        `Notification ${notification.id} « ${notification.title} » : abandonnée après ` +
          `${String(Math.round(DISPATCH_DEADLINE_MS / 3_600_000))} h. ` +
          `${String(failed)} destinataire(s) n'ont jamais reçu leur e-mail ` +
          `(transport : ${notification.transportStatus ?? 'inconnu'}).`,
      );
      summaries.set(notification.id, {
        claimed: true,
        sent: 0,
        failed,
        pending: 0,
        emailed: 0,
        emailStatus: null,
      });
      const bucket = byTransport.get(notification.transportStatus);
      if (bucket) bucket.push(notification.id);
      else byTransport.set(notification.transportStatus, [notification.id]);
    }

    for (const [transportStatus, ids] of byTransport) {
      await this.settleNotifications(attempt.holding(ids), transportStatus, 0, now);
    }
  }

  private async sendByEmail(
    claim: DispatchClaim,
    notifications: ReadonlyMap<string, NotificationRow>,
    deliveries: readonly PendingDelivery[],
  ): Promise<EmailLegResult> {
    const empty = new Map<string, DeliveryVerdict>();
    const nothing = new Set<string>();
    if (!deliveries.length)
      return { accepted: nothing, status: 'SENT', verdicts: empty, emailable: new Set<string>() };
    if (this.workspace.current() === 'demo')
      return { accepted: nothing, status: 'SENT', verdicts: empty, emailable: new Set<string>() };

    /**
     * Population du rattrapage, VALABLE DÈS LA PREMIÈRE LIGNE DU `try`.
     *
     * Elle vaut d'abord toutes les livraisons visées, faute de savoir qui est
     * réellement servi par e-mail : cette réponse-là est précisément ce que la
     * lecture des comptes devait apporter. Trop large, donc, et c'est
     * délibéré : une ligne remise en file à tort porte un marqueur de réessai
     * qu'un passage ultérieur corrige de lui-même (le destinataire non servi
     * retombe dans la branche « rien à envoyer »), alors qu'une ligne oubliée
     * ne revient JAMAIS. Une fois les comptes lus, elle se resserre sur les
     * seules livraisons réellement visées.
     */
    let candidates: readonly PendingDelivery[] = deliveries;

    /**
     * Qui est servi par e-mail. `null` tant que la base n'a pas répondu.
     *
     * Voir `EmailLegResult.emailable` : tant qu'il vaut `null`, `dispatchMany()`
     * n'estampille personne « boîte de réception seule ».
     */
    let emailable: Set<string> | null = null;

    /** Verdicts DÉJÀ ÉCRITS en base, vague par vague. */
    const verdicts = new Map<string, DeliveryVerdict>();
    const accepted = new Set<string>();
    let refused = false;

    try {
      // ═══ LA NATURE DU DESTINATAIRE SE LIT AVANT L'ÉTAT DU TRANSPORT ═══
      //
      // Cette lecture précédait autrefois le contrôle `isConfigured()`, qui
      // rendait la main sans elle. Sans clé, on ignorait donc QUI aurait dû
      // recevoir un e-mail, et `dispatch()` estampillait tout le monde « boîte
      // de réception seule », téléconseillers compris, avant de refermer
      // l'envoi sur SENT. Le jour où une clé était branchée, ces e-mails-là
      // n'existaient plus pour personne.
      //
      // Le rôle et l'adresse ne dépendent pas de la clé : on les lit d'abord,
      // et une lecture par identifiants est de toute façon négligeable devant
      // ce qu'elle évite.
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: [...new Set(deliveries.map((delivery) => delivery.userId))] },
          role: Role.COMMERCIAL,
        },
        select: { id: true, email: true, fullName: true },
      });

      const addressed = new Map(
        users
          .filter((user) => user.email.trim().length > 0)
          .map((user) => [user.id, { email: user.email.trim(), fullName: user.fullName }]),
      );
      emailable = new Set(addressed.keys());

      const targeted: EmailRecipient[] = [];
      for (const delivery of deliveries) {
        const account = addressed.get(delivery.userId);
        if (account) targeted.push({ ...delivery, ...account });
      }
      // Les comptes sont connus : le rattrapage se resserre sur eux, et la
      // nature de chaque destinataire est désormais établie.
      candidates = targeted;

      // SANS CLÉ, RIEN N'EST JUGÉ, ET RIEN N'EST ENTERRÉ. Les téléconseillers
      // restent en file sans marqueur, donc `settleNotifications` retient la
      // notification en SENDING et le bail la fera reprendre. Les autres
      // destinataires, eux, sont bel et bien tranchés : `emailable` le dit.
      if (!this.email.isConfigured())
        return { accepted, status: 'NOT_CONFIGURED', verdicts: empty, emailable };

      if (!targeted.length) return { accepted, status: 'SENT', verdicts: empty, emailable };

      // UNE VAGUE, PUIS SON ÉCRITURE, PUIS LA SUIVANTE. Voir
      // `EMAIL_PERSIST_GROUP_SIZE` : ce qui a été accepté par Brevo est acquis
      // en base avant qu'on n'expose la suite, faute de quoi une reprise
      // renverrait le message à des gens qui l'ont déjà reçu.
      for (const wave of emailWaves(targeted, notifications)) {
        const result = await this.email.send(
          wave.map((job) => ({
            recipients: job.rows.map((row): BrevoRecipient => ({
              email: row.email,
              name: row.fullName,
            })),
            subject: job.subject,
            htmlContent: job.html,
            textContent: job.text,
          })),
        );

        const waveVerdicts = new Map<string, DeliveryVerdict>();

        // ═══ `TRANSPORT_ERROR` NE DIT PAS « PASSAGER » ═══
        //
        // Le transport l'annonce dès qu'aucun lot n'est passé, QUELLE QUE SOIT
        // la nature des refus. Or un public de moins de cent adresses tient
        // dans un seul lot : une clé invalide (401), un expéditeur non vérifié
        // (403) ou un corps refusé (400) y produisent donc toujours
        // `TRANSPORT_ERROR`, alors que ce sont des refus DÉFINITIFS. Le
        // traduire en bloc par « tout le monde réessaie » épinglait la
        // notification en SENDING et la faisait repartir tous les quarts
        // d'heure, indéfiniment, pour un état que l'attente ne change pas.
        //
        // La nature de l'échec se lit donc sur l'ISSUE, ici comme sur le
        // chemin nominal. L'état global ne décide plus que du sort des
        // adresses dont le transport n'a rien dit.
        const refusedWave = result.status === 'TRANSPORT_ERROR';
        if (refusedWave) {
          refused = true;
          this.logger.warn(
            `Expédition : e-mail non parti (${result.detail ?? 'sans détail'}). Sort décidé par issue.`,
          );
        }

        const byEmail = new Map(result.outcomes.map((outcome) => [outcome.email, outcome]));
        for (const job of wave) {
          for (const row of job.rows) {
            const outcome = byEmail.get(row.email);
            if (outcome === undefined) {
              // ISSUE MUETTE. Sur un envoi qui a abouti, un transport qui ne dit
              // rien d'une adresse qu'il a reçue l'a prise en charge, et le
              // doute ne justifie ni un échec ni un réessai. Sur un envoi que le
              // transport déclare non parti, le même silence dit l'inverse : la
              // ligne reste en file.
              waveVerdicts.set(
                row.id,
                refusedWave ? { kind: 'retry', error: DELIVERY_RETRY_ERROR } : { kind: 'sent' },
              );
              continue;
            }
            if (outcome.ok) {
              accepted.add(row.id);
              waveVerdicts.set(row.id, { kind: 'sent' });
              continue;
            }
            const error = outcome.errorCode ?? 'UNKNOWN';
            // `permanent` et non `!== 'transient'` : une issue en échec sans
            // nature annoncée doit repartir en file. Classer un passager en
            // définitif est la faute coûteuse, elle enterre un envoi que la
            // seule attente aurait fait passer.
            waveVerdicts.set(
              row.id,
              outcome.kind === 'permanent'
                ? { kind: 'failed', error }
                : { kind: 'retry', error: DELIVERY_RETRY_ERROR },
            );
          }
        }

        await this.persistVerdicts(claim, waveVerdicts);
        for (const [deliveryId, verdict] of waveVerdicts) verdicts.set(deliveryId, verdict);

        // ═══ LE BAIL EST RENOUVELÉ ENTRE DEUX VAGUES, ET SA RÉPONSE EST LUE ═══
        //
        // Sans renouvellement, une expédition plus longue que le bail était
        // reprise par un second passage pendant que le premier envoyait encore.
        //
        // Et sans LIRE la réponse, le renouvellement lui-même devenait l'arme
        // du crime : un expéditeur figé au-delà du bail, repris entre-temps,
        // renouvelait le bail DU REPRENEUR et poursuivait ses vagues. On
        // s'arrête donc ici, tout de suite, avant d'exposer la vague suivante.
        // Les livraisons déjà servies sont écrites, les autres restent en file
        // et appartiennent désormais au nouveau détenteur.
        if (!(await claim.renew())) {
          this.logger.warn(
            `Bail perdu en cours d'expédition, les vagues restantes sont ` +
              `abandonnées au détenteur suivant.`,
          );
          break;
        }
      }

      if (accepted.size) {
        this.logger.log(`${String(accepted.size)} e-mail(s) remis à Brevo.`);
      }

      // `TRANSPORT_ERROR` ne se dit que si RIEN n'est passé. Une vague refusée
      // derrière une vague acceptée décrit une panne partielle : l'annoncer
      // comme une panne de transport ferait croire que la clé est en cause,
      // alors que des e-mails sont bel et bien partis.
      return {
        accepted,
        status: refused && accepted.size === 0 ? 'TRANSPORT_ERROR' : 'SENT',
        verdicts,
        emailable,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Branche e-mail interrompue (${detail}). Les livraisons restent en file.`);

      // SEULS LES DESTINATAIRES PAS ENCORE TRANCHÉS repartent en file. Remettre
      // tout le monde à réessayer réécrirait en `PENDING` des lignes déjà
      // passées à `SENT` par un groupe précédent, et le passage suivant leur
      // renverrait l'e-mail qu'elles ont reçu.
      //
      // `candidates` et non `targeted` : voir sa déclaration. Avant la lecture
      // des comptes, `targeted` est vide, et filtrer une liste vide ne rend
      // rien à réessayer, donc rien qui retienne la notification.
      const unresolved = retryAll(candidates.filter((row) => !verdicts.has(row.id)));
      // L'écriture peut échouer à son tour, c'est même le cas typique quand
      // c'est la base qui a lâché. Sans marqueur, les lignes restent `PENDING`
      // et la notification reste prenable : la reprise est assurée par le bail,
      // pas par ce marqueur.
      await this.persistVerdicts(claim, unresolved).catch(() => undefined);
      for (const [deliveryId, verdict] of unresolved) verdicts.set(deliveryId, verdict);

      // MÊME RÈGLE QUE LE CHEMIN NOMINAL, et pour la même raison : annoncer
      // une panne de transport alors que des e-mails sont partis ferait
      // chercher du côté de la clé. L'interruption reste visible, dans le
      // journal et dans les lignes laissées en file.
      return {
        accepted,
        status: accepted.size === 0 ? 'TRANSPORT_ERROR' : 'SENT',
        verdicts,
        emailable,
      };
    }
  }

  /**
   * Écrit le sort d'un GROUPE de livraisons, par verdict et non ligne à ligne.
   *
   * `status: PENDING` figure dans chaque `where` : une ligne qu'un autre
   * passage a déjà fait avancer (`SENT`, ou `READ` parce que la personne a
   * ouvert l'application entre-temps) ne doit pas être ramenée en arrière par
   * une écriture tardive.
   *
   * LE BAIL EST EXIGÉ EN PARAMÈTRE, et c'est lui qui borne la population :
   * c'est ce qui rend impossible d'écrire des verdicts sans avoir réclamé les
   * envois. Le prédicat de statut suffit à rendre une écriture tardive
   * inoffensive (un `SENT` déjà posé n'est pas défait), mais rien n'empêchait un
   * futur chemin d'écrire des verdicts pour des e-mails que personne n'avait le
   * droit d'envoyer.
   */
  private async persistVerdicts(
    claim: DispatchClaim,
    verdicts: ReadonlyMap<string, DeliveryVerdict>,
  ): Promise<void> {
    if (!verdicts.size) return;
    const notificationId = { in: [...claim.notificationIds] };

    const now = new Date();
    const sent: string[] = [];
    const retry = new Map<string, string[]>();
    const failed = new Map<string, string[]>();

    for (const [deliveryId, verdict] of verdicts) {
      if (verdict.kind === 'sent') {
        sent.push(deliveryId);
        continue;
      }
      const bucket = verdict.kind === 'retry' ? retry : failed;
      const ids = bucket.get(verdict.error);
      if (ids) ids.push(deliveryId);
      else bucket.set(verdict.error, [deliveryId]);
    }

    // L'ACCEPTATION D'ABORD, avant les réessais et les échecs : c'est la seule
    // des trois écritures qu'une interruption ne pardonne pas, puisque son
    // absence fait renvoyer un e-mail déjà remis.
    if (sent.length) {
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          id: { in: sent },
          status: NotificationDeliveryStatus.PENDING,
        },
        data: { status: NotificationDeliveryStatus.SENT, error: null, sentAt: now },
      });
    }

    for (const [error, deliveryIds] of retry) {
      // Le statut RESTE `PENDING` : c'est ce qui rend la ligne éligible au
      // prochain passage. Seul le marqueur d'erreur change, pour distinguer
      // « à réessayer » de « rien à envoyer ».
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          id: { in: deliveryIds },
          status: NotificationDeliveryStatus.PENDING,
        },
        data: { error },
      });
    }

    for (const [error, deliveryIds] of failed) {
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          id: { in: deliveryIds },
          status: NotificationDeliveryStatus.PENDING,
        },
        data: { status: NotificationDeliveryStatus.FAILED, error, failedAt: now },
      });
    }
  }

  /**
   * Arrête l'envoi sur l'état que ses LIVRAISONS justifient.
   *
   * ═══ POURQUOI CE N'EST PAS TOUJOURS `SENT` ═══
   *
   * Marquer `SENT` sans condition était un mensonge silencieux, et le pire de
   * ce produit. Un lot Brevo refusé passagèrement laisse ses livraisons
   * `PENDING` avec le marqueur de réessai ; la notification, elle, était écrite
   * `SENT`. Or `dispatchDue` ne reprend que les `SCHEDULED` échues et les
   * `SENDING` dont le bail a expiré : plus rien, jamais, ne revenait sur ces
   * livraisons. Un téléconseiller ne recevait pas son e-mail, et la plateforme
   * affirmait le lui avoir envoyé.
   *
   * `retryStalled` NE PEUT PAS servir de rattrapage ici, c'est vérifié et non
   * supposé : il n'est appelé que depuis `emit()`, sur violation de contrainte
   * unique, donc uniquement pour des rappels de la période COURANTE, et il
   * cherche par `reminderKey`, que les envois composés à la main laissent à
   * `null`. Toute la population de `dispatch()` lui est structurellement
   * invisible.
   *
   * La notification RESTE donc `SENDING` tant qu'une livraison est à
   * réessayer. C'est le mécanisme de reprise qui existe DÉJÀ, celui du bail :
   * l'écriture renouvelle `updatedAt`, et le passage qui trouve le bail expiré
   * reprend la notification et rejoue l'envoi. Il ne rejoue que les livraisons
   * restées `PENDING`, les acceptées ayant été écrites au fil de l'eau.
   *
   * Un état « partiel » distinct aurait dit la même chose plus lisiblement,
   * mais il faudrait l'ajouter à l'énumération `NotificationStatus`, donc au
   * schéma et aux deux clients générés, pour une information que `SENDING` +
   * marqueur de réessai porte déjà.
   *
   * LA REPRISE EST BORNÉE, et ce n'est plus « assumé » : voir
   * `DISPATCH_DEADLINE_MS`. Elle l'est par le TEMPS et non par un compteur de
   * tentatives, ce qui évite la colonne supplémentaire que le compteur aurait
   * demandée, et donne une borne qu'on peut énoncer sans connaître la cadence.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * LA DÉCISION SE LIT EN BASE, ET NON DANS UN COMPTEUR DE L'APPELANT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Cette méthode recevait un `retryable` compté par l'expédition qui l'appelle.
   * Ce chiffre ne décrit que CE passage-là, et deux passages peuvent se
   * chevaucher : une expédition plus longue que le bail était reprise par une
   * seconde (voir `renewLease`, qui ferme cette fenêtre-là), et l'ordre
   * d'arrivée décidait de l'état final. La seconde persistait un `EMAIL_RETRY`,
   * puis la PREMIÈRE, toujours en cours, appelait `settleNotification` avec
   * `retryable = 0` et écrivait SENT par-dessus. La livraison restait `PENDING`
   * avec son marqueur, la notification affichait « envoyée », et `dispatchDue`
   * ne revient JAMAIS sur une SENT : le réessai était perdu pour de bon.
   *
   * Le même mensonge s'écrivait sans la moindre concurrence, par le simple fait
   * qu'aucune clé Brevo n'était branchée : la branche e-mail ne rendait aucun
   * verdict, `retryable` restait à zéro, et l'envoi se refermait sur SENT sans
   * qu'un seul e-mail soit parti.
   *
   * La seule source honnête est donc l'ÉTAT DES LIVRAISONS, relu ici :
   *
   *   · `PENDING` sans `INBOX_ONLY` : cette personne attend encore un e-mail,
   *     qu'il faille le réessayer ou qu'il n'ait jamais pu être tenté ;
   *   · `PENDING` avec `INBOX_ONLY` : elle n'attend plus rien, elle lit dans
   *     l'application. C'est un état TERMINAL malgré son statut ;
   *   · `SENT`, `DELIVERED`, `READ`, `FAILED` : tranché.
   *
   * La branche `null` de l'`OR` n'est pas une précaution de style : une ligne
   * jamais marquée porte `error: null`, et un prédicat SQL de la forme
   * `error <> 'INBOX_ONLY'` ne sélectionne PAS les `NULL`. L'écrire ainsi
   * aurait rendu « aucune livraison en attente » exactement dans le cas que
   * cette méthode existe pour rattraper.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * COMPTER PUIS ÉCRIRE ÉTAIT DEUX DÉCISIONS LÀ OÙ IL N'EN FAUT QU'UNE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Le décompte se lisait dans une requête, la conclusion s'écrivait dans une
   * autre, et rien ne tenait entre les deux. Deux conséquences, toutes deux
   * observées :
   *
   *   · un autre passage pouvait faire avancer les livraisons dans l'intervalle.
   *     Celui qui avait compté des lignes en attente écrivait alors `SENDING`
   *     PAR-DESSUS le `SENT` que l'autre venait de conclure, et l'envoi
   *     repartait pour un tour à chaque expiration de bail ;
   *   · si le décompte lui-même levait, les verdicts étaient déjà persistés et
   *     la notification restait telle quelle, sans que l'appelant puisse
   *     distinguer « rien à faire » de « on ne sait pas ».
   *
   * LA CONDITION EST DONC PASSÉE DANS L'ÉCRITURE. `deliveries: { none: ... }`
   * devient un sous-select évalué par PostgreSQL DANS l'UPDATE, sous le verrou
   * de la ligne : il n'y a plus d'intervalle où l'état puisse changer, et plus
   * de requête de décompte qui puisse échouer toute seule. Le nombre de
   * livraisons encore en attente ne sert plus qu'au journal, et il vient du
   * passage lui-même, sans lecture supplémentaire.
   *
   * LE JETON DU BAIL FIGURE DANS LES DEUX `where`. Un expéditeur qui a perdu la
   * main n'écrit donc plus rien du tout, ni la clôture ni le maintien.
   */
  private async settleNotifications(
    claim: DispatchClaim,
    transportStatus: string | null,
    outstanding: number,
    now: Date,
  ): Promise<void> {
    if (!claim.notificationIds.length) return;

    // Le sous-select est évalué LIGNE PAR LIGNE : grouper la clôture ne referme
    // que les envois dont il ne reste rien à servir, chacun pour son compte.
    const closed = await this.prisma.notification.updateMany({
      where: { ...claim.fence, deliveries: { none: OUTSTANDING_DELIVERY } },
      data: {
        status: NotificationStatus.SENT,
        sentAt: now,
        transportStatus,
        // Plus personne ne tient cet envoi : il est terminé. La valeur n'est
        // plus lue une fois `SENT` (l'état ne rend plus la ligne prenable),
        // mais la laisser nommerait un propriétaire qui n'existe plus.
        dispatchClaim: null,
      },
    });
    if (closed.count === claim.notificationIds.length) return;

    // Il reste des livraisons à servir. LE BAIL EST CONSERVÉ, et c'est ce qui
    // fixe la cadence de reprise à une par bail : le relâcher ferait reprendre
    // l'envoi au tick suivant, soit soixante fois par heure contre un transport
    // déjà en panne.
    const held = await this.prisma.notification.updateMany({
      where: claim.fence,
      data: { transportStatus },
    });
    // Le bail nous a échappé pendant l'expédition : le détenteur suivant dira
    // ce qu'il en est. Se plaindre ici ferait deux lignes de journal pour un
    // seul envoi.
    if (held.count === 0) return;

    // CE QUE L'EXPLOITANT DOIT POUVOIR LIRE SANS OUVRIR LA BASE : combien de
    // personnes attendent encore, et combien de temps on va continuer d'essayer.
    this.logger.warn(
      `${String(held.count)} envoi(s) restent en cours, ` +
        `${String(outstanding)} livraison(s) en attente (transport : ${transportStatus ?? 'inconnu'}). ` +
        `Nouvelle tentative dans ${String(Math.round(SENDING_LEASE_MS / 60_000))} min, ` +
        `abandon au-delà de ${String(Math.round(DISPATCH_DEADLINE_MS / 3_600_000))} h.`,
    );
  }

  // Lectures d'administration

  async list(query: NotificationQueryDto): Promise<NotificationListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.NotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      // Le total et la page partagent la MÊME clause : sans cela, la
      // pagination annoncerait un nombre d'envois que la liste ne montre pas.
    };

    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        select: NOTIFICATION_SELECT,
        // `id` en second critère : sans lui, deux lignes de même date peuvent
        // s'échanger entre deux pages et l'une disparaît de la pagination.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const counts = await this.countsFor(rows.map((row) => row.id));

    return {
      items: rows.map((row) => toNotificationDto(row, counts.get(row.id))),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async get(id: string): Promise<NotificationDetailDto> {
    // `findFirst` et non `findUnique` : `findUnique` n'accepte qu'une clé
    // unique, la visibilité ne s'y compose pas. Une notification masquée
    // répond « introuvable », sans quoi le masquage ne couvrirait que la liste
    // et l'écran de détail resterait ouvert à qui connaît l'identifiant.
    const row = await this.prisma.notification.findFirst({
      where: { id },
      select: NOTIFICATION_SELECT,
    });
    if (!row) throw notificationNotFound();

    // LECTURE GLOBALE délibérée : la notification vient d'être reconnue
    // visible, ses destinataires en font partie. Filtrer une seconde fois
    // afficherait un envoi « 40 destinataires » avec une liste plus courte.
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { notificationId: id },
      select: {
        status: true,
        error: true,
        sentAt: true,
        readAt: true,
        userId: true,
        user: { select: { fullName: true, role: true } },
      },
      // `createdAt` ne trie rien ici : le `createMany` imbriqué donne le même
      // instant de transaction à toutes les lignes. L'identifiant tranche.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const counts = tally(deliveries.map((delivery) => delivery.status));

    return {
      notification: toNotificationDto(row, counts),
      recipients: deliveries.map((delivery) => ({
        userId: delivery.userId,
        fullName: delivery.user.fullName,
        role: delivery.user.role,
        status: delivery.status,
        error: delivery.error,
        sentAt: delivery.sentAt?.toISOString() ?? null,
        readAt: delivery.readAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Annule un envoi encore programmé.
   *
   * Le `where` porte le statut attendu : c'est ce qui rend l'annulation sûre
   * face à l'ordonnanceur. Si le tick a démarré l'envoi entre la lecture et
   * l'écriture, la mise à jour ne touche aucune ligne et l'appelant reçoit un
   * refus, au lieu de marquer « annulée » une notification déjà partie.
   */
  async cancel(id: string): Promise<NotificationDto> {
    const now = new Date();
    const updated = await this.prisma.notification.updateMany({
      where: { id, status: NotificationStatus.SCHEDULED },
      data: { status: NotificationStatus.CANCELLED, cancelledAt: now },
    });

    if (updated.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id },
        select: { id: true },
      });
      if (!exists) throw notificationNotFound();
      throw notScheduled();
    }

    const detail = await this.get(id);
    return detail.notification;
  }

  // Boîte de réception

  async inbox(user: AuthenticatedUser, query: InboxQueryDto): Promise<InboxDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    // Une notification encore programmée n'appartient PAS à la boîte de
    // réception : elle n'a pas encore eu lieu.
    const where: Prisma.NotificationDeliveryWhereInput = {
      userId: user.id,
      notification: { status: { in: [NotificationStatus.SENDING, NotificationStatus.SENT] } },
      ...(query.unreadOnly === true ? { readAt: null } : {}),
    };

    const [total, unreadCount, rows] = await Promise.all([
      this.prisma.notificationDelivery.count({ where }),
      // Le compteur de non-lues porte la MÊME visibilité que la liste :
      // autrement la pastille annoncerait un message que la boîte ne montre
      // pas, et l'utilisateur chercherait indéfiniment ce qu'il a « à lire ».
      this.prisma.notificationDelivery.count({
        where: {
          userId: user.id,
          readAt: null,
          notification: { status: { in: [NotificationStatus.SENDING, NotificationStatus.SENT] } },
        },
      }),
      this.prisma.notificationDelivery.findMany({
        where,
        select: {
          id: true,
          notificationId: true,
          readAt: true,
          createdAt: true,
          notification: {
            select: { title: true, body: true, category: true, route: true, sentAt: true },
          },
        },
        // `id` en second critère : sans lui, deux lignes de même date peuvent
        // s'échanger entre deux pages et l'une disparaît de la pagination.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        notificationId: row.notificationId,
        title: row.notification.title,
        body: row.notification.body,
        category: row.notification.category,
        route: row.notification.route,
        isRead: row.readAt !== null,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: (row.notification.sentAt ?? row.createdAt).toISOString(),
      })),
      unreadCount,
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  /**
   * Marque lue la livraison de CET utilisateur.
   *
   * `updateMany` avec `userId` dans le `where` : un utilisateur ne peut pas
   * marquer lue la notification d'un autre, même en devinant l'identifiant.
   * L'opération est idempotente, `readAt: null` empêche d'écraser la première
   * lecture, qui est la seule intéressante.
   *
   * ═══ POURQUOI DEUX ÉCRITURES ET NON UNE ═══
   *
   * LA DATE DE LECTURE ET LE STATUT NE DISENT PAS LA MÊME CHOSE. `readAt`
   * décrit ce que l'utilisateur a fait, et vaut pour toute ligne qu'il a pu
   * ouvrir ; `status` décrit ce que la PLATEFORME a fait de l'envoi.
   *
   * Une seule écriture sans prédicat de statut les confondait, et effaçait
   * deux informations que rien ne reconstitue :
   *
   *   · une livraison FAILED devenait READ à la première ouverture de
   *     l'application. L'échec disparaissait de `tally()` et de `countsFor()`,
   *     donc de l'écran d'administration : l'envoi s'affichait comme lu par
   *     quelqu'un qui ne l'a jamais reçu par e-mail ;
   *   · une livraison PENDING en attente de réessai devenait READ elle aussi,
   *     sortait de la population `PENDING` que le passage suivant reprend, et
   *     son réessai était annulé en silence.
   *
   * Seules les lignes RÉELLEMENT REMISES passent donc READ. Les autres sont
   * horodatées sans changer d'état : la pastille de non-lues se vide (elle se
   * compte sur `readAt`), et la reprise garde sa population.
   */
  async markRead(user: AuthenticatedUser, notificationId: string): Promise<{ ok: boolean }> {
    // MÊME PORTÉE QUE LA BOÎTE qui a servi cet identifiant, sur l'écriture
    // comme sur le repli : marquer lue une notification masquée répondrait
    // « c'est fait » sur une ligne que l'utilisateur ne voit nulle part, et
    // écrirait une date de lecture sur une ligne que le mode éteint nie.
    const scope = { notificationId, userId: user.id, readAt: null };
    const readAt = new Date();

    const advanced = await this.prisma.notificationDelivery.updateMany({
      where: {
        ...scope,
        status: {
          in: [NotificationDeliveryStatus.SENT, NotificationDeliveryStatus.DELIVERED],
        },
      },
      data: { status: NotificationDeliveryStatus.READ, readAt },
    });

    const stamped = await this.prisma.notificationDelivery.updateMany({
      where: {
        ...scope,
        status: {
          in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.FAILED],
        },
      },
      data: { readAt },
    });

    const result = { count: advanced.count + stamped.count };

    if (result.count === 0) {
      const existing = await this.prisma.notificationDelivery.findFirst({
        where: { notificationId, userId: user.id },
        select: { id: true },
      });
      if (!existing) throw notificationNotFound();
    }

    return { ok: true };
  }

  private async countsFor(ids: readonly string[]): Promise<Map<string, ReturnType<typeof tally>>> {
    const result = new Map<string, ReturnType<typeof tally>>();
    if (!ids.length) return result;

    // LECTURE GLOBALE délibérée : les identifiants viennent d'une liste DÉJÀ
    // cloisonnée, et ce sont les compteurs affichés en face de chaque ligne.
    // Une seconde portée ici ferait afficher « 12 destinataires » sur un envoi
    // qui en a quarante, le seul chiffre que l'écran ne peut pas se permettre.
    const grouped = await this.prisma.notificationDelivery.groupBy({
      by: ['notificationId', 'status'],
      where: { notificationId: { in: [...ids] } },
      _count: { _all: true },
    });

    for (const id of ids) result.set(id, tally([]));
    for (const group of grouped) {
      const bucket = result.get(group.notificationId) ?? tally([]);
      const count = group._count._all;
      bucket.total += count;
      switch (group.status) {
        case NotificationDeliveryStatus.PENDING:
          bucket.pending += count;
          break;
        case NotificationDeliveryStatus.SENT:
          bucket.sent += count;
          break;
        case NotificationDeliveryStatus.DELIVERED:
          bucket.delivered += count;
          break;
        case NotificationDeliveryStatus.FAILED:
          bucket.failed += count;
          break;
        case NotificationDeliveryStatus.READ:
          bucket.read += count;
          break;
      }
      result.set(group.notificationId, bucket);
    }
    return result;
  }
}

/**
 * Verdict « à réessayer » pour tout un lot de livraisons visées.
 *
 * Servi quand l'échec porte sur le TRANSPORT et non sur une adresse : aucune
 * des lignes concernées ne doit être enterrée.
 */
const retryAll = (targeted: readonly { id: string }[]): ReadonlyMap<string, DeliveryVerdict> => {
  const verdicts = new Map<string, DeliveryVerdict>();
  for (const row of targeted) {
    verdicts.set(row.id, { kind: 'retry', error: DELIVERY_RETRY_ERROR });
  }
  return verdicts;
};

/**
 * Découpe une vague en appels de transport, puis en tranches d'écriture.
 *
 * LE REGROUPEMENT SE FAIT PAR CONTENU RENDU, jamais par notification : deux
 * rappels qui portent des chiffres différents ne peuvent PAS partager un envoi,
 * alors que trois cents comptes rendus identiques tiennent dans un seul, ce que
 * le plafond de Brevo autorisait déjà et qu'un envoi par personne annulait.
 *
 * Chaque tranche rendue est écrite en base avant que la suivante ne parte, voir
 * `EMAIL_PERSIST_GROUP_SIZE`.
 */
const emailWaves = (
  targeted: readonly EmailRecipient[],
  notifications: ReadonlyMap<string, NotificationRow>,
): EmailJob[][] => {
  const byContent = new Map<string, { title: string; body: string; rows: EmailRecipient[] }>();
  for (const row of targeted) {
    const notification = notifications.get(row.notificationId);
    if (!notification) continue;
    const key = JSON.stringify([notification.title, notification.body]);
    const bucket = byContent.get(key);
    if (bucket) bucket.rows.push(row);
    else byContent.set(key, { title: notification.title, body: notification.body, rows: [row] });
  }

  const jobs: EmailJob[] = [];
  for (const group of byContent.values()) {
    const content = buildEmailContent(group.title, group.body);
    for (const chunk of chunkRecipients(group.rows, EMAIL_PERSIST_GROUP_SIZE)) {
      jobs.push({ subject: group.title, html: content.html, text: content.text, rows: chunk });
    }
  }

  const waves: EmailJob[][] = [];
  let current: EmailJob[] = [];
  let size = 0;
  for (const job of jobs) {
    current.push(job);
    size += job.rows.length;
    if (size < EMAIL_PERSIST_GROUP_SIZE) continue;
    waves.push(current);
    current = [];
    size = 0;
  }
  if (current.length) waves.push(current);
  return waves;
};

/**
 * Enveloppe HTML de l'e-mail. Un gabarit `{{}}` et non une concaténation :
 * c'est `template.ts` qui substitue, la même fonction que le compositeur web
 * utilise pour son aperçu. Deux implémentations de la substitution finiraient
 * par diverger.
 */
const EMAIL_HTML_TEMPLATE = [
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">',
  '<h2 style="font-size:17px;margin:0 0 12px">{{titre}}</h2>',
  '<p style="margin:0 0 16px">{{corps}}</p>',
  '<p style="font-size:12px;color:#666;margin:0">Message automatique de CPI GO. Ne pas répondre.</p>',
  '</div>',
].join('');

/**
 * Échappe le texte avant de l'insérer dans le gabarit.
 *
 * Le titre et le corps sont SAISIS par un administrateur. Sans cet échappement,
 * un `<` collé depuis un traitement de texte casserait la mise en page, et une
 * balise volontaire ferait de l'e-mail portant notre nom un support d'hameçon-
 * nage que le lecteur ne peut pas inspecter.
 */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Corps de l'e-mail, en HTML et en texte brut (certains clients n'affichent que celui-ci). */
export const buildEmailContent = (title: string, body: string): { html: string; text: string } => ({
  html: renderTemplate(EMAIL_HTML_TEMPLATE, {
    titre: escapeHtml(title),
    corps: escapeHtml(body).replace(/\n/g, '<br />'),
  }).text,
  text: `${title}\n\n${body}`,
});

interface Counts {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  failed: number;
  read: number;
}

const tally = (statuses: readonly NotificationDeliveryStatus[]): Counts => {
  const counts: Counts = { total: 0, pending: 0, sent: 0, delivered: 0, failed: 0, read: 0 };
  for (const status of statuses) {
    counts.total += 1;
    switch (status) {
      case NotificationDeliveryStatus.PENDING:
        counts.pending += 1;
        break;
      case NotificationDeliveryStatus.SENT:
        counts.sent += 1;
        break;
      case NotificationDeliveryStatus.DELIVERED:
        counts.delivered += 1;
        break;
      case NotificationDeliveryStatus.FAILED:
        counts.failed += 1;
        break;
      case NotificationDeliveryStatus.READ:
        counts.read += 1;
        break;
    }
  }
  return counts;
};

const toNotificationDto = (row: NotificationRow, counts: Counts | undefined): NotificationDto => ({
  id: row.id,
  title: row.title,
  body: row.body,
  category: row.category,
  route: row.route,
  audience: row.audience,
  audienceRole: row.audienceRole,
  audienceDepartementId: row.audienceDepartementId,
  audienceUserIds: row.audienceUserIds,
  status: row.status,
  scheduledFor: row.scheduledFor?.toISOString() ?? null,
  sentAt: row.sentAt?.toISOString() ?? null,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  transportStatus: row.transportStatus,
  createdByName: row.createdBy?.fullName ?? null,
  createdAt: row.createdAt.toISOString(),
  counts: counts ?? { total: 0, pending: 0, sent: 0, delivered: 0, failed: 0, read: 0 },
});
