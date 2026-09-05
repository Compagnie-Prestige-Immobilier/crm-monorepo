import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { PROSPECT_FROM, prospectConditions, representantConditions } from './analytics.sql.js';
import { ALL_ROWS, rate } from './pilotage.sql.js';
import type {
  AmbassadorConversionDto,
  DataQualityDto,
  DataQualityRowDto,
  OriginBreakdownDto,
  RepresentantProductivityListDto,
  RepresentantProductivityQueryDto,
} from './quality.dto.js';

/** Seuil de dormance par défaut : un trimestre sans apport. */
const DORMANT_DAYS = 90;

/** `origin` est contraint en base par `prospects_origin_known` ; le repli rend le code brut, le temps qu'un canal nouveau reçoive son libellé. */
const ORIGIN_LABELS: Record<string, string> = { BANQUE: 'Banque' };

const TERRAIN = 'Saisie terrain';

/** `origin` NULL n'est pas une provenance inconnue : c'est la tournée terrain, le chemin normal. */
const originLabel = (origin: string | null): string =>
  origin === null ? TERRAIN : (ORIGIN_LABELS[origin] ?? origin);

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async representantProductivity(
    user: AuthenticatedUser,
    query: RepresentantProductivityQueryDto,
  ): Promise<RepresentantProductivityListDto> {
    const where = prospectConditions(user, query);
    const dormantDays = query.dormantDays ?? DORMANT_DAYS;

    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        label: string;
        departement: string;
        prospects: number;
        methodes: number;
        dernier: Date | null;
        dormant: boolean;
        population: number;
      }[]
    >`
      SELECT
        r."id"        AS id,
        r."fullName"  AS label,
        d."name"      AS departement,
        COUNT(*)::int AS prospects,
        COUNT(*) FILTER (WHERE p."phase2Status" = 'METHOD_OBTAINED')::int AS methodes,
        MAX(p."clientCreatedAt")                                          AS dernier,
        -- Dormance calculée en base, jamais côté écran : un client dans un autre
        -- fuseau que le serveur trancherait la limite un jour à côté.
        (
          MAX(p."clientCreatedAt") < now() - (${dormantDays}::int * interval '1 day')
        )                                                                 AS dormant,
        -- Total de la POPULATION, pas du haut de classement : la fenêtre est
        -- évaluée après le GROUP BY mais avant le LIMIT.
        SUM(COUNT(*)) OVER ()::int                                        AS population
      ${PROSPECT_FROM}
      INNER JOIN "departements" d ON d."id" = r."departementId"
      WHERE ${where}
      GROUP BY r."id", r."fullName", d."name"
      ORDER BY prospects DESC, label ASC
      LIMIT ${query.limit ?? 10}
    `;

    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        departementName: row.departement,
        prospects: row.prospects,
        methodObtained: row.methodes,
        conversionRate: rate(row.methodes, row.prospects),
        lastProspectAt: row.dernier?.toISOString() ?? null,
        dormant: row.dormant,
      })),
      total: rows[0]?.population ?? 0,
      dormantDays,
    };
  }

  /**
   * Conversion en ambassadeur, datée sur la BASCULE et non sur l'arrivée en
   * base : la fiche ne garde que son dernier état, `representant_relation_changes`
   * garde l'acte et sa date.
   */
  async ambassadorConversion(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<AmbassadorConversionDto> {
    const perimetre = representantConditions(user, filter);
    const traceVisible = ALL_ROWS;

    const bornes: Prisma.Sql[] = [perimetre, traceVisible];
    if (filter.dateFrom) {
      bornes.push(Prisma.sql`rc."changedAt" >= ${inclusiveDateFrom(filter.dateFrom)}`);
    }
    if (filter.dateTo) {
      bornes.push(Prisma.sql`rc."changedAt" <= ${inclusiveDateTo(filter.dateTo)}`);
    }

    const [bascules, jamaisTravailles] = await Promise.all([
      this.prisma.$queryRaw<{ contactes: number; ambassadeurs: number; revenus: number }[]>`
        SELECT
          COUNT(DISTINCT rc."representantId")::int AS contactes,
          COUNT(DISTINCT rc."representantId") FILTER (
            WHERE rc."toStatus" = 'AMBASSADEUR'
          )::int AS ambassadeurs,
          COUNT(DISTINCT rc."representantId") FILTER (
            WHERE rc."toStatus" = 'AMBASSADEUR' AND r."relationStatus" <> 'AMBASSADEUR'
          )::int AS revenus
        FROM "representant_relation_changes" rc
        INNER JOIN "representants" r ON r."id" = rc."representantId"
        WHERE ${Prisma.join(bornes, ' AND ')}
      `,
      this.prisma.$queryRaw<{ orphelins: number }[]>`
        SELECT COUNT(*)::int AS orphelins
        FROM "representants" r
        WHERE ${perimetre}
          AND NOT EXISTS (
            SELECT 1 FROM "representant_relation_changes" rc
            WHERE rc."representantId" = r."id" AND ${traceVisible}
          )
      `,
    ]);

    const contacted = bascules[0]?.contactes ?? 0;
    const ambassadors = bascules[0]?.ambassadeurs ?? 0;

    return {
      contacted,
      ambassadors,
      conversionRate: rate(ambassadors, contacted),
      reverted: bascules[0]?.revenus ?? 0,
      untracked: jamaisTravailles[0]?.orphelins ?? 0,
    };
  }

  async dataQuality(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<DataQualityDto> {
    const where = prospectConditions(user, filter);
    const scope = ALL_ROWS;

    const [representants, departements] = await Promise.all([
      this.qualityBy(where, scope, Prisma.empty, Prisma.sql`r."id"`, Prisma.sql`r."fullName"`),
      this.qualityBy(
        where,
        scope,
        Prisma.sql`INNER JOIN "departements" d ON d."id" = r."departementId"`,
        Prisma.sql`d."id"`,
        Prisma.sql`d."name"`,
      ),
    ]);

    const attempts = representants.reduce((sum, row) => sum + row.attempts, 0);
    const mauvais = representants.reduce((sum, row) => sum + row.unreachable + row.wrongNumber, 0);

    return {
      representants,
      departements,
      attempts,
      badRate: rate(mauvais, attempts),
    };
  }

  async originBreakdown(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<OriginBreakdownDto> {
    const where = prospectConditions(user, filter);

    const [origins, labels] = await Promise.all([
      this.prisma.$queryRaw<{ origin: string | null; prospects: number }[]>`
        SELECT p."origin" AS origin, COUNT(*)::int AS prospects
        ${PROSPECT_FROM}
        WHERE ${where}
        GROUP BY 1
        ORDER BY prospects DESC, origin ASC
      `,
      this.prisma.$queryRaw<{ origin: string | null; detail: string | null; prospects: number }[]>`
        SELECT p."origin" AS origin, p."originLabel" AS detail, COUNT(*)::int AS prospects
        ${PROSPECT_FROM}
        WHERE ${where}
        GROUP BY 1, 2
        ORDER BY prospects DESC, detail ASC
      `,
    ]);

    const total = origins.reduce((sum, row) => sum + row.prospects, 0);

    return {
      items: origins.map((row) => ({
        origin: row.origin,
        label: originLabel(row.origin),
        prospects: row.prospects,
        share: rate(row.prospects, total),
      })),
      byLabel: labels.map((row) => ({
        origin: row.origin,
        originLabel: row.detail,
        label: row.detail ?? originLabel(row.origin),
        prospects: row.prospects,
        share: rate(row.prospects, total),
      })),
      total,
    };
  }

  /** Compte des TENTATIVES et non des prospects : un numéro appelé six fois coûte six appels. */
  private async qualityBy(
    where: Prisma.Sql,
    scope: Prisma.Sql,
    join: Prisma.Sql,
    idColumn: Prisma.Sql,
    labelColumn: Prisma.Sql,
  ): Promise<DataQualityRowDto[]> {
    const rows = await this.prisma.$queryRaw<
      { id: string; label: string; tentatives: number; injoignables: number; errones: number }[]
    >`
      SELECT
        ${idColumn}    AS id,
        ${labelColumn} AS label,
        COUNT(*)::int  AS tentatives,
        COUNT(*) FILTER (WHERE ca."outcome" = 'UNREACHABLE')::int  AS injoignables,
        COUNT(*) FILTER (WHERE ca."outcome" = 'WRONG_NUMBER')::int AS errones
      ${PROSPECT_FROM}
      ${join}
      INNER JOIN "call_attempts" ca ON ca."prospectId" = p."id" AND ${scope}
      WHERE ${where}
      GROUP BY ${idColumn}, ${labelColumn}
      ORDER BY COUNT(*) FILTER (WHERE ca."outcome" IN ('UNREACHABLE', 'WRONG_NUMBER')) DESC,
        label ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      attempts: row.tentatives,
      unreachable: row.injoignables,
      wrongNumber: row.errones,
      badRate: rate(row.injoignables + row.errones, row.tentatives),
    }));
  }
}
