import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { performanceScore } from './performance-score.js';
import {
  NOT_REACHED_OUTCOMES,
  REP_ARBITRAGE,
  REP_JOINT_OUTCOMES,
  REP_STATUT_JOIN,
} from '../analytics/pilotage.sql.js';
import type { WorkShiftDto } from '../analytics/supervision.dto.js';
import { DEFAULT_SHIFTS, WorkShiftsService } from '../analytics/work-shifts.service.js';
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

/** Au-delà, l'écart entre deux appels d'un même créneau devient du temps mort. */
const DEAD_GAP_SECONDS = 15 * 60;

function clockSeconds(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60;
}

/** Secondes de créneau déjà passées, bornées à zéro et à la durée du créneau. */
function elapsedInShifts(shifts: readonly WorkShiftDto[], now: Date): number {
  const clock = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return shifts.reduce((total, shift) => {
    const start = clockSeconds(shift.start);
    return total + Math.min(Math.max(clock - start, 0), clockSeconds(shift.end) - start);
  }, 0);
}

/** Une tranche compte dès que SON HEURE DE DÉBUT tombe dans un créneau. */
function slotInShifts(slot: Date, shifts: readonly WorkShiftDto[]): boolean {
  const start = slot.getUTCHours() * 3600;
  return shifts.some(
    (shift) => start >= clockSeconds(shift.start) && start < clockSeconds(shift.end),
  );
}

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
  firstCallAt: Date | null;
  lastCallAt: Date | null;
  reachedToday: number;
  qualifiedToday: number;
  repeatCalls: number;
  deadSeconds: number;
  deadGaps: number;
  medianGapSeconds: number | null;
  medianUploadLagSeconds: number | null;
}

/** Un compte qui n'a pas appelé aujourd'hui : des zéros et des null, jamais NaN. */
const AUCUN_APPEL: Omit<CallMetricsRow, 'userId'> = {
  calls: 0,
  firstCallAt: null,
  lastCallAt: null,
  reachedToday: 0,
  qualifiedToday: 0,
  repeatCalls: 0,
  deadSeconds: 0,
  deadGaps: 0,
  medianGapSeconds: null,
  medianUploadLagSeconds: null,
};

interface ActivitySlotRow {
  userId: string;
  slot: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  activeSeconds: number;
}

interface SlotTotals {
  active: number;
  inShifts: number;
  firstSeen: Date;
  lastSeen: Date;
}

/** Les tranches horaires du jour, repliées en un total par compte. */
function totalsBySlot(
  slots: readonly ActivitySlotRow[],
  shifts: readonly WorkShiftDto[],
): Map<string, SlotTotals> {
  const totalsOf = new Map<string, SlotTotals>();
  for (const slot of slots) {
    const inShifts = slotInShifts(slot.slot, shifts) ? slot.activeSeconds : 0;
    const totals = totalsOf.get(slot.userId);
    if (totals === undefined) {
      totalsOf.set(slot.userId, {
        active: slot.activeSeconds,
        inShifts,
        firstSeen: slot.firstSeenAt,
        lastSeen: slot.lastSeenAt,
      });
      continue;
    }
    totals.active += slot.activeSeconds;
    totals.inShifts += inShifts;
    if (slot.firstSeenAt < totals.firstSeen) totals.firstSeen = slot.firstSeenAt;
    if (slot.lastSeenAt > totals.lastSeen) totals.lastSeen = slot.lastSeenAt;
  }
  return totalsOf;
}

@Injectable()
export class SupervisionService {
  private readonly logger = new Logger(SupervisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workShifts: WorkShiftsService,
  ) {}

  async overview(): Promise<SupervisionDto> {
    const now = new Date();
    const since = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 86_400_000);
    // Dakar est à UTC+00:00 toute l'année : la journée civile commence au
    // minuit UTC.
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Lu avant le reste : les créneaux bornent le temps mort, donc la requête
    // de rendement, qui ne peut pas les attendre dans le même `Promise.all`.
    const shifts = await this.workShifts
      .get()
      .then((settings) => settings.shifts)
      .catch((error: unknown) => {
        this.logger.warn(`créneaux illisibles, valeurs par défaut: ${String(error)}`);
        return [...DEFAULT_SHIFTS];
      });

