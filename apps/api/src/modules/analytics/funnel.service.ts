import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { prospectConditions, PROSPECT_FROM } from './analytics.sql.js';
import type { AnalyticsFinanceDto, AnalyticsFunnelDto, FunnelStageDto } from './funnel.dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';

/**
 * L'entonnoir et l'argent.
 *
 * Deux requêtes, pas une : l'entonnoir se compte sur les PROSPECTS filtrés,
 * l'argent se compte sur les DOSSIERS. Les joindre en une seule requête
 * multiplierait les lignes — un prospect peut porter plusieurs dossiers — et
 * gonflerait les montants d'un facteur invisible à la relecture.
 */
@Injectable()
export class FunnelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async funnel(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<AnalyticsFunnelDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());

    const [stages, finance] = await Promise.all([this.stages(where), this.finance(where)]);

    return { etapes: stages, finance };
  }

  // ── L'entonnoir ────────────────────────────────────────────────────────────

  private async stages(where: Prisma.Sql): Promise<FunnelStageDto[]> {
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
      LEFT JOIN "bank_cases" bc
        ON bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
      LEFT JOIN "bank_case_stages" st
        ON st."id" = bc."currentStageId"
      WHERE ${where}
    `;

    const row = rows[0] ?? { prospects: 0, methodes: 0, dossiers: 0, encaisses: 0 };
    const sommet = row.prospects;

    // Le taux par rapport à l'étape PRÉCÉDENTE est celui qui montre où la
    // chaîne se casse. Le taux global, seul, noie la marche défaillante dans la
    // moyenne : 2 % de conversion finale ne dit pas si le problème est la
    // collecte de méthodes ou le traitement bancaire.
    const build = (label: string, count: number, precedent: number): FunnelStageDto => ({
      label,
      count,
      tauxEtapePrecedente: precedent === 0 ? 0 : Math.round((count / precedent) * 1000) / 10,
      tauxGlobal: sommet === 0 ? 0 : Math.round((count / sommet) * 1000) / 10,
    });

    return [
      build('Prospects saisis', row.prospects, row.prospects),
      build('Méthode obtenue', row.methodes, row.prospects),
      build('Dossier ouvert', row.dossiers, row.methodes),
      build('Dossier encaissé', row.encaisses, row.dossiers),
    ];
  }

  // ── L'argent ───────────────────────────────────────────────────────────────

  private async finance(where: Prisma.Sql): Promise<AnalyticsFinanceDto> {
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
        SELECT bc."id", bc."amountXof", bc."createdAt", bc."updatedAt", st."type"
        ${PROSPECT_FROM}
        JOIN "bank_cases" bc
          ON bc."prospectId" = p."id" AND bc."deletedAt" IS NULL
        JOIN "bank_case_stages" st
          ON st."id" = bc."currentStageId"
        WHERE ${where}
      )
      SELECT
        COUNT(*)::int                                              AS dossiers,
        COUNT(*) FILTER (WHERE "type" = 'OPEN')::int               AS ouverts,
        COUNT(*) FILTER (WHERE "type" = 'CASHED')::int             AS encaisses,
        COUNT(*) FILTER (WHERE "type" = 'REJECTED')::int           AS rejetes,
        COALESCE(SUM("amountXof") FILTER (WHERE "type" = 'CASHED'), 0)::text AS montant,
        COALESCE(SUM("amountXof") FILTER (
          WHERE "type" = 'CASHED' AND "updatedAt" >= now() - interval '30 days'
        ), 0)::text                                                AS montant30,
        AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400) FILTER (
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
      // Un dossier ouvert n'a pas de montant : il n'est connu qu'à
      // l'encaissement. On ne l'invente pas — annoncer un « en cours » chiffré
      // sur des dossiers sans montant serait une prévision déguisée en fait.
      montantEnCours: '0',
      encaissementMoyen: encaisses === 0 ? '0' : (BigInt(montant) / BigInt(encaisses)).toString(),
      montantEncaisse30Jours: row?.montant30 ?? '0',
      dossiers,
      dossiersOuverts: row?.ouverts ?? 0,
      dossiersEncaisses: encaisses,
      dossiersRejetes: rejetes,
      // Sur les dossiers CLOS, pas sur tous : sinon ouvrir des dossiers ferait
      // baisser le taux de rejet sans qu'aucun rejet n'ait disparu.
      tauxRejet: clos === 0 ? 0 : Math.round((rejetes / clos) * 1000) / 10,
      delaiMoyenJours: row?.delai == null ? null : Math.round(row.delai * 10) / 10,
    };
  }
}
