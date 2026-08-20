import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BankStageType,
  CallTaskStatus,
  CampaignStatus,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Prisma,
  Role,
  ScheduledCallbackStatus,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { SupervisionActivityService } from '../analytics/supervision.service.js';
import { dakarDayEnd } from '../callbacks/callbacks.service.js';
import { isOpenApiGeneration } from '../../env.js';
import { DELIVERY_RETRY_ERROR, NotificationsService } from './notifications.service.js';
import { SENDING_LEASE_MS } from './dispatch-claim.js';
import { readNotificationsEnv } from './notifications.env.js';
import { renderNotification } from './template.js';
import type { ReminderRunDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

const env = readNotificationsEnv();

export const remindersCron = (at: string): string => {
  const [hours, minutes] = at.split(':');
  return `0 ${minutes ?? '0'} ${hours ?? '8'} * * *`;
};

export const REMINDERS_CRON = remindersCron(env.NOTIFICATIONS_REMINDERS_AT);

export const DAILY_REPORT_CRON = remindersCron(env.NOTIFICATIONS_DAILY_REPORT_AT);

export { SENDING_LEASE_MS };

export const ReminderKey = {
  OPEN_CALL_TASKS: 'open-call-tasks',
  OPEN_REP_CALL_TASKS: 'open-rep-call-tasks',
  BANK_CASES_PENDING: 'bank-cases-pending',
  BANK_CASES_STALE: 'bank-cases-stale',
  DUE_CALLBACKS: 'due-callbacks',
  DAILY_REPORT: 'daily-report',
} as const;

export type ReminderKeyValue = (typeof ReminderKey)[keyof typeof ReminderKey];

export const periodFor = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

interface OpenTaskDelegate {
  groupBy(args: {
    by: ['assignedToId'];
    where: Record<string, unknown>;
    _count: { _all: true };
  }): Promise<{ assignedToId: string; _count: { _all: number } }[]>;
}

interface ReminderCandidate {
  readonly userId: string;
  readonly fullName: string;
  readonly variables: Record<string, string>;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly config = readNotificationsEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly demo: DemoVisibilityService,
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
        ...demoScope(await this.demo.enabled()),
      },
      select: { id: true },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });

    let dispatched = 0;
    for (const row of due) {
      try {
        if ((await this.notifications.dispatch(row.id, now)).claimed) dispatched += 1;
      } catch (error) {
        this.logger.error(
          `Expédition programmée ${row.id} en échec : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (dispatched)
      this.logger.log(`${String(dispatched)} notification(s) programmée(s) expédiée(s).`);
    return dispatched;
  }

  @Cron(REMINDERS_CRON, { name: 'cpi.notifications.reminders', timeZone: env.BUSINESS_TIME_ZONE })
  async runAll(now: Date = new Date()): Promise<ReminderRunDto> {
    if (isOpenApiGeneration()) return { created: 0, skipped: 0 };
    if (!this.config.NOTIFICATIONS_REMINDERS_ENABLED) {
      this.logger.debug('Rappels désactivés (NOTIFICATIONS_REMINDERS_ENABLED=false).');
      return { created: 0, skipped: 0 };
    }

    const tasks = await this.remindOpenCallTasks(now);
    const repTasks = await this.remindOpenRepCallTasks(now);
    const callbacks = await this.remindDueCallbacks(now);
    const bankPending = await this.remindBankCasesPending(now);
    const bankStale = await this.remindBankCasesStale(now);

    const runs = [tasks, repTasks, callbacks, bankPending, bankStale];
    return {
      created: runs.reduce((total, run) => total + run.created, 0),
      skipped: runs.reduce((total, run) => total + run.skipped, 0),
    };
  }

  async remindOpenCallTasks(now: Date = new Date()): Promise<ReminderRunDto> {
    return this.remindOpenTasks({
      now,
      delegate: this.prisma.callTask,
      key: ReminderKey.OPEN_CALL_TASKS,
      title: 'Appels en attente',
      body: 'Il vous reste {{nombre}} fiche(s) à appeler dans la campagne en cours.',
      route: '/phase2',
    });
  }

  async remindOpenRepCallTasks(now: Date = new Date()): Promise<ReminderRunDto> {
    return this.remindOpenTasks({
      now,
      delegate: this.prisma.repCallTask,
      key: ReminderKey.OPEN_REP_CALL_TASKS,
      title: 'Représentants à rappeler',
      body: 'Il vous reste {{nombre}} représentant(s) à appeler dans la campagne en cours.',
      route: '/rep-campaigns',
    });
  }

  private async remindOpenTasks(options: {
    now: Date;
    delegate: OpenTaskDelegate;
    key: ReminderKeyValue;
    title: string;
    body: string;
    route: string;
  }): Promise<ReminderRunDto> {
    const { now, delegate, key, title, body, route } = options;
    if (!this.config.NOTIFICATIONS_OPEN_TASKS_ENABLED) return { created: 0, skipped: 0 };

    const grouped = await delegate.groupBy({
      by: ['assignedToId'],
      where: {
        status: CallTaskStatus.OPEN,
        isActive: true,
        campaign: { status: CampaignStatus.ACTIVE },
        ...demoScope(false),
      },
      _count: { _all: true },
    });

    const eligible = grouped.filter(
      (group) => group._count._all >= this.config.NOTIFICATIONS_OPEN_TASKS_MIN,
    );
    if (!eligible.length) return { created: 0, skipped: 0 };

    return this.emit({
      key,
      now,
      candidates: await this.assignedCandidates(eligible),
      titleTemplate: title,
      bodyTemplate: body,
      route,
      category: NotificationCategory.CAMPAGNE,
    });
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
        ...demoScope(false),
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
          ...demoScope(false),
        },
      }),
      this.prisma.scheduledCallback.count({
        where: {
          status: ScheduledCallbackStatus.PENDING,
          scheduledAt: { lte: now },
          ...demoScope(false),
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
        ...demoScope(false),
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
        ...demoScope(false),
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
        ...demoScope(false),
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

  private async roleAudience(
    roles: readonly Role[],
    variables: Record<string, string>,
  ): Promise<ReminderCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [...roles] },
        isActive: true,
        deletedAt: null,
        ...demoScope(false),
      },
      select: { id: true, fullName: true },
    });

    return users.map((user) => ({
      userId: user.id,
      fullName: user.fullName,
      variables: { ...variables, nom: user.fullName },
    }));
  }

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
    let created = 0;
    let skipped = 0;

    for (const candidate of input.candidates) {
      const rendered = renderNotification(
        input.titleTemplate,
        input.bodyTemplate,
        candidate.variables,
      );

      try {
        const notification = await this.prisma.notification.create({
          data: {
            title: rendered.title,
            body: rendered.body,
            category: input.category,
            route: input.route,
            audience: NotificationAudience.USERS,
            audienceUserIds: [candidate.userId],
            status: NotificationStatus.SENDING,
            reminderKey: `${input.key}:${candidate.userId}`,
            period,
            isDemo: false,
            deliveries: {
              create: [
                {
                  userId: candidate.userId,
                  status: NotificationDeliveryStatus.PENDING,
                  reminderKey: input.key,
                  period,
                  isDemo: false,
                },
              ],
            },
          },
          select: { id: true },
        });

        await this.notifications.dispatch(notification.id, input.now);
        created += 1;
      } catch (error) {
        if (isUniqueViolation(error)) {
          skipped += 1;
          await this.retryStalled(input.key, candidate.userId, period, input.now);
          continue;
        }
        throw error;
      }
    }

    if (created || skipped) {
      this.logger.log(
        `Rappel ${input.key} (${period}) : ${String(created)} émis, ${String(skipped)} déjà présents.`,
      );
    }
    return { created, skipped };
  }

  private async retryStalled(
    key: ReminderKeyValue,
    userId: string,
    period: string,
    now: Date,
  ): Promise<void> {
    const stalled = await this.prisma.notificationDelivery.findFirst({
      where: {
        reminderKey: key,
        userId,
        period,
        status: NotificationDeliveryStatus.PENDING,
        error: DELIVERY_RETRY_ERROR,
        ...demoScope(false),
      },
      select: { notificationId: true },
    });
    if (!stalled) return;

    try {
      const retried = await this.notifications.dispatch(stalled.notificationId, now);
      if (retried.claimed) {
        this.logger.log(`Rappel ${key} (${period}) : nouvelle tentative d'envoi pour ${userId}.`);
      } else {
        this.logger.debug(
          `Rappel ${key} (${period}) : envoi tenu par un autre passage, reprise laissée au bail.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Rappel ${key} (${period}) : réessai impossible pour ${userId} (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export const REMINDER_ROLE_DEFAULT = Role.COMMERCIAL;
