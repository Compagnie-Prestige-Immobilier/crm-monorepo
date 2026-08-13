import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  type Prisma,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { buildAudienceWhere, dedupe, type AudienceSelector } from './audience.js';
import {
  FCM_TRANSPORT,
  type FcmMessage,
  type FcmTransport,
  type FcmTransportStatus,
} from './fcm.transport.js';
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

/** Ce que l'éventail a réellement produit. Sert aux tests et au journal. */
export interface DispatchSummary {
  readonly transportStatus: FcmTransportStatus;
  readonly sent: number;
  readonly failed: number;
  readonly pending: number;
  /** Jetons élagués parce que FCM les a déclarés UNREGISTERED. */
  readonly prunedTokens: number;
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
  payload: true,
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
    @Inject(FCM_TRANSPORT) private readonly transport: FcmTransport,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Composition
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compose un envoi, immédiat ou programmé.
   *
   * L'ORDRE COMPTE. Le public est résolu et les lignes de livraison écrites
   * AVANT toute tentative de remise, et dans la même transaction que l'envoi.
   * Le contraire — pousser d'abord, tracer ensuite — laisse un trou : un
   * redémarrage entre les deux produit des téléphones qui ont sonné et une base
   * qui l'ignore, donc une question « qui a reçu ? » sans réponse.
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
        payload: (body.payload ?? null) as Prisma.InputJsonValue,
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
      where: { ...buildAudienceWhere(selector), ...demoScope(await this.demo.enabled()) },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => ({ userId: row.id }));
  }

  /** Compteur annoncé au compositeur AVANT confirmation. */
  async previewAudience(selector: AudienceSelector): Promise<AudiencePreviewDto> {
    const recipients = await this.resolveRecipients(selector);
    const userIds = recipients.map((recipient) => recipient.userId);

    // `distinct` plutôt qu'un comptage de jetons : un commercial avec trois
    // téléphones est UNE personne joignable, pas trois.
    const reachable = userIds.length
      ? await this.prisma.deviceToken.findMany({
          where: { userId: { in: userIds }, revokedAt: null },
          select: { userId: true },
          distinct: ['userId'],
        })
      : [];

    return {
      recipientCount: recipients.length,
      reachableCount: reachable.length,
      transportConfigured: this.transport.isConfigured(),
      transportReason: this.transport.unavailableReason(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Éventail
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pousse une notification vers tous les appareils de ses destinataires.
   *
   * TROIS PROPRIÉTÉS, toutes testées.
   *
   * 1. UN JETON MORT N'EMPORTE PAS LE LOT. Chaque message est indépendant ;
   *    l'échec de l'un marque SA ligne de livraison en échec et laisse les
   *    autres passer. Un `Promise.all` ferait exactement le contraire.
   * 2. UN DESTINATAIRE, UNE LIGNE. Trois téléphones ne font pas trois
   *    livraisons : la ligne passe à SENT dès qu'un appareil a accepté, et
   *    n'échoue que si tous ont échoué.
   * 3. UNREGISTERED ÉLAGUE. Le jeton est révoqué, définitivement. Le réessayer
   *    à chaque envoi ferait croire à un taux d'échec permanent alors que le
   *    téléphone a simplement désinstallé l'application.
   */
  async dispatch(notificationId: string): Promise<DispatchSummary> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: NOTIFICATION_SELECT,
    });
    if (!notification) throw notificationNotFound();

    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { notificationId, status: NotificationDeliveryStatus.PENDING },
      select: { id: true, userId: true },
    });

    if (!deliveries.length) {
      await this.markNotificationSent(notificationId, 'SENT');
      return { transportStatus: 'SENT', sent: 0, failed: 0, pending: 0, prunedTokens: 0 };
    }

    const userIds = deliveries.map((delivery) => delivery.userId);
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, revokedAt: null },
      select: { token: true, userId: true },
    });

    // ── Mode dégradé ────────────────────────────────────────────────────────
    // Pas de compte de service : les lignes restent PENDING, la notification
    // est marquée envoyée avec un statut de transport explicite, et la boîte de
    // réception mobile la montrera à la prochaine ouverture. Rien n'est perdu ;
    // c'est simplement le push qui n'a pas lieu.
    if (!this.transport.isConfigured()) {
      const reason = this.transport.unavailableReason() ?? 'Transport indisponible.';
      this.logger.warn(
        `Notification ${notificationId} : ${String(deliveries.length)} destinataire(s) en file, aucun push. ${reason}`,
      );
      await this.markNotificationSent(notificationId, 'NOT_CONFIGURED');
      return {
        transportStatus: 'NOT_CONFIGURED',
        sent: 0,
        failed: 0,
        pending: deliveries.length,
        prunedTokens: 0,
      };
    }

    const messages: FcmMessage[] = tokens.map((row) => ({
      token: row.token,
      title: notification.title,
      body: notification.body,
      data: buildDataPayload(notification),
    }));

    const result = await this.transport.send(messages);

    if (result.status === 'TRANSPORT_ERROR') {
      // L'échange OAuth a échoué : aucun jeton n'est en cause, aucun n'est
      // élagué, et les lignes restent PENDING pour être rejouées.
      this.logger.error(
        `Notification ${notificationId} : transport en erreur (${result.detail ?? 'sans détail'}). Aucune livraison marquée.`,
      );
      await this.markNotificationSent(notificationId, 'TRANSPORT_ERROR');
      return {
        transportStatus: 'TRANSPORT_ERROR',
        sent: 0,
        failed: 0,
        pending: deliveries.length,
        prunedTokens: 0,
      };
    }

    const outcomeByToken = new Map(result.outcomes.map((outcome) => [outcome.token, outcome]));
    const tokensByUser = new Map<string, string[]>();
    for (const row of tokens) {
      const list = tokensByUser.get(row.userId) ?? [];
      list.push(row.token);
      tokensByUser.set(row.userId, list);
    }

    const deadTokens = result.outcomes
      .filter((outcome) => outcome.kind === 'unregistered')
      .map((outcome) => outcome.token);

    let sent = 0;
    let failed = 0;
    let pending = 0;
    const now = new Date();

    for (const delivery of deliveries) {
      const userTokens = tokensByUser.get(delivery.userId) ?? [];

      if (!userTokens.length) {
        // Aucun appareil : la personne verra le message en ouvrant
        // l'application. `PENDING` et non `FAILED` — rien n'a échoué, il n'y
        // avait simplement rien à joindre.
        pending += 1;
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { error: 'NO_DEVICE' },
        });
        continue;
      }

      const outcomes = userTokens.map((token) => outcomeByToken.get(token));
      const success = outcomes.find((outcome) => outcome?.ok === true);

      if (success) {
        sent += 1;
        await this.prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.SENT,
            deviceToken: success.token,
            error: null,
            sentAt: now,
          },
        });
        continue;
      }

      failed += 1;
      const firstError = outcomes.find((outcome) => outcome !== undefined);
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.FAILED,
          deviceToken: userTokens[0] ?? null,
          error: firstError?.errorCode ?? 'UNKNOWN',
          failedAt: now,
        },
      });
    }

    if (deadTokens.length) {
      await this.prisma.deviceToken.updateMany({
        where: { token: { in: deadTokens }, revokedAt: null },
        data: { revokedAt: now },
      });
      this.logger.log(
        `${String(deadTokens.length)} jeton(s) élagué(s) : FCM les a déclarés UNREGISTERED.`,
      );
    }

    await this.markNotificationSent(notificationId, 'SENT');
    return { transportStatus: 'SENT', sent, failed, pending, prunedTokens: deadTokens.length };
  }

  private async markNotificationSent(id: string, transportStatus: string): Promise<void> {
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
    const row = await this.prisma.notification.findUnique({
      where: { id },
      select: NOTIFICATION_SELECT,
    });
    if (!row) throw notificationNotFound();

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
   * refus — au lieu de marquer « annulée » une notification déjà partie.
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
    const where: Prisma.NotificationDeliveryWhereInput = {
      userId: user.id,
      notification: { status: { in: [NotificationStatus.SENDING, NotificationStatus.SENT] } },
      ...(query.unreadOnly === true ? { readAt: null } : {}),
    };

    const [total, unreadCount, rows] = await Promise.all([
      this.prisma.notificationDelivery.count({ where }),
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
   * L'opération est idempotente — `readAt: null` empêche d'écraser la première
   * lecture, qui est la seule intéressante.
   */
  async markRead(user: AuthenticatedUser, notificationId: string): Promise<{ ok: boolean }> {
    const result = await this.prisma.notificationDelivery.updateMany({
      where: { notificationId, userId: user.id, readAt: null },
      data: { status: NotificationDeliveryStatus.READ, readAt: new Date() },
    });

    if (result.count === 0) {
      const existing = await this.prisma.notificationDelivery.findFirst({
        where: { notificationId, userId: user.id },
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
 * Charge utile `data` du message FCM.
 *
 * TOUTES les valeurs sont des chaînes — FCM refuse le message entier si une
 * seule ne l'est pas, et l'erreur ne nomme pas le champ fautif.
 *
 * `route` est ce qui rend la notification actionnable : c'est elle que le
 * mobile donne à `go_router` au tap, y compris depuis un démarrage à froid.
 */
export const buildDataPayload = (notification: {
  id: string;
  route: string | null;
  category: string;
  payload: unknown;
}): Record<string, string> => {
  const data: Record<string, string> = {
    notificationId: notification.id,
    category: notification.category,
  };
  if (notification.route) data.route = notification.route;
  if (notification.payload !== null && notification.payload !== undefined) {
    data.payload = JSON.stringify(notification.payload);
  }
  return data;
};

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
