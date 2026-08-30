import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { PROSPECT_FROM, prospectConditions } from './analytics.sql.js';
import { days, ALL_ROWS } from './pilotage.sql.js';
import { DelayLeg } from './pilotage.dto.js';
import type { AnalyticsDelaysDto, DelayLegDto } from './pilotage.dto.js';

@Injectable()
export class PilotageService {
  constructor(private readonly prisma: PrismaService) {}

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
