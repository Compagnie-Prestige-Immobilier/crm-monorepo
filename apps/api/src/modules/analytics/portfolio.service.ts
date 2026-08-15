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

/** Bornes des tranches, en jours. La dernière est ouverte. */
const BUCKETS: { key: BankAgeBucket; label: string }[] = [
  { key: BankAgeBucket.J0_7, label: '0 à 7 jours' },
  { key: BankAgeBucket.J8_15, label: '8 à 15 jours' },
  { key: BankAgeBucket.J16_30, label: '16 à 30 jours' },
  { key: BankAgeBucket.J31_60, label: '31 à 60 jours' },
  { key: BankAgeBucket.J60_PLUS, label: 'Plus de 60 jours' },
];

/**
 * Portefeuille bancaire, cohortes et rendement.
 *
 * Les trois agrégats partagent la même règle de comptage : un prospect reste
 * un prospect et un dossier reste un dossier. Les aboutissements se lisent en
 * sous-requêtes (`prospectOutcomeColumns`) plutôt qu'en jointures, faute de
 * quoi un prospect porteur de trois dossiers pèserait trois fois dans sa
 * cohorte et gonflerait silencieusement tous les taux.
 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * Vieillissement des dossiers en cours.
   *
   * CHOIX ASSUMÉ : seuls les dossiers stationnant à une étape NON TERMINALE
   * (type OPEN) sont comptés, en plus de l'exclusion des dossiers supprimés.
   * Un dossier encaissé ou rejeté est sorti du portefeuille ; le laisser
   * vieillir gonflerait indéfiniment la tranche « plus de 60 jours » avec des
   * dossiers dont plus personne n'a à s'occuper, et masquerait précisément les
   * dossiers vivants que ce tableau doit faire remonter.
   *
   * Deux durées, à ne pas confondre : l'ANCIENNETÉ court depuis l'ouverture du
   * dossier, le STATIONNEMENT depuis son arrivée à l'étape courante. Un
   * dossier ancien qui vient de changer d'étape avance ; un dossier récent
   * immobile depuis trois semaines est le vrai signal.
   */
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
      WITH dossiers AS (
        SELECT
          st."id"    AS stage_id,
          st."label" AS stage_label,
          st."position" AS stage_position,
          -- FLOOR : les bornes SQL sont continues (> 7 ET <= 15) mais les
          -- étiquettes sont entières (« 8 à 15 jours »). Sans arrondi vers le
          -- bas, un dossier de 7,4 jours tombe dans la barre « 8 à 15 » et le
          -- lecteur voit un dossier vieilli d'un jour de plus qu'il ne l'est.
          -- Un dossier est « du jour N » tant qu'il n'a pas fini son N-ième.
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

  /**
   * Cohortes hebdomadaires d'entrée, suivies jusqu'à l'encaissement.
   *
   * La semaine est celle de `clientCreatedAt`, la saisie sur le TERRAIN, et
   * non celle de l'arrivée en base : un commercial resté trois jours hors
   * ligne verserait sinon ses fiches dans la mauvaise cohorte et déplacerait
   * deux taux à la fois.
   *
   * Le taux rendu rapporte les encaissements aux prospects ENTRÉS. C'est le
   * seul dénominateur qui rende deux semaines comparables : rapporté aux
   * dossiers ouverts, il monterait mécaniquement dès qu'on ouvre moins de
   * dossiers.
   */
  async weeklyCohorts(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<WeeklyCohortListDto> {
    const demoEnabled = await this.demo.enabled();
    const where = prospectConditions(user, filter, demoEnabled);

    const rows = await this.prisma.$queryRaw<(ProspectOutcomeRow & { semaine: string })[]>`
      WITH base AS (
        SELECT
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
        conversionRate: rate(row.encaisses, row.prospects),
      })),
      total: rows.reduce((sum, row) => sum + row.prospects, 0),
    };
  }

  /**
   * Rendement par département : le taux, pas seulement le volume.
   *
   * Le classement par volume seul recommande de renforcer les départements qui
   * saisissent beaucoup, y compris quand ils ne convertissent rien. Les deux
   * taux sont donc rendus côte à côte : la part de méthodes obtenues dit si le
   * travail d'appel suit, la part d'encaissements dit ce que le département
   * rapporte réellement.
   */
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

/**
 * Les cinq tranches, toujours les cinq.
 *
 * Une tranche vide est rendue à zéro plutôt qu'omise : un histogramme qui perd
 * une barre change de forme sans raison, et l'absence de « plus de 60 jours »
 * se lirait comme une panne de la série au lieu d'une bonne nouvelle.
 */
function buildBuckets(counts: number[], total: number): BankAgingBucketDto[] {
  return BUCKETS.map((bucket, index) => {
    const dossiers = counts[index] ?? 0;
    return { bucket: bucket.key, label: bucket.label, dossiers, share: rate(dossiers, total) };
  });
}
