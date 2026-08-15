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
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

/**
 * Marqueur d'une livraison LAISSÉE EN FILE après un échec passager.
 *
 * La ligne reste `PENDING`, ce qui la rend éligible au passage suivant de
 * `dispatch()` : c'est tout le mécanisme de réessai, il n'y a pas de file
 * séparée. Le marqueur sert à distinguer « en attente parce qu'il faut
 * réessayer » de « en attente parce qu'il n'y avait rien à envoyer », deux
 * états que le seul statut `PENDING` confondrait.
 */
export const DELIVERY_RETRY_ERROR = 'EMAIL_RETRY';

/**
 * Marqueur d'une livraison qui ne sera JAMAIS servie par e-mail : le
 * destinataire n'est pas téléconseiller, ou n'a pas d'adresse. Ce n'est pas un
 * échec, la personne verra le message dans sa boîte de réception.
 */
export const DELIVERY_INBOX_ONLY = 'INBOX_ONLY';

/**
 * Nombre de destinataires servis AVANT que le sort de leurs livraisons ne soit
 * écrit en base.
 *
 * ═══ POURQUOI ÉCRIRE EN COURS DE ROUTE ET NON À LA FIN ═══
 *
 * Confier un lot à Brevo est IRRÉVERSIBLE : l'e-mail est parti. Tant que la
 * ligne de livraison correspondante n'est pas passée à `SENT`, la base ignore
 * cet envoi, et toute reprise de la notification (bail expiré, processus tué,
 * réessai d'une livraison voisine restée en file) relit la ligne `PENDING` et
 * RENVOIE le même message à quelqu'un qui l'a déjà reçu.
 *
 * En écrivant une seule fois, à la fin, la fenêtre d'exposition couvrait TOUTE
 * l'expédition : quelques milliers d'adresses acceptées pouvaient être renvoyées
 * en bloc parce que le processus est mort sur la dernière. La borner à un groupe
 * la ramène à ce qui est réellement en vol au même instant.
 *
 * ═══ POURQUOI CETTE TAILLE-LÀ ═══
 *
 * `BREVO_MAX_RECIPIENTS_PER_CALL × BREVO_MAX_CONCURRENT_CALLS`, c'est-à-dire
 * exactement une VAGUE d'appels : le transport découpe le groupe en lots de 99
 * et en lance 8 à la fois, donc les issues du groupe entier reviennent
 * ensemble, au bout d'un aller-retour réseau. Découper plus fin ne réduirait
 * pas la fenêtre, puisque les lots d'une même vague sont en vol simultanément ;
 * découper plus gros ferait attendre l'écriture de la première vague derrière
 * la seconde, sans rien gagner.
 */
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
  readonly sent: number;
  readonly failed: number;
  readonly pending: number;
  /** Adresses acceptées par Brevo. Redondant avec `sent`, conservé pour le journal. */
  readonly emailed: number;
  readonly emailStatus: BrevoTransportStatus;
}

/** Sort réservé à UNE ligne de livraison par la branche e-mail. */
type DeliveryVerdict =
  | { readonly kind: 'sent' }
  | { readonly kind: 'retry'; readonly error: string }
  | { readonly kind: 'failed'; readonly error: string };

/** Ce que la branche e-mail a produit. Interne à `dispatch()`. */
interface EmailLegResult {
  readonly emailed: number;
  readonly status: BrevoTransportStatus;
  /**
   * Verdict par destinataire, pour les seuls comptes réellement servis. Un
   * identifiant absent de cette table n'a pas d'e-mail à recevoir : sa ligne
   * reste en file, sans que ce soit un échec.
   */
  readonly verdicts: ReadonlyMap<string, DeliveryVerdict>;
}

