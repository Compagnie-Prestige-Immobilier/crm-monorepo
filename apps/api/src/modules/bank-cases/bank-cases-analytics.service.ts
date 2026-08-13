import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';
import type { BankStageType } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { BANK_CASE_FROM, bankCaseConditions } from './bank-cases.sql.js';
import { sumToString } from './money.js';
import { BankTimeGranularity } from './analytics.dto.js';
import type {
  BankAgentActivityDto,
  BankAnalyticsQueryDto,
  BankAnalyticsTotalsDto,
  BankBankBreakdownDto,
  BankCaseAnalyticsDto,
  BankRejectionBreakdownDto,
  BankStageCountDto,
  BankTimeBucketDto,
} from './analytics.dto.js';
import type { BankCaseFilterDto } from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/**
 * Date d'ENTRÉE en étape terminale.
 *
 * Lue dans l'historique et non sur `updatedAt` du dossier : un dossier encaissé
 * dont un administrateur corrige ensuite le montant verrait sinon son délai de
 * traitement s'allonger rétroactivement. La transition, elle, ne bouge jamais.
 *
 * `MAX` et non `MIN` : après une réouverture puis un nouvel encaissement, c'est
 * la dernière issue qui fait foi.
 */
const CLOSED_AT = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT MAX(bt."createdAt") AS "closedAt"
    FROM "bank_case_transitions" bt
    INNER JOIN "bank_case_stages" bs ON bs."id" = bt."toStageId"
    WHERE bt."caseId" = c."id" AND bs."type" <> 'OPEN'
  ) cl ON TRUE
