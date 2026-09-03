import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  PRESENCE_ONLINE_WINDOW_MINUTES,
  countByPresence,
  lastSeenAt,
  presenceOf,
  type ActivitySignals,
} from './presence.js';
import type { SupervisedUserDto, SupervisionDto } from './supervision.dto.js';

/**
 * Supervision des comptes.
 *
 * AUCUNE colonne n'a été ajoutée à `users` pour cet écran, et c'est délibéré.
 * Un `lastRequestAt` sur `users` coûterait une écriture par appel d'API sur la
 * table la plus lue de la base. Le battement de cœur vit donc dans sa propre
 * table, étroite et sans index secondaire (voir `agent_heartbeats`).
 *
 * Un agrégat par requête, aucune boucle par utilisateur : sur cinquante
 * comptes, un `findMany` par compte ferait trois cents allers-retours pour un
 * écran qui se rafraîchit toutes les quinze secondes.
 */

/**
 * Les deux rôles supervisés. L'ADMIN se supervise dans le miroir, et le
 * SUPERVISEUR avec lui : la présence se lit sur des lots de synchronisation et
 * des tentatives d'appel, qu'aucun des deux ne produit.
 */
const SUPERVISED_ROLES: readonly Role[] = [Role.COMMERCIAL, Role.BANQUE_FINANCE];

/** Durée de vie d'une famille de jetons : au-delà, un compte est dormant quoi qu'il arrive. */
const ACTIVITY_WINDOW_DAYS = 31;

/** `{ userId → date }`, à partir d'un `groupBy` Prisma. */
function toDateMap<K extends string>(
  rows: readonly ({ [key in K]: string } & { _max: { [key: string]: Date | null } })[],
  key: K,
  field: string,
): Map<string, Date> {
  const map = new Map<string, Date>();
  for (const row of rows) {
    const value = row._max[field];
    if (value instanceof Date) map.set(row[key], value);
  }
  return map;
}

/** La plus tardive de deux dates, l'une ou l'autre pouvant manquer. */
function latest(a: Date | undefined, b: Date | undefined): Date | null {
  if (a === undefined) return b ?? null;
  if (b === undefined) return a;
  return a > b ? a : b;
}

const optionalDate = (value: Date | null | undefined): Date | undefined => value ?? undefined;
const isoOrNull = (value: Date | null | undefined): string | null => value?.toISOString() ?? null;

interface CallMetricsRow {
  userId: string;
  calls: number;
  firstCallAt: Date;
  medianGapSeconds: number | null;
  medianUploadLagSeconds: number | null;
}

@Injectable()
export class SupervisionService {
  private readonly logger = new Logger(SupervisionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<SupervisionDto> {
    const now = new Date();
    const since = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 86_400_000);
    // Dakar est à UTC+00:00 toute l'année : la journée civile commence au
    // minuit UTC.
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [
      users,
      sessions,
      syncs,
      prospectCalls,
      representativeCalls,
      transitions,
      heartbeats,
      activityDays,
      callMetrics,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: { in: [...SUPERVISED_ROLES] },
          deletedAt: null,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
        orderBy: [{ fullName: 'asc' }],
      }),

      /**
       * Familles de jetons ENCORE VIVANTES. Le filtre porte les deux
       * conditions : `revokedAt: null` élimine les jetons déjà tournés ou
       * révoqués, `expiresAt` élimine les familles mortes de vieillesse, un
       * compte inactif depuis trente et un jours garderait sinon une ligne non
       * révoquée et serait annoncé « en session ».
       */
      this.prisma.refreshToken.groupBy({
        by: ['userId'],
        where: { revokedAt: null, expiresAt: { gt: now } },
        _max: { createdAt: true },
        _count: { _all: true },
      }),

      this.prisma.syncBatch.groupBy({
        by: ['userId'],
        _max: { createdAt: true },
      }),

      this.prisma.callAttempt.groupBy({
        by: ['performedById'],
        where: { createdAt: { gte: since } },
        _max: { createdAt: true },
      }),

      this.prisma.repCallAttempt.groupBy({
        by: ['performedById'],
        where: { createdAt: { gte: since } },
        _max: { createdAt: true },
      }),

      this.prisma.bankCaseTransition.groupBy({
        by: ['performedById'],
        where: { createdAt: { gte: since } },
        _max: { createdAt: true },
      }),

      // Une ligne par compte, jamais davantage : la table entière tient dans la
      // liste ci-dessus, et la filtrer coûterait plus que la lire.
      this.prisma.agentHeartbeat.findMany({
        select: {
          userId: true,
          lastPullAt: true,
          lastPushAt: true,
          pendingOps: true,
          appVersion: true,
        },
      }),
      this.prisma.agentActivityDay.findMany({
        where: { day: dayStart },
        select: { userId: true, firstSeenAt: true, lastSeenAt: true, activeSeconds: true },
      }),