interface DeliveryRowSeed {
  readonly userId: string;
}

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

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
    @Inject(BREVO_TRANSPORT) private readonly email: BrevoTransport,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Composition
  // ───────────────────────────────────────────────────────────────────────────

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

    // ═══ LA NOTIFICATION SUIT L'INTERRUPTEUR ═══
    //
    // Composée mode ALLUMÉ, elle est une ligne de démonstration, au même titre
    // qu'un prospect ou qu'une campagne saisis pendant la même séance : c'est
    // ce qui la fait disparaître à l'extinction. Sans cela, une annonce
    // d'exemple resterait dans la boîte de réception de vrais commerciaux,
    // avec un texte écrit pour une démo.
    //
    // Les LIVRAISONS portent la même valeur : elles n'existent que par leur
    // notification, et une livraison visible accrochée à une notification
    // masquée afficherait une ligne vide dans la boîte de réception.
    //
    // `enabledForWrite` et non `enabled` : cette valeur est ÉCRITE. Sur panne
    // de lecture du réglage, `enabled()` rendrait `false` et l'annonce
    // d'exemple atterrirait pour de bon dans la boîte de vrais commerciaux,
    // avec un texte écrit pour une démonstration.
    const isDemo = await this.demo.enabledForWrite();

    const created = await this.prisma.notification.create({
      data: {
        isDemo,
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
                isDemo,
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
      where: { ...buildAudienceWhere(selector), ...demoScope(await this.demo.enabled()) },
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

  // ───────────────────────────────────────────────────────────────────────────
  // Éventail
  // ───────────────────────────────────────────────────────────────────────────

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
   */
  async dispatch(notificationId: string): Promise<DispatchSummary> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: NOTIFICATION_SELECT,
    });
    if (!notification) throw notificationNotFound();

    // LECTURE GLOBALE délibérée : l'expédition doit servir TOUTES les
    // livraisons de la notification qu'on lui a désignée. Une livraison écartée
    // ici resterait `PENDING` pour toujours, sans qu'aucun passage ne la
    // reprenne jamais, et le compteur annoncé au compositeur mentirait. La
    // nature de la ligne est déjà tranchée en amont : les livraisons portent
    // celle de leur notification, posée dans la même transaction que sa
    // création.
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { notificationId, status: NotificationDeliveryStatus.PENDING },
      select: { id: true, userId: true },
    });

    if (!deliveries.length) {
      const idle = await this.sendByEmail(notification, []);
      await this.settleNotification(notificationId, idle.status, 0);
      return { sent: 0, failed: 0, pending: 0, emailed: idle.emailed, emailStatus: idle.status };
    }

    const email = await this.sendByEmail(
      notification,
      deliveries.map((delivery) => delivery.userId),
    );

    let sent = 0;
    let failed = 0;
    let pending = 0;
    /** Livraisons qu'un passage ULTÉRIEUR doit reprendre. Voir `settleNotification`. */
    let retryable = 0;
    const inboxOnly: string[] = [];

    for (const delivery of deliveries) {
      const verdict = email.verdicts.get(delivery.userId);

      if (verdict === undefined) {
        // Personne à servir par e-mail. `PENDING` et non `FAILED` : rien n'a
        // échoué, il n'y avait simplement rien à envoyer au-dehors.
        pending += 1;
        inboxOnly.push(delivery.id);
        continue;
      }

      // Le sort des livraisons SERVIES est déjà écrit : `sendByEmail` l'a posé
      // groupe par groupe, au fur et à mesure des acceptations. Il ne reste ici
      // qu'à compter.
      if (verdict.kind === 'sent') {
        sent += 1;
        continue;
      }
      if (verdict.kind === 'retry') {
        pending += 1;
        retryable += 1;
        continue;
      }
      failed += 1;
    }

    if (inboxOnly.length) {
      await this.prisma.notificationDelivery.updateMany({
        where: { id: { in: inboxOnly } },
        data: { error: DELIVERY_INBOX_ONLY },
      });
    }

    await this.settleNotification(notificationId, email.status, retryable);
    return { sent, failed, pending, emailed: email.emailed, emailStatus: email.status };
  }

  /**
   * Sert la notification par e-mail, aux téléconseillers seuls.
   *
   * POURQUOI LES COMMERCIAUX ET EUX SEULS : ce sont les seuls destinataires qui
   * travaillent devant un poste, souvent loin de l'application. Les autres
   * rôles ont le panel ouvert toute la journée, et leur envoyer un e-mail de
   * plus par notification transformerait leur boîte en bruit qu'ils finiraient
   * par filtrer, e-mails utiles compris.
   *
   * RIEN DE CE QUI SE PASSE ICI N'EST UNE ERREUR REMONTÉE. Le `try` couvre
   * l'appel réseau ET la lecture des comptes : une panne Brevo ou une base
   * momentanément indisponible laissent les lignes EN FILE, avec le marqueur de
   * réessai, plutôt que de faire échouer l'appel ou d'enterrer les livraisons.
   *
   * Les identifiants viennent des lignes de livraison, donc d'un public déjà
   * résolu avec la visibilité de démonstration : le filtre n'a pas à être
   * réappliqué sur une liste qui en sort.
   */
  private async sendByEmail(
    notification: NotificationRow,
    userIds: readonly string[],
  ): Promise<EmailLegResult> {
    const empty = new Map<string, DeliveryVerdict>();
    if (!this.email.isConfigured())
      return { emailed: 0, status: 'NOT_CONFIGURED', verdicts: empty };
    if (!userIds.length) return { emailed: 0, status: 'SENT', verdicts: empty };

    // Hissé hors du `try` : le rattrapage doit savoir QUI était visé pour
    // marquer ces lignes-là à réessayer, et elles seules.
    let targeted: { userId: string; email: string; fullName: string }[] = [];

    /** Verdicts DÉJÀ ÉCRITS en base, groupe par groupe. */
    const verdicts = new Map<string, DeliveryVerdict>();
    let emailed = 0;
    let refused = false;

    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...userIds] }, role: Role.COMMERCIAL },
        select: { id: true, email: true, fullName: true },
      });

      targeted = users
        .filter((user) => user.email.trim().length > 0)
        .map((user) => ({ userId: user.id, email: user.email.trim(), fullName: user.fullName }));

      if (!targeted.length) return { emailed: 0, status: 'SENT', verdicts: empty };

      const content = buildEmailContent(notification.title, notification.body);

      // UNE VAGUE, PUIS SON ÉCRITURE, PUIS LA SUIVANTE. Voir
      // `EMAIL_PERSIST_GROUP_SIZE` : ce qui a été accepté par Brevo est acquis
      // en base avant qu'on n'expose la suite, faute de quoi une reprise
      // renverrait le message à des gens qui l'ont déjà reçu.
      for (const group of chunkRecipients(targeted, EMAIL_PERSIST_GROUP_SIZE)) {
        const recipients: BrevoRecipient[] = group.map((row) => ({
          email: row.email,
          name: row.fullName,
        }));

        const result = await this.email.send([
          {
            recipients,
            subject: notification.title,
            htmlContent: content.html,
            textContent: content.text,
          },
        ]);

        emailed += result.outcomes.filter((outcome) => outcome.ok).length;

        const groupVerdicts = new Map<string, DeliveryVerdict>();

        if (result.status === 'TRANSPORT_ERROR') {
          // Aucun lot du groupe n'est passé : ce ne sont pas les adresses qui
          // sont en cause, c'est le service ou la clé. Tout le groupe reste à
          // réessayer.
          refused = true;
          this.logger.warn(
            `Notification ${notification.id} : e-mail non parti (${result.detail ?? 'sans détail'}). Les livraisons restent en file.`,
          );
          for (const row of group) {
            groupVerdicts.set(row.userId, { kind: 'retry', error: DELIVERY_RETRY_ERROR });
          }
        } else {
          const byEmail = new Map(result.outcomes.map((outcome) => [outcome.email, outcome]));
          for (const row of group) {
            const outcome = byEmail.get(row.email);
            if (outcome === undefined || outcome.ok) {
              // Adresse acceptée, ou issue muette : un transport qui ne dit
              // rien d'une adresse qu'il a reçue l'a prise en charge, et le
              // doute ne justifie ni un échec ni un réessai.
              groupVerdicts.set(row.userId, { kind: 'sent' });
              continue;
            }
            const error = outcome.errorCode ?? 'UNKNOWN';
            groupVerdicts.set(
              row.userId,
              outcome.kind === 'transient'
                ? { kind: 'retry', error: DELIVERY_RETRY_ERROR }
                : { kind: 'failed', error },
            );
          }
        }

        await this.persistVerdicts(notification.id, groupVerdicts);
        for (const [userId, verdict] of groupVerdicts) verdicts.set(userId, verdict);
      }

      if (emailed) {
        this.logger.log(
          `Notification ${notification.id} : ${String(emailed)} e-mail(s) remis à Brevo.`,
        );
      }

      // `TRANSPORT_ERROR` ne se dit que si RIEN n'est passé. Un groupe refusé
      // derrière un groupe accepté décrit une panne partielle : l'annoncer
      // comme une panne de transport ferait croire que la clé est en cause,
      // alors que des e-mails sont bel et bien partis.
      return { emailed, status: refused && emailed === 0 ? 'TRANSPORT_ERROR' : 'SENT', verdicts };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Notification ${notification.id} : branche e-mail interrompue (${detail}). Les livraisons restent en file.`,
      );

      // SEULS LES DESTINATAIRES PAS ENCORE TRANCHÉS repartent en file. Remettre
      // tout `targeted` à réessayer réécrirait en `PENDING` des lignes déjà
      // passées à `SENT` par un groupe précédent, et le passage suivant leur
      // renverrait l'e-mail qu'elles ont reçu.
      const unresolved = retryAll(targeted.filter((row) => !verdicts.has(row.userId)));
      // L'écriture peut échouer à son tour, c'est même le cas typique quand
      // c'est la base qui a lâché. Sans marqueur, les lignes restent `PENDING`
      // et la notification reste prenable : la reprise est assurée par le bail,
      // pas par ce marqueur.
      await this.persistVerdicts(notification.id, unresolved).catch(() => undefined);
      for (const [userId, verdict] of unresolved) verdicts.set(userId, verdict);

      return { emailed, status: 'TRANSPORT_ERROR', verdicts };
    }
  }

  /**
   * Écrit le sort d'un GROUPE de livraisons, par verdict et non ligne à ligne.
   *
   * `status: PENDING` figure dans chaque `where` : une ligne qu'un autre
   * passage a déjà fait avancer (`SENT`, ou `READ` parce que la personne a
   * ouvert l'application entre-temps) ne doit pas être ramenée en arrière par
   * une écriture tardive.
   */
  private async persistVerdicts(
    notificationId: string,
    verdicts: ReadonlyMap<string, DeliveryVerdict>,
  ): Promise<void> {
    if (!verdicts.size) return;

    const now = new Date();
    const sent: string[] = [];
    const retry = new Map<string, string[]>();
    const failed = new Map<string, string[]>();

    for (const [userId, verdict] of verdicts) {
      if (verdict.kind === 'sent') {
        sent.push(userId);
        continue;
      }
      const bucket = verdict.kind === 'retry' ? retry : failed;
      const ids = bucket.get(verdict.error);
      if (ids) ids.push(userId);
      else bucket.set(verdict.error, [userId]);
    }

    // L'ACCEPTATION D'ABORD, avant les réessais et les échecs : c'est la seule
    // des trois écritures qu'une interruption ne pardonne pas, puisque son
    // absence fait renvoyer un e-mail déjà remis.
    if (sent.length) {
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          userId: { in: sent },
          status: NotificationDeliveryStatus.PENDING,
        },
        data: { status: NotificationDeliveryStatus.SENT, error: null, sentAt: now },
      });
    }

    for (const [error, userIds] of retry) {
      // Le statut RESTE `PENDING` : c'est ce qui rend la ligne éligible au
      // prochain passage. Seul le marqueur d'erreur change, pour distinguer
      // « à réessayer » de « rien à envoyer ».
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          userId: { in: userIds },
          status: NotificationDeliveryStatus.PENDING,
        },
        data: { error },
      });
    }

    for (const [error, userIds] of failed) {
      await this.prisma.notificationDelivery.updateMany({
        where: {
          notificationId,
          userId: { in: userIds },
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
   * CE QUI RESTE OUVERT, ET C'EST ASSUMÉ : rien ne compte les tentatives. Un
   * transport durablement en 429 fait donc repartir la notification toutes les
   * quinze minutes, indéfiniment. Le journal le montre à chaque passage. Borner
   * demanderait un compteur sur la livraison, donc une colonne de plus ; entre
   * réessayer trop et abandonner un envoi en silence, c'est l'abandon qui est
   * le défaut grave.
   */
  private async settleNotification(
    id: string,
    transportStatus: string,
    retryable: number,
  ): Promise<void> {
    if (retryable > 0) {
      await this.prisma.notification.update({
        where: { id },
        data: { status: NotificationStatus.SENDING, transportStatus },
      });
      return;
    }

    await this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, sentAt: new Date(), transportStatus },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lectures d'administration
  // ───────────────────────────────────────────────────────────────────────────

  async list(query: NotificationQueryDto): Promise<NotificationListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.NotificationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      // Le total et la page partagent la MÊME clause : sans cela, la
      // pagination annoncerait un nombre d'envois que la liste ne montre pas.
      ...demoScope(await this.demo.enabled()),
    };

    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        select: NOTIFICATION_SELECT,
        orderBy: { createdAt: 'desc' },
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
      where: { id, ...demoScope(await this.demo.enabled()) },
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
      orderBy: { createdAt: 'asc' },
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
      const exists = await this.prisma.notification.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!exists) throw notificationNotFound();
      throw notScheduled();
    }

    const detail = await this.get(id);
    return detail.notification;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Boîte de réception
  // ───────────────────────────────────────────────────────────────────────────

  async inbox(user: AuthenticatedUser, query: InboxQueryDto): Promise<InboxDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    // Une notification encore programmée n'appartient PAS à la boîte de
    // réception : elle n'a pas encore eu lieu.
    const demoEnabled = await this.demo.enabled();
    const where: Prisma.NotificationDeliveryWhereInput = {
      userId: user.id,
      notification: { status: { in: [NotificationStatus.SENDING, NotificationStatus.SENT] } },
      ...(query.unreadOnly === true ? { readAt: null } : {}),
      ...demoScope(demoEnabled),
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
          ...demoScope(demoEnabled),
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
        orderBy: { createdAt: 'desc' },
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
   */
  async markRead(user: AuthenticatedUser, notificationId: string): Promise<{ ok: boolean }> {
    // MÊME PORTÉE QUE LA BOÎTE qui a servi cet identifiant, sur l'écriture
    // comme sur le repli : marquer lue une notification masquée répondrait
    // « c'est fait » sur une ligne que l'utilisateur ne voit nulle part, et
    // écrirait une date de lecture sur une ligne que le mode éteint nie.
    const demoEnabled = await this.demo.enabled();

    const result = await this.prisma.notificationDelivery.updateMany({
      where: { notificationId, userId: user.id, readAt: null, ...demoScope(demoEnabled) },
      data: { status: NotificationDeliveryStatus.READ, readAt: new Date() },
    });

    if (result.count === 0) {
      const existing = await this.prisma.notificationDelivery.findFirst({
        where: { notificationId, userId: user.id, ...demoScope(demoEnabled) },
        select: { id: true },
      });
      if (!existing) throw notificationNotFound();
    }

    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────────────────────

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
 * Verdict « à réessayer » pour tout un lot de destinataires visés.
 *
 * Servi quand l'échec porte sur le TRANSPORT et non sur une adresse : aucune
 * des lignes concernées ne doit être enterrée.
 */
const retryAll = (
  targeted: readonly { userId: string }[],
): ReadonlyMap<string, DeliveryVerdict> => {
  const verdicts = new Map<string, DeliveryVerdict>();
  for (const row of targeted) {
    verdicts.set(row.userId, { kind: 'retry', error: DELIVERY_RETRY_ERROR });
  }
  return verdicts;
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