`;

const SECONDS_PER_HOUR = 3600;

/** Part en pourcentage, arrondie au dixième. Zéro plutôt qu'une division par zéro. */
const share = (value: number, total: number): number =>
  total === 0 ? 0 : Math.round((value / total) * 1000) / 10;

const hours = (seconds: number | null): number | null =>
  seconds === null ? null : Math.round((seconds / SECONDS_PER_HOUR) * 10) / 10;

@Injectable()
export class BankCaseAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * Un seul appel pour tout le tableau de bord.
   *
   * Sept requêtes agrégées, zéro ligne de dossier rapatriée, et le MÊME filtre
   * que la liste — c'est cette dernière propriété qui garantit qu'un compteur
   * affiché est toujours exactement le décompte du tableau en dessous.
   */
  async overview(query: BankAnalyticsQueryDto): Promise<BankCaseAnalyticsDto> {
    const [totals, byStage, createdOverTime, cashingsOverTime, byBank, byRejectionReason, byAgent] =
      await Promise.all([
        this.totals(query),
        this.byStage(query),
        this.createdOverTime(query),
        this.cashingsOverTime(query),
        this.byBank(query),
        this.byRejectionReason(query),
        this.byAgent(query),
      ]);

    return {
      totals,
      byStage,
      createdOverTime,
      cashingsOverTime,
      byBank,
      byRejectionReason,
      byAgent,
    };
  }

  async totals(filter: BankCaseFilterDto): Promise<BankAnalyticsTotalsDto> {
    const where = bankCaseConditions(filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        total: number;
        aTraiter: number;
        enTraitement: number;
        encaisses: number;
        rejetes: number;
        amountCashed: string;
        delaySeconds: number | null;
      }[]
    >`
      SELECT
        COUNT(*)::int                                                          AS "total",
        COUNT(*) FILTER (WHERE s."isInitial")::int                             AS "aTraiter",
        COUNT(*) FILTER (WHERE s."type" = 'OPEN' AND NOT s."isInitial")::int   AS "enTraitement",
        COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int                       AS "encaisses",
        COUNT(*) FILTER (WHERE s."type" = 'REJECTED')::int                     AS "rejetes",
        COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text AS "amountCashed",
        (AVG(EXTRACT(EPOCH FROM (cl."closedAt" - c."createdAt")))
           FILTER (WHERE s."type" <> 'OPEN' AND cl."closedAt" IS NOT NULL))::float8 AS "delaySeconds"
      ${BANK_CASE_FROM}
      ${CLOSED_AT}
      WHERE ${where}
    `;

    const row = rows[0];
    const encaisses = row?.encaisses ?? 0;
    const rejetes = row?.rejetes ?? 0;
    return {
      total: row?.total ?? 0,
      aTraiter: row?.aTraiter ?? 0,
      enTraitement: row?.enTraitement ?? 0,
      encaisses,
      rejetes,
      totalAmountCashed: sumToString(row?.amountCashed ?? null),
      // Le taux est calculé sur les dossiers CLOS. Rapporté au total, il
      // baisserait mécaniquement à chaque nouveau dossier ouvert et ne dirait
      // plus rien de la qualité des dossiers transmis.
      rejectionRate: share(rejetes, encaisses + rejetes),
      meanDelayHours: hours(row?.delaySeconds ?? null),
    };
  }

  async byStage(filter: BankCaseFilterDto): Promise<BankStageCountDto[]> {
    const where = bankCaseConditions(filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        stageId: string;
        code: string;
        label: string;
        color: string;
        type: BankStageType;
        cases: number;
      }[]
    >`
      SELECT s."id" AS "stageId", s."code" AS "code", s."label" AS "label",
             s."color" AS "color", s."type"::text AS "type", COUNT(*)::int AS "cases"
      ${BANK_CASE_FROM}
      WHERE ${where}
      GROUP BY s."id", s."code", s."label", s."color", s."type", s."position"
      ORDER BY s."position" ASC
    `;

    const total = rows.reduce((sum, row) => sum + row.cases, 0);
    return rows.map((row) => ({ ...row, share: share(row.cases, total) }));
  }

  async createdOverTime(query: BankAnalyticsQueryDto): Promise<BankTimeBucketDto[]> {
    const where = bankCaseConditions(query, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<{ bucket: Date; cases: number }[]>`
      SELECT date_trunc(${unit(query.granularity)}, c."createdAt") AS "bucket",
             COUNT(*)::int AS "cases"
      ${BANK_CASE_FROM}
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      cases: row.cases,
      amountXof: '0',
    }));
  }

  /** Encaissements datés par leur transition, en nombre ET en montant. */
  async cashingsOverTime(query: BankAnalyticsQueryDto): Promise<BankTimeBucketDto[]> {
    const where = bankCaseConditions(query, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<{ bucket: Date; cases: number; amount: string }[]>`
      SELECT date_trunc(${unit(query.granularity)}, cl."closedAt") AS "bucket",
             COUNT(*)::int AS "cases",
             COALESCE(SUM(c."amountXof"), 0)::text AS "amount"
      ${BANK_CASE_FROM}
      ${CLOSED_AT}
      WHERE ${where} AND s."type" = 'CASHED' AND cl."closedAt" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((row) => ({
      bucket: row.bucket.toISOString(),
      cases: row.cases,
      amountXof: sumToString(row.amount),
    }));
  }

  async byBank(filter: BankCaseFilterDto): Promise<BankBankBreakdownDto[]> {
    const where = bankCaseConditions(filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        bankId: string;
        label: string;
        cases: number;
        cashed: number;
        rejected: number;
        amount: string;
        meanSeconds: number | null;
      }[]
    >`
      SELECT b."id" AS "bankId", b."shortName" AS "label",
             COUNT(*)::int AS "cases",
             COUNT(*) FILTER (WHERE s."type" = 'CASHED')::int AS "cashed",
             COUNT(*) FILTER (WHERE s."type" = 'REJECTED')::int AS "rejected",
             COALESCE(SUM(c."amountXof") FILTER (WHERE s."type" = 'CASHED'), 0)::text AS "amount",
             (AVG(EXTRACT(EPOCH FROM (cl."closedAt" - c."createdAt")))
                FILTER (WHERE s."type" <> 'OPEN' AND cl."closedAt" IS NOT NULL))::float8 AS "meanSeconds"
      ${BANK_CASE_FROM}
      ${CLOSED_AT}
      INNER JOIN "banques" b ON b."id" = c."processingBankId"
      WHERE ${where}
      GROUP BY b."id", b."shortName"
      ORDER BY "cases" DESC, "label" ASC
    `;

    const total = rows.reduce((sum, row) => sum + row.cases, 0);
    return rows.map((row) => ({
      bankId: row.bankId,
      label: row.label,
      cases: row.cases,
      cashed: row.cashed,
      rejected: row.rejected,
      amountXof: sumToString(row.amount),
      share: share(row.cases, total),
      meanProcessingHours: hours(row.meanSeconds),
    }));
  }

  async byRejectionReason(filter: BankCaseFilterDto): Promise<BankRejectionBreakdownDto[]> {
    const where = bankCaseConditions(filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      { reasonId: string; code: string; label: string; cases: number }[]
    >`
      SELECT r."id" AS "reasonId", r."code" AS "code", r."label" AS "label",
             COUNT(*)::int AS "cases"
      ${BANK_CASE_FROM}
      INNER JOIN "bank_rejection_reasons" r ON r."id" = c."rejectionReasonId"
      WHERE ${where} AND s."type" = 'REJECTED'
      GROUP BY r."id", r."code", r."label", r."sortOrder"
      ORDER BY "cases" DESC, r."sortOrder" ASC
    `;

    const total = rows.reduce((sum, row) => sum + row.cases, 0);
    return rows.map((row) => ({ ...row, share: share(row.cases, total) }));
  }

  /**
   * Activité par agent.
   *
   * Deux mesures distinctes et volontairement séparées : ce qu'un agent a
   * OUVERT, et ce qu'il a FAIT AVANCER. Les confondre ferait disparaître le
   * travail de celui qui reprend les dossiers d'un collègue absent.
   */
  async byAgent(filter: BankCaseFilterDto): Promise<BankAgentActivityDto[]> {
    const where = bankCaseConditions(filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        agentId: string;
        label: string;
        created: number;
        transitions: number;
        cashed: number;
        amount: string;
      }[]
    >`
      WITH scoped AS (
        SELECT c."id" AS "caseId", c."createdById" AS "creatorId"
        ${BANK_CASE_FROM}
        WHERE ${where}
      ),
      creators AS (
        SELECT "creatorId" AS "agentId", COUNT(*)::int AS "created"
        FROM scoped GROUP BY 1
      ),
      actors AS (
        SELECT t."performedById" AS "agentId",
               COUNT(*)::int AS "transitions",
               COUNT(*) FILTER (WHERE bs."type" = 'CASHED')::int AS "cashed",
               COALESCE(SUM(t."amountXof") FILTER (WHERE bs."type" = 'CASHED'), 0)::text AS "amount"
        FROM "bank_case_transitions" t
        INNER JOIN scoped ON scoped."caseId" = t."caseId"
        INNER JOIN "bank_case_stages" bs ON bs."id" = t."toStageId"
        GROUP BY 1
      )
      SELECT u."id" AS "agentId", u."fullName" AS "label",
             COALESCE(cr."created", 0)::int AS "created",
             COALESCE(ac."transitions", 0)::int AS "transitions",
             COALESCE(ac."cashed", 0)::int AS "cashed",
             COALESCE(ac."amount", '0') AS "amount"
      FROM "users" u
      LEFT JOIN creators cr ON cr."agentId" = u."id"
      LEFT JOIN actors ac ON ac."agentId" = u."id"
      WHERE cr."agentId" IS NOT NULL OR ac."agentId" IS NOT NULL
      ORDER BY "created" DESC, "transitions" DESC, "label" ASC
    `;

    return rows.map((row) => ({
      agentId: row.agentId,
      label: row.label,
      created: row.created,
      transitions: row.transitions,
      cashed: row.cashed,
      amountXof: sumToString(row.amount),
    }));
  }
}

/**
 * `date_trunc` prend un LITTÉRAL, jamais un paramètre : la valeur vient d'une
 * énumération fermée et non de la chaîne reçue, ce qui interdit toute injection
 * par ce chemin.
 */
function unit(granularity: BankTimeGranularity | undefined): Prisma.Sql {
  if (granularity === BankTimeGranularity.MONTH) return Prisma.sql`'month'`;
  if (granularity === BankTimeGranularity.WEEK) return Prisma.sql`'week'`;
  return Prisma.sql`'day'`;
}