    const [
      users,
      sessions,
      syncs,
      prospectCalls,
      representativeCalls,
      transitions,
      heartbeats,
      activitySlots,
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
          journalAppelsAutorise: true,
        },
      }),
      this.prisma.agentActivitySlot.findMany({
        where: { slot: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } },
        select: {
          userId: true,
          slot: true,
          firstSeenAt: true,
          lastSeenAt: true,
          activeSeconds: true,
        },
      }),

      // La cadence complète la présence, elle ne la porte pas : une requête
      // en échec vide les colonnes de rendement sans effacer l'écran.
      this.callMetricsToday(dayStart, shifts).catch((error: unknown) => {
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
    const metricsOf = new Map(callMetrics.map((row) => [row.userId, row]));
    const activityOf = totalsBySlot(activitySlots, shifts);
    const shiftSecondsElapsed = elapsedInShifts(shifts, now);

    const rows = users.map((user): SupervisedUserDto => {
      const beat = beatOf.get(user.id) ?? {
        lastPushAt: null,
        lastPullAt: null,
        pendingOps: null,
        appVersion: null,
        journalAppelsAutorise: null,
      };
      const pushedAt = latest(syncAt.get(user.id), optionalDate(beat.lastPushAt));
      const activity = activityOf.get(user.id);
      const metrics = metricsOf.get(user.id) ?? AUCUN_APPEL;

      const signals: ActivitySignals = {
        isActive: user.isActive,
        hasLiveSession: tokenAt.has(user.id),
        lastLoginAt: user.lastLoginAt,
        lastTokenAt: tokenAt.get(user.id) ?? null,
        lastPresenceAt: activity?.lastSeen ?? null,
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
        journalAppelsAutorise: beat.journalAppelsAutorise ?? null,
        lastWriteAt: isoOrNull(signals.lastWriteAt),
        activeSecondsToday: activity?.active ?? 0,
        activeSecondsInShifts: activity?.inShifts ?? 0,
        firstSeenToday: isoOrNull(activity?.firstSeen),
        callsToday: metrics.calls,
        medianGapSeconds: metrics.medianGapSeconds,
        medianUploadLagSeconds: metrics.medianUploadLagSeconds,
        firstCallAt: isoOrNull(metrics.firstCallAt),
        lastCallAt: isoOrNull(metrics.lastCallAt),
        reachedToday: metrics.reachedToday,
        qualifiedToday: metrics.qualifiedToday,
        repeatCalls: metrics.repeatCalls,
        deadSeconds: metrics.deadSeconds,
        deadGaps: metrics.deadGaps,
        score: performanceScore({
          activeSecondsInShifts: activity?.inShifts ?? 0,
          shiftSecondsElapsed,
          calls: metrics.calls,
          reached: metrics.reachedToday,
          qualified: metrics.qualifiedToday,
          repeatCalls: metrics.repeatCalls,
          deadSeconds: metrics.deadSeconds,
        }),
      };
    });

    const counts = countByPresence(rows.map((row) => row.presence));

    return {
      observedAt: now.toISOString(),
      onlineWindowMinutes: PRESENCE_ONLINE_WINDOW_MINUTES,
      shiftSecondsElapsed,
      shifts,
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
   *
   * Les issues comptées reprennent celles de l'écran d'activité
   * (`analytics/supervision.service.ts`) : un prospect est joint sur toute issue
   * hors `NOT_REACHED_OUTCOMES`, un représentant sur `REP_JOINT_OUTCOMES`, et un
   * représentant n'est qualifié que sur sa DERNIÈRE réponse tranchée du jour.
   */
  private callMetricsToday(
    dayStart: Date,
    shifts: readonly WorkShiftDto[],
  ): Promise<CallMetricsRow[]> {
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const roles = Prisma.join([...SUPERVISED_ROLES]);
    const dayWindow = Prisma.sql`"clientCreatedAt" >= ${dayStart} AND "clientCreatedAt" < ${dayEnd}`;

    const clock = Prisma.sql`a."clientCreatedAt"::time`;
    const shiftOf = Prisma.sql`CASE ${Prisma.join(
      shifts.map(
        (shift) =>
          Prisma.sql`WHEN ${clock} >= ${shift.start}::time AND ${clock} < ${shift.end}::time THEN ${shift.key}::text`,
      ),
      ' ',
    )} END`;

    const deadGap = Prisma.sql`
      EXTRACT(EPOCH FROM p.gap) > ${DEAD_GAP_SECONDS} AND p."shift" = p."prevShift"
    `;

    return this.prisma.$queryRaw<CallMetricsRow[]>`
      WITH attempts AS (
        SELECT
          "performedById" AS "userId", "clientCreatedAt", "createdAt",
          'prospect' AS famille, "prospectId" AS cible,
          ("outcome" NOT IN ${NOT_REACHED_OUTCOMES})::int AS joint,
          ("outcome" = 'METHOD_OBTAINED')::int          AS qualifie
        FROM "call_attempts" WHERE ${dayWindow}
        UNION ALL
        SELECT
          "performedById", "clientCreatedAt", "createdAt",
          'representant', "representantId",
          ("outcome" IN ${REP_JOINT_OUTCOMES})::int, 0
        FROM "rep_call_attempts" WHERE ${dayWindow}
      ),
      situes AS (
        SELECT a.*, ${shiftOf} AS "shift"
        FROM attempts a
        JOIN "users" u ON u."id" = a."userId" AND u."deletedAt" IS NULL
        WHERE u."role"::text IN (${roles})
      ),
      paced AS (
        SELECT
          s.*,
          s."clientCreatedAt" - LAG(s."clientCreatedAt") OVER w AS gap,
          LAG(s."shift") OVER w                                 AS "prevShift"
        FROM situes s
        WINDOW w AS (PARTITION BY s."userId" ORDER BY s."clientCreatedAt")
      ),
      rappels AS (
        SELECT "userId", SUM(n - 1)::int AS repetitions
        FROM (
          SELECT "userId", famille, cible, COUNT(*)::int AS n
          FROM situes GROUP BY 1, 2, 3
        ) t
        GROUP BY 1
      ),
      -- Un représentant ne se qualifie qu'une fois : c'est sa dernière réponse
      -- du jour qui vaut, et elle revient à qui l'a obtenue.
      derniere_reponse AS (
        SELECT DISTINCT ON (rca."representantId")
          rca."performedById"                    AS "userId",
          (${REP_ARBITRAGE} = 'AMBASSADEUR')::int AS qualifie
        FROM "rep_call_attempts" rca
        ${REP_STATUT_JOIN}
        WHERE ${REP_ARBITRAGE} IS NOT NULL
          AND rca."clientCreatedAt" >= ${dayStart} AND rca."clientCreatedAt" < ${dayEnd}
        ORDER BY rca."representantId", rca."clientCreatedAt" DESC, rca."id" DESC
      ),
      representants_qualifies AS (
        SELECT "userId", SUM(qualifie)::int AS qualifies FROM derniere_reponse GROUP BY 1
      )
      SELECT
        p."userId",
        COUNT(*)::int              AS calls,
        MIN(p."clientCreatedAt")   AS "firstCallAt",
        MAX(p."clientCreatedAt")   AS "lastCallAt",
        SUM(p.joint)::int          AS "reachedToday",
        (SUM(p.qualifie) + COALESCE(MAX(q.qualifies), 0))::int AS "qualifiedToday",
        COALESCE(MAX(r.repetitions), 0)::int                   AS "repeatCalls",
        COUNT(*) FILTER (WHERE ${deadGap})::int                 AS "deadGaps",
        COALESCE(
          SUM(EXTRACT(EPOCH FROM p.gap)) FILTER (WHERE ${deadGap}), 0
        )::int AS "deadSeconds",
        ROUND(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM p.gap)
        ))::int AS "medianGapSeconds",
        ROUND(percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (p."createdAt" - p."clientCreatedAt"))
        ))::int AS "medianUploadLagSeconds"
      FROM paced p
      LEFT JOIN representants_qualifies q ON q."userId" = p."userId"
      LEFT JOIN rappels r ON r."userId" = p."userId"
      GROUP BY p."userId"
    `;
  }
}
