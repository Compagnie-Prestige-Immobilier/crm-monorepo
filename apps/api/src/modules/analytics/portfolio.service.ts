import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PROSPECT_FROM, prospectConditions } from './analytics.sql.js';
import {
  BANK_CASE,
  PROSPECT_OUTCOME_AGGREGATES,
  TRANSITION,
  days,
  demoScopeOn,
  prospectOutcomeColumns,
  rate,
} from './pilotage.sql.js';
import { BankAgeBucket } from './portfolio.dto.js';
import type {
  BankAgingBucketDto,
  BankAgingDto,
  DepartementYieldListDto,
  WeeklyCohortListDto,
} from './portfolio.dto.js';
import type { ProspectOutcomeRow } from './pilotage.sql.js';

const BUCKETS: { key: BankAgeBucket; label: string }[] = [
  { key: BankAgeBucket.J0_7, label: '0 à 7 jours' },
  { key: BankAgeBucket.J8_15, label: '8 à 15 jours' },
  { key: BankAgeBucket.J16_30, label: '16 à 30 jours' },
  { key: BankAgeBucket.J31_60, label: '31 à 60 jours' },
  { key: BankAgeBucket.J60_PLUS, label: 'Plus de 60 jours' },
];

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async bankAging(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<BankAgingDto> {
    const demoEnabled = await this.demo.enabled();
    const where = prospectConditions(user, filter, demoEnabled);
    const caseScope = demoScopeOn(BANK_CASE, demoEnabled);
    const transitionScope = demoScopeOn(TRANSITION, demoEnabled);

    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        label: string;
        dossiers: number;
        b1: number;
        b2: number;
        b3: number;
        b4: number;
        b5: number;
        mediane: number | null;
      }[]
    >`
      -- ANCIENNETÉ : depuis l'ouverture du dossier. STATIONNEMENT : depuis son
      -- arrivée à l'étape courante. Ce sont deux durées différentes.
      WITH dossiers AS (
        SELECT
          st."id"    AS stage_id,
          st."label" AS stage_label,
          st."position" AS stage_position,
          -- FLOOR : bornes continues, étiquettes entières ; sans arrondi bas un
          -- dossier de 7,4 jours tomberait dans la barre « 8 à 15 jours ».
          FLOOR(EXTRACT(EPOCH FROM (now() - bc."createdAt")) / 86400.0) AS anciennete,
          EXTRACT(EPOCH FROM (now() - COALESCE((
            SELECT MAX(tr."createdAt") FROM "bank_case_transitions" tr
            WHERE tr."caseId" = bc."id"
              AND tr."toStageId" = bc."currentStageId"
              AND ${transitionScope}
          ), bc."createdAt"))) / 86400.0                          AS stationnement
        ${PROSPECT_FROM}
        INNER JOIN "bank_cases" bc
          ON bc."prospectId" = p."id" AND bc."deletedAt" IS NULL AND ${caseScope}
        INNER JOIN "bank_case_stages" st ON st."id" = bc."currentStageId"
        -- Étapes NON TERMINALES seules : un dossier encaissé ou rejeté est sorti
        -- du portefeuille et gonflerait indéfiniment la tranche « plus de 60 jours ».
        WHERE ${where} AND st."type" = 'OPEN'
      )
      SELECT
        stage_id      AS id,
        stage_label   AS label,
        COUNT(*)::int AS dossiers,
        COUNT(*) FILTER (WHERE anciennete <= 7)::int                       AS b1,
        COUNT(*) FILTER (WHERE anciennete > 7 AND anciennete <= 15)::int   AS b2,
        COUNT(*) FILTER (WHERE anciennete > 15 AND anciennete <= 30)::int  AS b3,
        COUNT(*) FILTER (WHERE anciennete > 30 AND anciennete <= 60)::int  AS b4,
        COUNT(*) FILTER (WHERE anciennete > 60)::int                       AS b5,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY stationnement)::float8 AS mediane
      FROM dossiers
      GROUP BY stage_id, stage_label, stage_position
      ORDER BY stage_position ASC, label ASC
    `;

    const total = rows.reduce((sum, row) => sum + row.dossiers, 0);
    const counts = (row: (typeof rows)[number]): number[] => [
      row.b1,
      row.b2,
      row.b3,
      row.b4,
      row.b5,
    ];
    const globals = rows.reduce(
      (sums, row) => sums.map((value, index) => value + (counts(row)[index] ?? 0)),
      [0, 0, 0, 0, 0],
    );

    return {
      buckets: buildBuckets(globals, total),
      stages: rows.map((row) => ({
        stageId: row.id,
        label: row.label,
        dossiers: row.dossiers,
        share: rate(row.dossiers, total),
        medianStationDays: row.dossiers === 0 ? null : days(row.mediane),
        buckets: buildBuckets(counts(row), row.dossiers),
      })),
      total,
    };
  }

  async weeklyCohorts(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<WeeklyCohortListDto> {
    const demoEnabled = await this.demo.enabled();
    const where = prospectConditions(user, filter, demoEnabled);

    const rows = await this.prisma.$queryRaw<(ProspectOutcomeRow & { semaine: string })[]>`
      WITH base AS (
        SELECT
          -- Semaine de clientCreatedAt, la saisie terrain, pas l'arrivée en base.
          to_char(date_trunc('week', p."clientCreatedAt"), 'YYYY-MM-DD') AS semaine,
          ${prospectOutcomeColumns(demoEnabled)}
        ${PROSPECT_FROM}
        WHERE ${where}
      )
      SELECT semaine, ${PROSPECT_OUTCOME_AGGREGATES}
      FROM base
      GROUP BY semaine
      ORDER BY semaine ASC
    `;

    return {
      items: rows.map((row) => ({
        week: row.semaine,
        prospects: row.prospects,
        methodObtained: row.methodes,
        cases: row.dossiers,
        cashed: row.encaisses,
        cashedAmountXof: row.montant ?? '0',
        // Dénominateur : les prospects ENTRÉS dans la semaine. Rapporté aux dossiers
        // ouverts, le taux monterait dès qu'on ouvre moins de dossiers.
        conversionRate: rate(row.encaisses, row.prospects),
      })),
      total: rows.reduce((sum, row) => sum + row.prospects, 0),
    };
  }

  async departementYield(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<DepartementYieldListDto> {
    const demoEnabled = await this.demo.enabled();
    const where = prospectConditions(user, filter, demoEnabled);

    const rows = await this.prisma.$queryRaw<
      (ProspectOutcomeRow & { id: string; label: string })[]
    >`
      WITH base AS (
        SELECT
          d."id"   AS departement_id,
          d."name" AS departement_label,
          ${prospectOutcomeColumns(demoEnabled)}
        ${PROSPECT_FROM}
        INNER JOIN "departements" d ON d."id" = r."departementId"
        WHERE ${where}
      )
      SELECT
        departement_id    AS id,
        departement_label AS label,
        ${PROSPECT_OUTCOME_AGGREGATES}
      FROM base
      GROUP BY departement_id, departement_label
      ORDER BY encaisses DESC, prospects DESC, label ASC
    `;

    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        prospects: row.prospects,
        methodObtained: row.methodes,
        cases: row.dossiers,
        cashed: row.encaisses,
        cashedAmountXof: row.montant ?? '0',
        methodRate: rate(row.methodes, row.prospects),
        conversionRate: rate(row.encaisses, row.prospects),
      })),
      total: rows.reduce((sum, row) => sum + row.prospects, 0),
    };
  }
}

/** Les cinq tranches sont toujours rendues, une tranche vide à zéro : l'histogramme garde sa forme. */
function buildBuckets(counts: number[], total: number): BankAgingBucketDto[] {
  return BUCKETS.map((bucket, index) => {
    const dossiers = counts[index] ?? 0;
    return { bucket: bucket.key, label: bucket.label, dossiers, share: rate(dossiers, total) };
  });
}
