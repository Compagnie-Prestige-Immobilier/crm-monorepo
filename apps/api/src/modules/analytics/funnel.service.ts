import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { prospectConditions, PROSPECT_FROM } from './analytics.sql.js';
import { BANK_CASE, demoScopeOn } from './pilotage.sql.js';
import { closedAtLateral } from '../bank-cases/bank-cases.sql.js';
import type { AnalyticsFinanceDto, AnalyticsFunnelDto, FunnelStageDto } from './funnel.dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
/** Date d'encaissement ou de rejet lue dans l'HISTORIQUE : `updatedAt` bouge à chaque écriture et fausserait délai et montant 30 jours. */
const CLOSED_AT = closedAtLateral(BANK_CASE);

@Injectable()
export class FunnelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async funnel(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<AnalyticsFunnelDto> {
    const demoEnabled = await this.demo.enabled();
    const where = prospectConditions(user, filter, demoEnabled);

    const [stages, finance] = await Promise.all([
      this.stages(where, demoEnabled),
      this.finance(where, demoEnabled),
    ]);

    return { etapes: stages, finance };
  }

  private async stages(where: Prisma.Sql, demoEnabled: boolean): Promise<FunnelStageDto[]> {
    const rows = await this.prisma.$queryRaw<
      {
        prospects: number;
        methodes: number;
        dossiers: number;
        encaisses: number;
      }[]
    >`
      SELECT
        COUNT(*)::int                                                       AS prospects,
        COUNT(*) FILTER (WHERE p."phase2Status" = 'METHOD_OBTAINED')::int   AS methodes,
        COUNT(DISTINCT bc."prospectId")::int                                AS dossiers,
        COUNT(DISTINCT bc."prospectId") FILTER (
          WHERE st."type" = 'CASHED'
        )::int                                                              AS encaisses
      ${PROSPECT_FROM}
      -- Visibilité démo dans le ON et non le WHERE : la jointure est EXTERNE, un
      -- WHERE sur bc la rendrait interne et supprimerait le sommet de l'entonnoir.
      LEFT JOIN "bank_cases" bc
        ON bc."prospectId" = p."id"
       AND bc."deletedAt" IS NULL
       AND ${demoScopeOn(BANK_CASE, demoEnabled)}
      LEFT JOIN "bank_case_stages" st
        ON st."id" = bc."currentStageId"
      WHERE ${where}
    `;

    const row = rows[0] ?? { prospects: 0, methodes: 0, dossiers: 0, encaisses: 0 };
    const sommet = row.prospects;

    const build = (label: string, count: number, precedent: number): FunnelStageDto => ({
      label,
      count,
      tauxEtapePrecedente: precedent === 0 ? null : Math.round((count / precedent) * 1000) / 10,
      tauxGlobal: sommet === 0 ? null : Math.round((count / sommet) * 1000) / 10,
    });

    return [
      build('Prospects saisis', row.prospects, row.prospects),
      build('Méthode obtenue', row.methodes, row.prospects),
      build('Dossier ouvert', row.dossiers, row.methodes),
      build('Dossier encaissé', row.encaisses, row.dossiers),
    ];
  }

  private async finance(where: Prisma.Sql, demoEnabled: boolean): Promise<AnalyticsFinanceDto> {
    const rows = await this.prisma.$queryRaw<
      {
        dossiers: number;
        ouverts: number;
        encaisses: number;
        rejetes: number;
        montant: string | null;
        montant30: string | null;
        delai: number | null;
      }[]
    >`
      WITH portee AS (
        SELECT bc."id", bc."amountXof", bc."createdAt", cl."closedAt", st."type"
        ${PROSPECT_FROM}
        JOIN "bank_cases" bc
          ON bc."prospectId" = p."id"
         AND bc."deletedAt" IS NULL
         AND ${demoScopeOn(BANK_CASE, demoEnabled)}
        JOIN "bank_case_stages" st
          ON st."id" = bc."currentStageId"
        ${CLOSED_AT}
        WHERE ${where}
      )
      SELECT
        COUNT(*)::int                                              AS dossiers,
        COUNT(*) FILTER (WHERE "type" = 'OPEN')::int               AS ouverts,
        COUNT(*) FILTER (WHERE "type" = 'CASHED')::int             AS encaisses,
        COUNT(*) FILTER (WHERE "type" = 'REJECTED')::int           AS rejetes,
        COALESCE(SUM("amountXof") FILTER (WHERE "type" = 'CASHED'), 0)::text AS montant,
        COALESCE(SUM("amountXof") FILTER (
          WHERE "type" = 'CASHED' AND "closedAt" >= now() - interval '30 days'
        ), 0)::text                                                AS montant30,
        AVG(EXTRACT(EPOCH FROM ("closedAt" - "createdAt")) / 86400) FILTER (
          WHERE "type" IN ('CASHED', 'REJECTED')
        )::float                                                   AS delai
      FROM portee
    `;

    const row = rows[0];
    const dossiers = row?.dossiers ?? 0;
    const encaisses = row?.encaisses ?? 0;
    const rejetes = row?.rejetes ?? 0;
    const montant = row?.montant ?? '0';
    const clos = encaisses + rejetes;

    return {
      montantEncaisse: montant,
      montantEnCours: '0',
      encaissementMoyen: encaisses === 0 ? '0' : (BigInt(montant) / BigInt(encaisses)).toString(),
      montantEncaisse30Jours: row?.montant30 ?? '0',
      dossiers,
      dossiersOuverts: row?.ouverts ?? 0,
      dossiersEncaisses: encaisses,
      dossiersRejetes: rejetes,
      tauxRejet: clos === 0 ? 0 : Math.round((rejetes / clos) * 1000) / 10,
      delaiMoyenJours: row?.delai == null ? null : Math.round(row.delai * 10) / 10,
    };
  }
}
