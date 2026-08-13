import { Injectable } from '@nestjs/common';
import { ALL_SEGMENTS, Prisma, SEGMENT_LABELS } from '@crm/database';
import type { BddSegment, EnrollmentMethod, Phase2Status } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import {
  ENROLLMENT_METHOD_LABELS,
  ENROLLMENT_METHOD_ORDER,
  PHASE2_STATUS_LABELS,
  PHASE2_STATUS_ORDER,
} from '../prospects/phase2-labels.js';
import { PROSPECT_FROM, SEGMENT_EXPR, prospectConditions } from './analytics.sql.js';
import { TimeGranularity } from './dto.js';
import type {
  AnalyticsSeriesDto,
  AnalyticsTotalsDto,
  EnrollmentMethodListDto,
  NamedCountListDto,
  Phase2StatusListDto,
  SegmentListDto,
  TimeSeriesQueryDto,
  TopCommercialListDto,
  TopQueryDto,
  TopRepresentantListDto,
} from './dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/**
 * Agrégats du tableau de bord.
 *
 * Tout est calculé en SQL et rien ne quitte la base à la ligne : le navigateur
 * reçoit des compteurs, jamais des prospects. Le filtre est celui de la liste,
 * si bien qu'un chiffre affiché correspond toujours exactement au contenu du
 * tableau et du fichier exporté.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async totals(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<AnalyticsTotalsDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        prospects: number;
        representants: number;
        commerciaux: number;
        departements: number;
        nouveau: number;
        contacte: number;
        converti: number;
        perdu: number;
        j7: number;
        j30: number;
      }[]
    >`
      SELECT
        COUNT(*)::int                                                              AS prospects,
        COUNT(DISTINCT p."representantId")::int                                    AS representants,
        COUNT(DISTINCT p."createdById")::int                                       AS commerciaux,
        COUNT(DISTINCT r."departementId")::int                                     AS departements,
        COUNT(*) FILTER (WHERE p."statut" = 'NOUVEAU')::int                        AS nouveau,
        COUNT(*) FILTER (WHERE p."statut" = 'CONTACTE')::int                       AS contacte,
        COUNT(*) FILTER (WHERE p."statut" = 'CONVERTI')::int                       AS converti,
        COUNT(*) FILTER (WHERE p."statut" = 'PERDU')::int                          AS perdu,
        COUNT(*) FILTER (WHERE p."clientCreatedAt" >= now() - interval '7 days')::int  AS j7,
        COUNT(*) FILTER (WHERE p."clientCreatedAt" >= now() - interval '30 days')::int AS j30
      ${PROSPECT_FROM}
      WHERE ${where}
    `;

    const row = rows[0];
    return {
      prospects: row?.prospects ?? 0,
      representants: row?.representants ?? 0,
      commerciauxActifs: row?.commerciaux ?? 0,
      departementsCouverts: row?.departements ?? 0,
      nouveau: row?.nouveau ?? 0,
      contacte: row?.contacte ?? 0,
      converti: row?.converti ?? 0,
      perdu: row?.perdu ?? 0,
      prospects7Jours: row?.j7 ?? 0,
      prospects30Jours: row?.j30 ?? 0,
    };
  }

  async overTime(user: AuthenticatedUser, query: TimeSeriesQueryDto): Promise<AnalyticsSeriesDto> {
    const where = prospectConditions(user, query, await this.demo.enabled());
    // `date_trunc` prend un littéral, jamais un paramètre : la valeur vient
    // d'une énumération fermée et non de la chaîne reçue, ce qui interdit toute
    // injection par ce chemin.
    const unit =
      query.granularity === TimeGranularity.MONTH
        ? Prisma.sql`'month'`
        : query.granularity === TimeGranularity.WEEK
          ? Prisma.sql`'week'`
          : Prisma.sql`'day'`;

    const rows = await this.prisma.$queryRaw<
      { bucket: Date; prospects: number; representants: number }[]
    >`
      SELECT
        date_trunc(${unit}, p."clientCreatedAt")   AS bucket,
        COUNT(*)::int                              AS prospects,
        COUNT(DISTINCT p."representantId")::int    AS representants
      ${PROSPECT_FROM}
      WHERE ${where}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return {
      buckets: rows.map((row) => ({
        bucket: row.bucket.toISOString(),
        prospects: row.prospects,
        representants: row.representants,
      })),
    };
  }

  async topCommerciaux(user: AuthenticatedUser, query: TopQueryDto): Promise<TopCommercialListDto> {
    const where = prospectConditions(user, query, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        label: string;
        prospects: number;
        representants: number;
        derniere: Date | null;
      }[]
    >`
      SELECT
        u."id"                                   AS id,
        u."fullName"                             AS label,
        COUNT(*)::int                            AS prospects,
        COUNT(DISTINCT p."representantId")::int  AS representants,
        MAX(p."clientCreatedAt")                 AS derniere
      ${PROSPECT_FROM}
      INNER JOIN "users" u ON u."id" = p."createdById"
      WHERE ${where}
      GROUP BY u."id", u."fullName"
      ORDER BY prospects DESC, label ASC
      LIMIT ${query.limit ?? 10}
    `;

    const total = rows.reduce((sum, row) => sum + row.prospects, 0);
    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        prospects: row.prospects,
        representants: row.representants,
        share: share(row.prospects, total),
        derniereSaisie: row.derniere?.toISOString() ?? null,
      })),
      total,
    };
  }

  byDepartement(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<NamedCountListDto> {
    return this.groupBy(
      user,
      filter,
      Prisma.sql`INNER JOIN "departements" d ON d."id" = r."departementId"`,
      Prisma.sql`d."id"`,
      Prisma.sql`d."name"`,
    );
  }

  // `banques` et `syndicats` sont déjà joints par PROSPECT_FROM pour le calcul
  // du segment : on réutilise les alias plutôt que de rejoindre les mêmes tables
  // une seconde fois sous un autre nom.
  byBanque(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<NamedCountListDto> {
    return this.groupBy(
      user,
      filter,
      Prisma.empty,
      Prisma.sql`bq."id"`,
      Prisma.sql`bq."shortName"`,
    );
  }

  bySyndicat(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<NamedCountListDto> {
    return this.groupBy(user, filter, Prisma.empty, Prisma.sql`sy."id"`, Prisma.sql`sy."sigle"`);
  }

  /**
   * Avancement de la phase 2, tous statuts représentés.
   *
   * Les quatre statuts sont émis même à zéro : un histogramme qui perd une barre
   * dès que le compteur tombe à zéro change de forme sans raison, et l'absence
   * de « Refus » se lit alors comme une panne de la série plutôt que comme une
   * bonne nouvelle.
   */
  async byPhase2Status(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<Phase2StatusListDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<{ key: Phase2Status; prospects: number }[]>`
      SELECT p."phase2Status" AS key, COUNT(*)::int AS prospects
      ${PROSPECT_FROM}
      WHERE ${where}
      GROUP BY 1
    `;

    const counts = new Map(rows.map((row) => [row.key, row.prospects]));
    const total = rows.reduce((sum, row) => sum + row.prospects, 0);

    return {
      items: PHASE2_STATUS_ORDER.map((status) => {
        const prospects = counts.get(status) ?? 0;
        return {
          status,
          label: PHASE2_STATUS_LABELS[status],
          prospects,
          share: share(prospects, total),
        };
      }),
      total,
    };
  }

  /**
   * Répartition des méthodes d'enrôlement obtenues.
   *
   * Les prospects sans méthode sont hors de cette série : `null` n'est pas une
   * méthode. Leur nombre se lit dans `by-phase2-status`, où ils forment les
   * statuts autres que « Méthode obtenue » — et le `total` renvoyé ici est donc
   * délibérément celui des seuls porteurs d'une méthode.
   */
  async byEnrollmentMethod(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<EnrollmentMethodListDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<{ key: EnrollmentMethod; prospects: number }[]>`
      SELECT p."enrollmentMethod" AS key, COUNT(*)::int AS prospects
      ${PROSPECT_FROM}
      WHERE ${where} AND p."enrollmentMethod" IS NOT NULL
      GROUP BY 1
    `;

    const counts = new Map(rows.map((row) => [row.key, row.prospects]));
    const total = rows.reduce((sum, row) => sum + row.prospects, 0);

    return {
      items: ENROLLMENT_METHOD_ORDER.map((method) => {
        const prospects = counts.get(method) ?? 0;
        return {
          method,
          label: ENROLLMENT_METHOD_LABELS[method],
          prospects,
          share: share(prospects, total),
        };
      }),
      total,
    };
  }

  /**
   * Répartition BDD1–BDD4.
   *
   * Le segment est calculé en SQL par `SEGMENT_EXPR`, construit à partir des
   * mêmes axes que `segmentWhere` : le chiffre du graphique et le contenu de
   * l'onglet du classeur sortent donc littéralement de la même définition.
   */
  async bySegment(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<SegmentListDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      { segment: BddSegment; prospects: number; obtained: number }[]
    >`
      SELECT
        ${SEGMENT_EXPR} AS segment,
        COUNT(*)::int   AS prospects,
        COUNT(*) FILTER (WHERE p."phase2Status" = 'METHOD_OBTAINED')::int AS obtained
      ${PROSPECT_FROM}
      WHERE ${where}
      GROUP BY 1
    `;

    const counts = new Map(rows.map((row) => [row.segment, row]));
    const total = rows.reduce((sum, row) => sum + row.prospects, 0);

    return {
      items: ALL_SEGMENTS.map((segment) => {
        const row = counts.get(segment);
        const prospects = row?.prospects ?? 0;
        return {
          segment,
          label: SEGMENT_LABELS[segment],
          prospects,
          share: share(prospects, total),
          methodObtained: row?.obtained ?? 0,
        };
      }),
      total,
    };
  }

  async topRepresentants(
    user: AuthenticatedUser,
    query: TopQueryDto,
  ): Promise<TopRepresentantListDto> {
    const where = prospectConditions(user, query, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        label: string;
        phone: string;
        departement: string;
        commercial: string;
        prospects: number;
      }[]
    >`
      SELECT
        r."id"          AS id,
        r."fullName"    AS label,
        r."phoneE164"   AS phone,
        d."name"        AS departement,
        u."fullName"    AS commercial,
        COUNT(*)::int   AS prospects
      ${PROSPECT_FROM}
      INNER JOIN "departements" d ON d."id" = r."departementId"
      INNER JOIN "users" u ON u."id" = r."createdById"
      WHERE ${where}
      GROUP BY r."id", r."fullName", r."phoneE164", d."name", u."fullName"
      ORDER BY prospects DESC, label ASC
      LIMIT ${query.limit ?? 10}
    `;

    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        phoneE164: row.phone,
        departementName: row.departement,
        commercialName: row.commercial,
        prospects: row.prospects,
      })),
      total: rows.reduce((sum, row) => sum + row.prospects, 0),
    };
  }

  private async groupBy(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
    join: Prisma.Sql,
    idColumn: Prisma.Sql,
    labelColumn: Prisma.Sql,
  ): Promise<NamedCountListDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());
    const rows = await this.prisma.$queryRaw<{ id: string; label: string; prospects: number }[]>`
      SELECT ${idColumn} AS id, ${labelColumn} AS label, COUNT(*)::int AS prospects
      ${PROSPECT_FROM}
      ${join}
      WHERE ${where}
      GROUP BY ${idColumn}, ${labelColumn}
      ORDER BY prospects DESC, label ASC
    `;

    const total = rows.reduce((sum, row) => sum + row.prospects, 0);
    return {
      items: rows.map((row) => ({
        id: row.id,
        label: row.label,
        prospects: row.prospects,
        share: share(row.prospects, total),
      })),
      total,
    };
  }
}

/** Part en pourcentage, arrondie au dixième. Zéro plutôt qu'une division par zéro. */
const share = (value: number, total: number): number =>
  total === 0 ? 0 : Math.round((value / total) * 1000) / 10;
