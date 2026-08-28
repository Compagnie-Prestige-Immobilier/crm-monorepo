import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { PROSPECT_FROM, prospectConditions } from './analytics.sql.js';
import { UNUSABLE_OUTCOMES, days, ALL_ROWS, rate } from './pilotage.sql.js';
import { DelayLeg } from './pilotage.dto.js';
import type { AnalyticsDelaysDto, CampaignPilotageDto, DelayLegDto } from './pilotage.dto.js';

@Injectable()
export class PilotageService {
  constructor(private readonly prisma: PrismaService) {}

  async campaignPilotage(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<CampaignPilotageDto> {
    const where = prospectConditions(user, filter);
    // Sans campagne précisée, la mesure porte sur les campagnes ACTIVES, pas sur
    // le cumul historique.
    const scope = filter.campaignId
      ? Prisma.sql`cc."id" = ${filter.campaignId}`
      : Prisma.sql`cc."status" = 'ACTIVE'`;

    const taskScope = ALL_ROWS;
    const attemptScope = ALL_ROWS;
    const campaignScope = ALL_ROWS;

    const [totals, perDay] = await Promise.all([
      this.prisma.$queryRaw<
        {
          taches: number;
          contactees: number;
          restantes: number;
          closes7: number;
          tentatives: number;
          joignables: number;
          methodes: number;
        }[]
      >`
        WITH taches AS (
          SELECT
            ct."status"      AS status,
            ct."completedAt" AS completed,
            EXISTS (
              SELECT 1 FROM "call_attempts" ca
              WHERE ca."taskId" = ct."id" AND ${attemptScope}
            )                AS contactee
          ${PROSPECT_FROM}
          INNER JOIN "call_tasks" ct ON ct."prospectId" = p."id" AND ${taskScope}
          INNER JOIN "call_campaigns" cc ON cc."id" = ct."campaignId" AND ${campaignScope}
          WHERE ${where} AND ${scope}
        ),
        tentatives AS (
          SELECT ca."outcome" AS outcome
          ${PROSPECT_FROM}
          INNER JOIN "call_attempts" ca ON ca."prospectId" = p."id" AND ${attemptScope}
          INNER JOIN "call_campaigns" cc ON cc."id" = ca."campaignId" AND ${campaignScope}
          WHERE ${where} AND ${scope}
        )
        SELECT t.*, v.*
        FROM (
          SELECT
            COUNT(*)::int                                AS taches,
            COUNT(*) FILTER (WHERE contactee)::int       AS contactees,
            COUNT(*) FILTER (WHERE status = 'OPEN')::int AS restantes,
            COUNT(*) FILTER (
              WHERE status = 'DONE' AND completed >= now() - interval '7 days'
            )::int                                       AS closes7
          FROM taches
        ) t,
        (
          SELECT
            COUNT(*)::int                                              AS tentatives,
            COUNT(*) FILTER (WHERE outcome NOT IN ${UNUSABLE_OUTCOMES})::int AS joignables,
            COUNT(*) FILTER (WHERE outcome = 'METHOD_OBTAINED')::int   AS methodes
          FROM tentatives
        ) v
      `,
      this.prisma.$queryRaw<{ jour: string; id: string; nom: string; done: number }[]>`
        SELECT
          to_char(date_trunc('day', ct."completedAt"), 'YYYY-MM-DD') AS jour,
          u."id"        AS id,
          u."fullName"  AS nom,
          COUNT(*)::int AS done
        ${PROSPECT_FROM}
        INNER JOIN "call_tasks" ct ON ct."prospectId" = p."id" AND ${taskScope}
        INNER JOIN "call_campaigns" cc ON cc."id" = ct."campaignId" AND ${campaignScope}
        INNER JOIN "users" u ON u."id" = ct."assignedToId"
        WHERE ${where} AND ${scope}
          AND ct."status" = 'DONE' AND ct."completedAt" IS NOT NULL
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC, 3 ASC
      `,
    ]);

    const row = totals[0] ?? {
      taches: 0,
      contactees: 0,
      restantes: 0,
      closes7: 0,
      tentatives: 0,
      joignables: 0,
      methodes: 0,
    };
    const tasks = row.taches;
    const attempts = row.tentatives;
    const methods = row.methodes;
    const remaining = row.restantes;
    // Cadence sur une fenêtre glissante de 7 jours : une moyenne depuis l'ouverture
    // resterait plombée par les premiers jours de rodage.
    const observedPace = Math.round((row.closes7 / 7) * 10) / 10;

    return {
      campaignId: filter.campaignId ?? null,
      tasks,
      tasksContacted: row.contactees,
      contactRate: rate(row.contactees, tasks),
      attempts,
      reachableAttempts: row.joignables,
      reachRate: rate(row.joignables, attempts),
      methodsObtained: methods,
      attemptsPerMethodObtained: methods === 0 ? 0 : Math.round((attempts / methods) * 10) / 10,
      closedPerDay: perDay.map((day) => ({
        day: day.jour,
        commercialId: day.id,
        commercialName: day.nom,
        done: day.done,
      })),
      remaining,
      observedPace,
      estimatedEndDate: projectEnd(remaining, observedPace),
    };
  }

  async delays(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<AnalyticsDelaysDto> {
    const where = prospectConditions(user, filter);
    const caseScope = ALL_ROWS;
    const transitionScope = ALL_ROWS;

    const cree = Prisma.sql`cree`;
    const methode = Prisma.sql`methode`;
    const ouvert = Prisma.sql`ouvert`;
    const encaisse = Prisma.sql`encaisse`;

    const rows = await this.prisma.$queryRaw<
      {
        m1: number | null;
        p1: number | null;
        n1: number;
        m2: number | null;
        p2: number | null;
        n2: number;
        m3: number | null;
        p3: number | null;
        n3: number;
      }[]
    >`
      WITH base AS (
        SELECT
          p."clientCreatedAt"      AS cree,
          p."enrollmentCapturedAt" AS methode,
          (
            SELECT MIN(bc."createdAt") FROM "bank_cases" bc
            WHERE bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND ${caseScope}
          )                        AS ouvert,
          (
            SELECT MIN(tr."createdAt")
            FROM "bank_case_transitions" tr
            INNER JOIN "bank_cases" bc
              ON bc."id" = tr."caseId" AND bc."deletedAt" IS NULL AND ${caseScope}
            INNER JOIN "bank_case_stages" st ON st."id" = tr."toStageId"
            WHERE bc."prospectId" = p."id" AND st."type" = 'CASHED' AND ${transitionScope}
          )                        AS encaisse
        ${PROSPECT_FROM}
        WHERE ${where}
      )
      SELECT
        ${median(cree, methode)}      AS m1,
        ${ninth(cree, methode)}       AS p1,
        ${sample(cree, methode)}      AS n1,
        ${median(methode, ouvert)}    AS m2,
        ${ninth(methode, ouvert)}     AS p2,
        ${sample(methode, ouvert)}    AS n2,
        ${median(ouvert, encaisse)}   AS m3,
        ${ninth(ouvert, encaisse)}    AS p3,
        ${sample(ouvert, encaisse)}   AS n3
      FROM base
    `;

    const row = rows[0];
    const leg = (
      key: DelayLeg,
      label: string,
      milieu: number | null | undefined,
      queue: number | null | undefined,
      taille: number | undefined,
    ): DelayLegDto => ({
      leg: key,
      label,
      medianDays: taille ? days(milieu ?? null) : null,
      p90Days: taille ? days(queue ?? null) : null,
      sample: taille ?? 0,
    });

    return {
      legs: [
        leg(
          DelayLeg.CREATION_TO_METHOD,
          'Saisie du prospect vers méthode obtenue',
          row?.m1,
          row?.p1,
          row?.n1,
        ),
        leg(
          DelayLeg.METHOD_TO_CASE,
          'Méthode obtenue vers dossier ouvert',
          row?.m2,
          row?.p2,
          row?.n2,
        ),
        leg(DelayLeg.CASE_TO_CASHED, 'Dossier ouvert vers encaissement', row?.m3, row?.p3, row?.n3),
      ],
    };
  }
}

const duration = (from: Prisma.Sql, to: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`EXTRACT(EPOCH FROM (${to} - ${from})) / 86400.0`;

/** `clientCreatedAt` vient de l'horloge du téléphone : un couple incomplet ou inversé est une mesure à jeter, pas un délai court. */
const usable = (from: Prisma.Sql, to: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`${from} IS NOT NULL AND ${to} IS NOT NULL AND ${to} >= ${from}`;

/** Médiane et non moyenne : un dossier oublié six mois déplacerait une moyenne de plusieurs semaines. */
const median = (from: Prisma.Sql, to: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${duration(from, to)})
    FILTER (WHERE ${usable(from, to)})::float8`;

const ninth = (from: Prisma.Sql, to: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`percentile_cont(0.9) WITHIN GROUP (ORDER BY ${duration(from, to)})
    FILTER (WHERE ${usable(from, to)})::float8`;

const sample = (from: Prisma.Sql, to: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`COUNT(*) FILTER (WHERE ${usable(from, to)})::int`;

/** Rien quand la cadence est nulle : une date lointaine laisserait croire que la campagne avance. */
function projectEnd(remaining: number, pace: number): string | null {
  if (pace <= 0) return null;
  const jours = Math.ceil(remaining / pace);
  return new Date(Date.now() + jours * 86_400_000).toISOString().slice(0, 10);
}
