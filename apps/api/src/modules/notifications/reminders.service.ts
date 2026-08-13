import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CallTaskStatus,
  CampaignStatus,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Prisma,
  Role,
} from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { isOpenApiGeneration } from '../../env.js';
import { NotificationsService } from './notifications.service.js';
import { readNotificationsEnv } from './notifications.env.js';
import { renderNotification } from './template.js';
import type { ReminderRunDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';

/**
 * Rappels programmés.
 *
 * ═══ L'IDEMPOTENCE EST LA SEULE PROPRIÉTÉ QUI COMPTE ICI ═══
 *
 * Un rappel n'est pas un envoi ordinaire : il se déclenche tout seul, la nuit,
 * sans personne pour constater qu'il est parti deux fois. Trois situations
 * ordinaires le feraient partir en double :
 *
 *   · un redémarrage de l'API juste après l'heure du tick ;
 *   · deux instances derrière un répartiteur de charge, qui tiquent ensemble ;
 *   · un déploiement qui rejoue le tick sur la nouvelle instance.
 *
 * La parade n'est PAS un verrou applicatif ni un « j'ai déjà tourné » en
 * mémoire — les deux disparaissent au redémarrage, c'est-à-dire exactement au
 * moment où on en a besoin. C'est une CONTRAINTE UNIQUE en base :
 *
 *   Notification         `(reminderKey, period)`
 *   NotificationDelivery `(reminderKey, userId, period)`
 *
 * La seconde tentative se heurte à l'index, lève P2002, et est comptée comme
 * ignorée. La garantie tient donc même si deux processus écrivent à la
 * milliseconde près, parce que c'est PostgreSQL qui arbitre, pas notre code.
 */

const env = readNotificationsEnv();

/**
 * Expression cron construite à L'IMPORT depuis l'environnement.
 *
 * Les décorateurs sont évalués une fois, au chargement du module : leur
 * argument ne peut pas venir d'une injection. Même contrainte, même solution
 * que `SYNC_MAX_BATCH_SIZE` dans le module de synchronisation.
 */
export const remindersCron = (at: string): string => {
  const [hours, minutes] = at.split(':');
  return `0 ${minutes ?? '0'} ${hours ?? '8'} * * *`;
};

export const REMINDERS_CRON = remindersCron(env.NOTIFICATIONS_REMINDERS_AT);

/** Familles de rappel. Ces chaînes sont persistées : les renommer casse l'idempotence. */
export const ReminderKey = {
  UNSYNCED_ENTRIES: 'unsynced-entries',
  OPEN_CALL_TASKS: 'open-call-tasks',
} as const;

export type ReminderKeyValue = (typeof ReminderKey)[keyof typeof ReminderKey];

/**
 * Période d'un rappel : la JOURNÉE CIVILE dans le fuseau métier.
 *
 * `Africa/Dakar` et non UTC : un rappel de 8 h du matin à Dakar tombe un jour
 * plus tôt en UTC pendant une partie de la nuit. Découper les périodes en UTC
 * ferait donc, deux fois par an et à chaque tick nocturne, considérer deux
 * envois du même matin comme appartenant à deux jours différents.
 */
export const periodFor = (date: Date, timeZone: string): string =>
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

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private readonly config = readNotificationsEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly demo: DemoVisibilityService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Tick d'expédition des envois programmés
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Expédie les notifications dont l'heure est venue.
   *
   * LE VERROU EST UN `updateMany` CONDITIONNEL, pas une lecture suivie d'une
   * écriture. `WHERE status = SCHEDULED` transforme la prise en charge en
   * comparaison-et-échange atomique : de deux instances qui voient la même
   * notification, une seule voit `count === 1` et travaille ; l'autre voit 0 et
   * passe son chemin. Sans ce `where`, les deux enverraient.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'cpi.notifications.due' })
  async dispatchDue(now: Date = new Date()): Promise<number> {
    if (isOpenApiGeneration()) return 0;

    const due = await this.prisma.notification.findMany({
      where: { status: NotificationStatus.SCHEDULED, scheduledFor: { lte: now } },
      select: { id: true },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });

    let dispatched = 0;
    for (const row of due) {
      const claimed = await this.prisma.notification.updateMany({
        where: { id: row.id, status: NotificationStatus.SCHEDULED },
        data: { status: NotificationStatus.SENDING },
      });
      if (claimed.count === 0) continue;

      try {
        await this.notifications.dispatch(row.id);
        dispatched += 1;
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

  // ───────────────────────────────────────────────────────────────────────────
  // Rappels récurrents
  // ───────────────────────────────────────────────────────────────────────────

  @Cron(REMINDERS_CRON, { name: 'cpi.notifications.reminders', timeZone: env.BUSINESS_TIME_ZONE })
  async runAll(now: Date = new Date()): Promise<ReminderRunDto> {
    if (isOpenApiGeneration()) return { created: 0, skipped: 0 };
    if (!this.config.NOTIFICATIONS_REMINDERS_ENABLED) {
      this.logger.debug('Rappels désactivés (NOTIFICATIONS_REMINDERS_ENABLED=false).');
      return { created: 0, skipped: 0 };
    }

    const unsynced = await this.remindUnsyncedEntries(now);
    const tasks = await this.remindOpenCallTasks(now);

    return {
      created: unsynced.created + tasks.created,
      skipped: unsynced.skipped + tasks.skipped,
    };
  }

  /**
   * Commerciaux dont l'appareil retient des écritures depuis plus de N jours.
   *
   * Le signal vient de l'APPAREIL (`pendingOps`/`pendingSince`, rapportés à
   * chaque enregistrement de jeton), et non d'une déduction serveur du type
   * « n'a rien poussé depuis N jours ». La déduction confondrait un commercial
   * en congé — qui n'a rien à envoyer — avec un téléphone qui retient une
   * journée de prospection, et réveillerait le premier tous les matins jusqu'à
   * ce qu'il coupe les notifications. Après quoi il ne verrait pas non plus
   * celles qui comptent.
   */
  async remindUnsyncedEntries(now: Date = new Date()): Promise<ReminderRunDto> {
    if (!this.config.NOTIFICATIONS_UNSYNCED_ENABLED) return { created: 0, skipped: 0 };

    const days = this.config.NOTIFICATIONS_UNSYNCED_DAYS;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const devices = await this.prisma.deviceToken.findMany({
      where: {
        revokedAt: null,
        pendingOps: { gt: 0 },
        pendingSince: { lte: cutoff },
        user: { isActive: true, deletedAt: null },
      },
      select: {
        userId: true,
        pendingOps: true,
        pendingSince: true,
        user: { select: { fullName: true } },
      },
    });

    // Un commercial peut avoir deux appareils. On retient le plus en retard :
    // c'est celui qui décrit le risque réel de perte.
    const worst = new Map<string, { fullName: string; pendingOps: number; pendingSince: Date }>();
    for (const device of devices) {
      if (!device.pendingSince) continue;
      const current = worst.get(device.userId);
      if (!current || device.pendingOps > current.pendingOps) {
        worst.set(device.userId, {
          fullName: device.user.fullName,
          pendingOps: device.pendingOps,
          pendingSince: device.pendingSince,
        });
      }
    }

    const candidates: ReminderCandidate[] = [...worst.entries()].map(([userId, row]) => ({
      userId,
      fullName: row.fullName,
      variables: {
        nom: row.fullName,
        nombre: String(row.pendingOps),
        jours: String(
          Math.max(1, Math.floor((now.getTime() - row.pendingSince.getTime()) / 86_400_000)),
        ),
      },
    }));

    return this.emit({
      key: ReminderKey.UNSYNCED_ENTRIES,
      now,
      candidates,
      titleTemplate: 'Saisies non synchronisées',
      bodyTemplate:
        '{{nombre}} saisie(s) attendent depuis {{jours}} jour(s) sur votre téléphone. Ouvrez CPI GO avec du réseau pour les envoyer.',
      // Écran de la file de synchronisation, celui que vise déjà la pastille
      // de l'AppBar.
      route: '/a-corriger',
      category: NotificationCategory.RAPPEL,
    });
  }

  /** Commerciaux avec des tâches d'appel encore ouvertes dans une campagne ACTIVE. */
  async remindOpenCallTasks(now: Date = new Date()): Promise<ReminderRunDto> {
    if (!this.config.NOTIFICATIONS_OPEN_TASKS_ENABLED) return { created: 0, skipped: 0 };

    // Lu une fois pour tout le passage de rappels : regrouper les taches avec
    // une visibilite et resoudre les destinataires avec une autre produirait
    // une relance adressee a personne.
    const demoEnabled = await this.demo.enabled();

    const grouped = await this.prisma.callTask.groupBy({
      by: ['assignedToId'],
      where: {
        status: CallTaskStatus.OPEN,
        isActive: true,
        campaign: { status: CampaignStatus.ACTIVE },
        ...demoScope(demoEnabled),
      },
      _count: { _all: true },
    });

    const eligible = grouped.filter(
      (group) => group._count._all >= this.config.NOTIFICATIONS_OPEN_TASKS_MIN,
    );
    if (!eligible.length) return { created: 0, skipped: 0 };

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: eligible.map((group) => group.assignedToId) },
        isActive: true,
        deletedAt: null,
        ...demoScope(demoEnabled),
      },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    const candidates: ReminderCandidate[] = eligible
      .filter((group) => nameById.has(group.assignedToId))
      .map((group) => ({
        userId: group.assignedToId,
        fullName: nameById.get(group.assignedToId) ?? '',
        variables: {
          nom: nameById.get(group.assignedToId) ?? '',
          nombre: String(group._count._all),
        },
      }));

    return this.emit({
      key: ReminderKey.OPEN_CALL_TASKS,
      now,
      candidates,
      titleTemplate: 'Appels en attente',
      bodyTemplate: 'Il vous reste {{nombre}} fiche(s) à appeler dans la campagne en cours.',
      route: '/phase2',
      category: NotificationCategory.CAMPAGNE,
    });
  }

  /**
   * Écrit un rappel par destinataire, puis l'expédie.
   *
   * UNE NOTIFICATION PAR PERSONNE, et non une seule pour tous : le texte porte
   * un compte personnel (« 12 fiches »), ce qu'une ligne partagée ne peut pas
   * faire. La `reminderKey` de la NOTIFICATION porte donc l'identifiant du
   * destinataire, tandis que celle de la LIVRAISON reste la famille nue — c'est
   * cette dernière qui porte la garantie demandée,
   * `(reminderKey, userId, period)`, indépendamment de la façon dont les
   * notifications sont regroupées.
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
            deliveries: {
              create: [
                {
                  userId: candidate.userId,
                  status: NotificationDeliveryStatus.PENDING,
                  reminderKey: input.key,
                  period,
                },
              ],
            },
          },
          select: { id: true },
        });

        await this.notifications.dispatch(notification.id);
        created += 1;
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Déjà émis pour cette personne et cette période. C'est le chemin
          // NORMAL après un redémarrage : ce n'est pas une anomalie.
          skipped += 1;
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
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** Réexporté pour les tests, qui composent des publics de rappel. */
export const REMINDER_ROLE_DEFAULT = Role.COMMERCIAL;
