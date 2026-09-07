import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BankStageType,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Role,
  ScheduledCallbackStatus,
} from '@crm/database';
import { v7 as uuidv7 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { DEVICE_CALL_LABELS, type DeviceCallType } from '../../common/device-call.js';
import { SupervisionActivityService } from '../analytics/supervision.service.js';
import { dakarDayEnd } from '../callbacks/callbacks.service.js';
import { isOpenApiGeneration } from '../../env.js';
import { DELIVERY_RETRY_ERROR, NotificationsService } from './notifications.service.js';
import { SENDING_LEASE_MS } from './dispatch-claim.js';
import { readNotificationsEnv } from './notifications.env.js';
import { renderNotification } from './template.js';
import type { ReminderRunDto } from './dto.js';

const env = readNotificationsEnv();

const remindersCron = (at: string): string => {
  const [hours, minutes] = at.split(':');
  return `0 ${minutes ?? '0'} ${hours ?? '8'} * * *`;
};

const REMINDERS_CRON = remindersCron(env.NOTIFICATIONS_REMINDERS_AT);

const DAILY_REPORT_CRON = remindersCron(env.NOTIFICATIONS_DAILY_REPORT_AT);

const ReminderKey = {
  BANK_CASES_PENDING: 'bank-cases-pending',
  BANK_CASES_STALE: 'bank-cases-stale',
  DUE_CALLBACKS: 'due-callbacks',
  DAILY_REPORT: 'daily-report',
  UNLOGGED_CALL: 'appel-non-consigne',
} as const;

export type ReminderKeyValue = (typeof ReminderKey)[keyof typeof ReminderKey];

const UNLOGGED_CALL_BUCKET_MS = 30 * 60 * 1000;

/** La tranche de 30 minutes qui regroupe les alertes d'appels non consignés. */
const trancheDe = (now: Date): string =>
  new Date(Math.floor(now.getTime() / UNLOGGED_CALL_BUCKET_MS) * UNLOGGED_CALL_BUCKET_MS)
    .toISOString()
    .slice(0, 16);

const periodFor = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

interface ReminderCandidate {
  readonly userId: string;
  readonly fullName: string;
  readonly variables: Record<string, string>;
}

interface UnloggedCallDetection {
  readonly deviceCallType: string;
  readonly representant: { readonly fullName: string } | null;
  readonly prospect: { readonly nom: string; readonly prenom: string } | null;
}

/** Fiche et libellé du type d'appel, pour le message d'alerte. */
const describeUnloggedCall = (
  detection: UnloggedCallDetection,
): { readonly fiche: string; readonly type: string } => ({
  fiche:
    detection.representant?.fullName ??
    [detection.prospect?.prenom, detection.prospect?.nom].filter(Boolean).join(' ').trim(),
  type: DEVICE_CALL_LABELS[detection.deviceCallType as DeviceCallType] ?? detection.deviceCallType,
});

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly config = readNotificationsEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly activity: SupervisionActivityService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'cpi.notifications.due' })
  async dispatchDue(now: Date = new Date()): Promise<number> {
    if (isOpenApiGeneration()) return 0;

    const leaseExpired = new Date(now.getTime() - SENDING_LEASE_MS);

    const claimable = [
      { status: NotificationStatus.SCHEDULED, scheduledFor: { lte: now } },
      { status: NotificationStatus.SENDING, updatedAt: { lt: leaseExpired } },
    ];

    const due = await this.prisma.notification.findMany({
      where: {
        OR: claimable,
      },
      select: { id: true },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });

    let dispatched = 0;
    for (const row of due) {
      if (await this.dispatchDueOne(row.id, now)) dispatched += 1;
    }

    if (dispatched)
      this.logger.log(`${String(dispatched)} notification(s) programmée(s) expédiée(s).`);
    return dispatched;
  }

  private async dispatchDueOne(notificationId: string, now: Date): Promise<boolean> {
    try {
      return (await this.notifications.dispatch(notificationId, now)).claimed;
    } catch (error) {
      this.logger.error(
        `Expédition programmée ${notificationId} en échec : ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  @Cron(REMINDERS_CRON, { name: 'cpi.notifications.reminders', timeZone: env.BUSINESS_TIME_ZONE })
  async runAll(now: Date = new Date()): Promise<ReminderRunDto> {
    if (isOpenApiGeneration()) return { created: 0, skipped: 0 };
    if (!this.config.NOTIFICATIONS_REMINDERS_ENABLED) {
      this.logger.debug('Rappels désactivés (NOTIFICATIONS_REMINDERS_ENABLED=false).');
      return { created: 0, skipped: 0 };
    }

    const callbacks = await this.remindDueCallbacks(now);
    const bankPending = await this.remindBankCasesPending(now);
    const bankStale = await this.remindBankCasesStale(now);

    const runs = [callbacks, bankPending, bankStale];
    return {
      created: runs.reduce((total, run) => total + run.created, 0),
      skipped: runs.reduce((total, run) => total + run.skipped, 0),
    };
  }

  /**
   * Rappels promis et encore dus d'ici la fin de la journée, RETARDS COMPRIS :
   * la même borne suffit, un rappel de la veille est toujours antérieur à ce
   * soir. Rien n'a besoin d'être réécrit la nuit pour le savoir.
   */
  async remindDueCallbacks(now: Date = new Date()): Promise<ReminderRunDto> {
    const grouped = await this.prisma.scheduledCallback.groupBy({
      by: ['assignedToId'],
      where: {
        status: ScheduledCallbackStatus.PENDING,
        scheduledAt: { lte: dakarDayEnd(now, 0) },
      },
      _count: { _all: true },
    });
    if (!grouped.length) return { created: 0, skipped: 0 };

    return this.emit({
      key: ReminderKey.DUE_CALLBACKS,
      now,
      candidates: await this.assignedCandidates(grouped),
      titleTemplate: 'Rappels à passer',
      bodyTemplate: 'Vous avez {{nombre}} rappel(s) à passer aujourd’hui, retards compris.',
      route: '/phase2/callbacks',
      category: NotificationCategory.RAPPEL,
    });
  }

  /**
   * Compte rendu de fin de journée.
   *
   * Les chiffres viennent de `GET /v1/supervision/activite`, qui compte sur la
   * date de l'ACTE et non sur celle de la fiche : un appel passé hors ligne
   * hier et remonté ce matin reste dans la journée d'hier. Les recopier ici
   * ferait deux comptages différents du même travail.
   */
  @Cron(DAILY_REPORT_CRON, {
    name: 'cpi.notifications.daily-report',
    timeZone: env.BUSINESS_TIME_ZONE,
  })
  async sendDailyReport(now: Date = new Date()): Promise<ReminderRunDto> {
    if (isOpenApiGeneration()) return { created: 0, skipped: 0 };
    if (!this.config.NOTIFICATIONS_DAILY_REPORT_ENABLED) return { created: 0, skipped: 0 };

    const day = periodFor(now, this.config.BUSINESS_TIME_ZONE);
    const activity = await this.activity.activite({ actFrom: day, actTo: day });

    const [honored, overdue] = await Promise.all([
      this.prisma.scheduledCallback.count({
        where: {
          status: ScheduledCallbackStatus.DONE,
          updatedAt: { gte: inclusiveDateFrom(day), lte: inclusiveDateTo(day) },
        },
      }),
      this.prisma.scheduledCallback.count({
        where: {
          status: ScheduledCallbackStatus.PENDING,
          scheduledAt: { lte: now },
        },
      }),
    ]);

    const total = (pick: (row: (typeof activity.items)[number]) => number): number =>
      activity.items.reduce((sum, row) => sum + pick(row), 0);

    const actifs = new Set(activity.items.map((row) => row.teleconseillerId));
    const muets = activity.teleconseillers
      .filter((row) => row.isActive && !actifs.has(row.id))
      .map((row) => row.fullName);

    return this.emit({
      key: ReminderKey.DAILY_REPORT,
      now,
      candidates: await this.roleAudience([Role.ADMIN, Role.SUPERVISEUR, Role.DIRECTION], {
        jour: day,
        appels: String(total((row) => row.calls)),
        methodes: String(total((row) => row.methodObtained)),
        injoignables: String(total((row) => row.unreachable)),
        fauxNumeros: String(total((row) => row.wrongNumber)),
        prospects: String(total((row) => row.prospectsCreated)),
        rappelsHonores: String(honored),
        rappelsEnRetard: String(overdue),
        sansActe: muets.length ? muets.join(', ') : 'personne',
      }),
      titleTemplate: 'Compte rendu du {{jour}}',
      bodyTemplate:
        '{{appels}} appel(s) passé(s) : {{methodes}} méthode(s) obtenue(s), ' +
        '{{injoignables}} NRP ou injoignable(s), {{fauxNumeros}} faux numéro(s).\n' +
        'Rappels : {{rappelsHonores}} honoré(s) dans la journée, {{rappelsEnRetard}} ' +
        'en retard sur l’heure promise.\n' +
        '{{prospects}} prospect(s) saisi(s).\n' +
        'Téléconseillers sans acte aujourd’hui : {{sansActe}}.',
      route: '/supervision',
      category: NotificationCategory.ANNONCE,
    });
  }

  private async assignedCandidates(
    groups: readonly { assignedToId: string; _count: { _all: number } }[],
  ): Promise<ReminderCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: groups.map((group) => group.assignedToId) },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    return groups
      .filter((group) => nameById.has(group.assignedToId))
      .map((group) => ({
        userId: group.assignedToId,
        fullName: nameById.get(group.assignedToId) ?? '',
        variables: {
          nom: nameById.get(group.assignedToId) ?? '',
          nombre: String(group._count._all),
        },
      }));
  }

  async remindBankCasesPending(now: Date = new Date()): Promise<ReminderRunDto> {
    if (!this.config.NOTIFICATIONS_BANK_PENDING_ENABLED) return { created: 0, skipped: 0 };

    const days = this.config.NOTIFICATIONS_BANK_PENDING_DAYS;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const total = await this.prisma.bankCase.count({
      where: {
        deletedAt: null,
        currentStage: { type: BankStageType.OPEN },
        createdAt: { lte: cutoff },
      },
    });
    if (!total) return { created: 0, skipped: 0 };

    return this.emit({
      key: ReminderKey.BANK_CASES_PENDING,
      now,
      candidates: await this.roleAudience([Role.BANQUE_FINANCE], {
        nombre: String(total),
        jours: String(days),
      }),
      titleTemplate: 'Dossiers en attente',
      bodyTemplate:
        '{{nombre}} dossier(s) sont ouverts depuis plus de {{jours}} jour(s) et attendent une décision.',
      route: '/dossiers',
      category: NotificationCategory.RAPPEL,
    });
  }

  async remindBankCasesStale(now: Date = new Date()): Promise<ReminderRunDto> {
    if (!this.config.NOTIFICATIONS_BANK_STALE_ENABLED) return { created: 0, skipped: 0 };

    const days = this.config.NOTIFICATIONS_BANK_STALE_DAYS;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const total = await this.prisma.bankCase.count({
      where: {
        deletedAt: null,
        currentStage: { type: BankStageType.OPEN },
        createdAt: { lte: cutoff },
        transitions: { none: { createdAt: { gt: cutoff } } },
      },
    });
    if (!total) return { created: 0, skipped: 0 };

    return this.emit({
      key: ReminderKey.BANK_CASES_STALE,
      now,
      candidates: await this.roleAudience([Role.BANQUE_FINANCE], {
        nombre: String(total),
        jours: String(days),
      }),
      titleTemplate: 'Dossiers sans mouvement',
      bodyTemplate:
        "{{nombre}} dossier(s) n'ont enregistré aucun mouvement depuis {{jours}} jour(s).",
      route: '/dossiers',
      category: NotificationCategory.RAPPEL,
    });
  }

  /**
   * Le téléphone a vu un appel que personne n'a consigné : l'encadrement doit
   * l'apprendre le jour même, pas au relevé du mois.
   *
   * REGROUPÉ PAR TRANCHE DE 30 MINUTES. Une session d'appels non consignés en
   * produit une dizaine ; une alerte par appel noierait la boîte et ferait
   * cesser la lecture. La tranche sert de `period`, et l'index unique
   * `(reminderKey, period)` rend le regroupement atomique entre deux poussées
   * simultanées du même téléphone.
   */
  async alerterAppelsNonConsignes(
    performedById: string,
    detectionIds: readonly string[],
    now: Date = new Date(),
  ): Promise<number> {
    if (!detectionIds.length) return 0;

    const detection = await this.prisma.deviceCallDetection.findFirst({
      where: { id: { in: [...detectionIds] }, performedById, attemptId: null },
      orderBy: { deviceCallAt: 'desc' },
      select: {
        deviceCallType: true,
        deviceCallAt: true,
        performedBy: { select: { fullName: true } },
        representant: { select: { fullName: true } },
        prospect: { select: { nom: true, prenom: true } },
      },
    });
    if (!detection) return 0;

    const destinataires = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.SUPERVISEUR, Role.DIRECTION] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!destinataires.length) return 0;

    const { fiche, type } = describeUnloggedCall(detection);
    const heure = new Intl.DateTimeFormat('fr-FR', {
      timeZone: this.config.BUSINESS_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(detection.deviceCallAt);

    const id = uuidv7();
    const reminderKey = `${ReminderKey.UNLOGGED_CALL}:${performedById}`;
    const period = trancheDe(now);

    await this.prisma.notification.createMany({
      data: [
        {
          id,
          title: 'Appel non consigné',
          body: `${detection.performedBy.fullName} : appel ${type} avec ${fiche || 'une fiche'} à ${heure}, non consigné.`,
          category: NotificationCategory.ANNONCE,
          route: '/supervision?volet=activite',
          audience: NotificationAudience.USERS,
          audienceUserIds: destinataires.map((row) => row.id),
          status: NotificationStatus.SENDING,
          reminderKey,
          period,
        },
      ],
      skipDuplicates: true,
    });

    const present = await this.prisma.notification.findFirst({
      where: { reminderKey, period },
      select: { id: true },
    });
    if (present?.id !== id) return 0;

    await this.prisma.notificationDelivery.createMany({
      data: destinataires.map((row) => ({
        notificationId: id,
        userId: row.id,
        status: NotificationDeliveryStatus.PENDING,
        reminderKey: ReminderKey.UNLOGGED_CALL,
        period,
      })),
      skipDuplicates: true,
    });
    await this.notifications.dispatchMany([id], now);
    return 1;
  }

  private async roleAudience(
    roles: readonly Role[],
    variables: Record<string, string>,
  ): Promise<ReminderCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [...roles] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, fullName: true },
    });

    return users.map((user) => ({
      userId: user.id,
      fullName: user.fullName,
      variables: { ...variables, nom: user.fullName },
    }));
  }

  /**
   * Écrit toute la vague, puis l'expédie, en un nombre CONSTANT de requêtes.
   *
   * L'IDEMPOTENCE RESTE PORTÉE PAR L'INDEX UNIQUE `(reminderKey, period)`, elle
   * ne se lit simplement plus dans une violation P2002 attrapée trois cents
   * fois. Les identifiants sont tirés ici, avant l'écriture ; la relecture qui
   * suit rend l'identifiant réellement en base pour chaque clé, et il suffit de
   * le comparer au nôtre pour savoir si cette ligne est de ce passage-ci
   * (« créée ») ou d'un passage antérieur (« déjà présente »). Une seule
   * requête, et la réponse reste juste même si un second processus écrit dans
   * l'intervalle.
   */
  private async emit(input: {
    key: ReminderKeyValue;
    now: Date;
    candidates: readonly ReminderCandidate[];
    titleTemplate: string;
    bodyTemplate: string;
    route: string;
    category: NotificationCategory;
  }): Promise<ReminderRunDto> {
    const period = periodFor(input.now, this.config.BUSINESS_TIME_ZONE);
    if (!input.candidates.length) return { created: 0, skipped: 0 };

    const wave = input.candidates.map((candidate) => {
      const rendered = renderNotification(
        input.titleTemplate,
        input.bodyTemplate,
        candidate.variables,
      );
      return {
        id: uuidv7(),
        userId: candidate.userId,
        reminderKey: `${input.key}:${candidate.userId}`,
        title: rendered.title,
        body: rendered.body,
      };
    });

    await this.prisma.notification.createMany({
      data: wave.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: input.category,
        route: input.route,
        audience: NotificationAudience.USERS,
        audienceUserIds: [row.userId],
        status: NotificationStatus.SENDING,
        reminderKey: row.reminderKey,
        period,
      })),
      skipDuplicates: true,
    });

    const present = await this.prisma.notification.findMany({
      where: { reminderKey: { in: wave.map((row) => row.reminderKey) }, period },
      select: { id: true, reminderKey: true },
    });
    const idByKey = new Map(present.map((row) => [row.reminderKey, row.id]));

    const created = wave.filter((row) => idByKey.get(row.reminderKey) === row.id);
    const skipped = wave.filter((row) => idByKey.get(row.reminderKey) !== row.id);

    if (created.length) {
      await this.prisma.notificationDelivery.createMany({
        data: created.map((row) => ({
          notificationId: row.id,
          userId: row.userId,
          status: NotificationDeliveryStatus.PENDING,
          reminderKey: input.key,
          period,
        })),
        skipDuplicates: true,
      });

      await this.notifications.dispatchMany(
        created.map((row) => row.id),
        input.now,
      );
    }

    if (skipped.length) {
      await this.retryStalled(
        input.key,
        skipped.map((row) => row.userId),
        period,
        input.now,
      );
    }

    this.logger.log(
      `Rappel ${input.key} (${period}) : ${String(created.length)} émis, ` +
        `${String(skipped.length)} déjà présents.`,
    );
    return { created: created.length, skipped: skipped.length };
  }

  private async retryStalled(
    key: ReminderKeyValue,
    userIds: readonly string[],
    period: string,
    now: Date,
  ): Promise<void> {
    const stalled = await this.prisma.notificationDelivery.findMany({
      where: {
        reminderKey: key,
        userId: { in: [...userIds] },
        period,
        status: NotificationDeliveryStatus.PENDING,
        error: DELIVERY_RETRY_ERROR,
      },
      select: { notificationId: true },
    });
    if (!stalled.length) return;

    try {
      const summaries = await this.notifications.dispatchMany(
        stalled.map((row) => row.notificationId),
        now,
      );
      const retried = [...summaries.values()].filter((summary) => summary.claimed).length;
      if (retried) {
        this.logger.log(
          `Rappel ${key} (${period}) : ${String(retried)} nouvelle(s) tentative(s) d'envoi.`,
        );
      } else {
        this.logger.debug(
          `Rappel ${key} (${period}) : envois tenus par un autre passage, reprise laissée au bail.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Rappel ${key} (${period}) : réessai impossible (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }
}