      // La cadence complète la présence, elle ne la porte pas : une requête
      // en échec vide les colonnes de rendement sans effacer l'écran.
      this.callMetricsToday(dayStart).catch((error: unknown) => {
        this.logger.warn(`métriques d'appel du jour indisponibles: ${String(error)}`);
        return [] as CallMetricsRow[];
      }),
    ]);

    const tokenAt = toDateMap(sessions, 'userId', 'createdAt');
    const sessionCounts = new Map(sessions.map((row) => [row.userId, row._count._all]));
    const syncAt = toDateMap(syncs, 'userId', 'createdAt');
    const prospectCallAt = toDateMap(prospectCalls, 'performedById', 'createdAt');
    const representativeCallAt = toDateMap(representativeCalls, 'performedById', 'createdAt');
    const transitionAt = toDateMap(transitions, 'performedById', 'createdAt');
    const beatOf = new Map(heartbeats.map((row) => [row.userId, row]));
    const activityOf = new Map(activityDays.map((row) => [row.userId, row]));
    const metricsOf = new Map(callMetrics.map((row) => [row.userId, row]));

    const rows = users.map((user): SupervisedUserDto => {
      const beat = beatOf.get(user.id) ?? {
        lastPushAt: null,
        lastPullAt: null,
        pendingOps: null,
        appVersion: null,
      };
      const pushedAt = latest(syncAt.get(user.id), optionalDate(beat.lastPushAt));
      const activity = activityOf.get(user.id);
      const metrics = metricsOf.get(user.id);

      const signals: ActivitySignals = {
        isActive: user.isActive,
        hasLiveSession: tokenAt.has(user.id),
        lastLoginAt: user.lastLoginAt,
        lastTokenAt: tokenAt.get(user.id) ?? null,
        lastPresenceAt: activity?.lastSeenAt ?? null,
        // Un pull ne laisse aucune autre trace : sans lui, un appareil ouvert
        // qui n'a rien à remonter passe pour absent pendant des heures.
        lastSyncAt: latest(optionalDate(pushedAt), optionalDate(beat.lastPullAt)),
        // Un téléconseiller écrit des tentatives d'appel, un agent des
        // transitions de dossier. On prend la plus récente des deux plutôt que
        // de brancher sur le rôle : un compte peut changer de rôle, son
        // historique ne change pas.
        lastWriteAt: latest(
          latest(prospectCallAt.get(user.id), representativeCallAt.get(user.id)) ?? undefined,
          transitionAt.get(user.id),
        ),
      };

      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        presence: presenceOf(signals, now),
        hasLiveSession: signals.hasLiveSession,
        sessionCount: sessionCounts.get(user.id) ?? 0,
        lastSeenAt: isoOrNull(lastSeenAt(signals)),
        lastLoginAt: isoOrNull(signals.lastLoginAt),
        lastSyncAt: isoOrNull(pushedAt),
        lastPullAt: isoOrNull(beat.lastPullAt),
        pendingOps: beat.pendingOps,
        appVersion: beat.appVersion,
        lastWriteAt: isoOrNull(signals.lastWriteAt),
        activeSecondsToday: activity?.activeSeconds ?? 0,
        firstSeenToday: isoOrNull(activity?.firstSeenAt),
        callsToday: metrics?.calls ?? 0,
        medianGapSeconds: metrics?.medianGapSeconds ?? null,
        medianUploadLagSeconds: metrics?.medianUploadLagSeconds ?? null,
        firstCallAt: isoOrNull(metrics?.firstCallAt),
      };
    });

    const counts = countByPresence(rows.map((row) => row.presence));

    return {
      observedAt: now.toISOString(),
      onlineWindowMinutes: PRESENCE_ONLINE_WINDOW_MINUTES,
      teleconseillers: rows.filter((row) => row.role === Role.COMMERCIAL),
      finances: rows.filter((row) => row.role === Role.BANQUE_FINANCE),
      counts: { online: counts.ONLINE, recent: counts.RECENT, away: counts.AWAY },
    };
  }

  /**
   * Rendement du jour, une ligne par compte ayant appelé. Le tri, l'écart entre
   * deux appels et les médianes se font en base : rapatrier les tentatives pour
   * les trier en JavaScript coûterait une lecture complète toutes les quinze
   * secondes.
   */
  private callMetricsToday(dayStart: Date): Promise<CallMetricsRow[]> {
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const roles = Prisma.join([...SUPERVISED_ROLES]);
    const dayWindow = Prisma.sql`"clientCreatedAt" >= ${dayStart} AND "clientCreatedAt" < ${dayEnd}`;

    return this.prisma.$queryRaw<CallMetricsRow[]>`
      WITH attempts AS (
        SELECT "performedById" AS "userId", "clientCreatedAt", "createdAt"
        FROM "call_attempts" WHERE ${dayWindow}
        UNION ALL
        SELECT "performedById", "clientCreatedAt", "createdAt"
        FROM "rep_call_attempts" WHERE ${dayWindow}
      ),
      paced AS (
        SELECT
          a.*,
          a."clientCreatedAt" - LAG(a."clientCreatedAt")
            OVER (PARTITION BY a."userId" ORDER BY a."clientCreatedAt") AS gap
        FROM attempts a
        JOIN "users" u ON u."id" = a."userId" AND u."deletedAt" IS NULL
        WHERE u."role"::text IN (${roles})
      )
      SELECT
        "userId",
        COUNT(*)::int         AS calls,
        MIN("clientCreatedAt") AS "firstCallAt",
        ROUND(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM gap)
        ))::int AS "medianGapSeconds",
        ROUND(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM ("createdAt" - "clientCreatedAt"))
        ))::int AS "medianUploadLagSeconds"
      FROM paced
      GROUP BY "userId"
    `;
  }
}
