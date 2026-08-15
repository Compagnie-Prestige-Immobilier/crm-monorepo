import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { ProspectFilterDto } from '../../common/dto/prospect-filter.dto.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PROSPECT_FROM, prospectConditions } from './analytics.sql.js';
import { ATTEMPT, UNUSABLE_OUTCOMES, demoScopeOn, rate } from './pilotage.sql.js';
import type {
  DataQualityDto,
  DataQualityRowDto,
  OriginBreakdownDto,
  RepresentantProductivityListDto,
  RepresentantProductivityQueryDto,
} from './quality.dto.js';
/** Seuil de dormance par défaut, en jours. Un trimestre sans apport. */
const DORMANT_DAYS = 90;

/**
 * Libellés des provenances connues.
 *
 * `origin` n'est PAS une chaîne libre : la base porte la contrainte
 * `prospects_origin_known`, qui n'accepte que NULL ou une valeur de
 * `PROSPECT_ORIGINS`. Un canal nouveau passe donc toujours par une migration.
 *
 * Le repli « rendu tel quel » reste utile pour autant, et c'est sa seule
 * raison d'être : entre la migration qui étend la contrainte et le déploiement
 * qui ajoute le libellé, l'écran doit montrer le code brut plutôt que
 * « Inconnu », qui effacerait l'apparition du canal au lieu de la signaler.
 */
const ORIGIN_LABELS: Record<string, string> = { BANQUE: 'Banque' };

/**
 * Une fiche sans provenance n'est pas une fiche de provenance inconnue : c'est
 * le chemin NORMAL, la tournée terrain, où `createdById` dit déjà tout.
 */
const TERRAIN = 'Saisie terrain';

const originLabel = (origin: string | null): string =>
  origin === null ? TERRAIN : (ORIGIN_LABELS[origin] ?? origin);

/**
 * Productivité des représentants, qualité de la base, provenance.
 *
 * Les trois agrégats partagent le filtre commun et le cloisonnement par
 * commercial : un COMMERCIAL lit la qualité de SES fiches, jamais celle des
 * fiches de ses collègues.
 */
@Injectable()
export class QualityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  /**
   * Ce qu'un représentant apporte, et depuis quand il n'apporte plus.
   *
   * Le classement par volume seul garde en tête un représentant inactif depuis
   * huit mois : le drapeau `dormant` est calculé en base, sur le dernier apport
   * réel, pour qu'aucun écran n'ait à refaire ce calcul avec un fuseau horaire
   * différent du serveur.
   *
   * Le seuil est un paramètre et non une constante : un représentant de zone
   * dense apporte des fiches toutes les semaines, un représentant de zone
   * rurale tous les trimestres, et un seuil unique déclarerait le second mort.
   */
  async representantProductivity(
    user: AuthenticatedUser,
    query: RepresentantProductivityQueryDto,
  ): Promise<RepresentantProductivityListDto> {
    const where = prospectConditions(user, query, await this.demo.enabled());
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
        (
          MAX(p."clientCreatedAt") < now() - (${dormantDays}::int * interval '1 day')
        )                                                                 AS dormant,
        -- Total de la POPULATION, pas du haut de classement.
        --
        -- Sommer les lignes rendues additionnerait les prospects des dix
        -- meilleurs représentants et les publierait sous un nom qui se lit
        -- « nombre total de prospects » : avec 400 représentants, l'écart est
        -- d'un ordre de grandeur, et rien à l'écran ne le signale.
        --
        -- Une fonction de fenêtre est évaluée APRÈS le GROUP BY mais AVANT le
        -- LIMIT : elle voit donc tous les représentants, sans seconde requête.
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
   * Part de numéros inexploitables, par représentant ET par département.
   *
   * Les deux listes sortent de la MÊME population de tentatives, comptée deux
   * fois selon deux axes. Une tentative appartient à un seul représentant, qui
   * appartient à un seul département : les deux totaux sont donc égaux, et
   * l'écran peut les rapprocher sans précaution.
   *
   * La mesure porte sur les TENTATIVES et non sur les prospects : un numéro
   * appelé six fois sans réponse coûte six appels, et c'est ce coût que le
   * téléconseiller supporte.
   */
  async dataQuality(user: AuthenticatedUser, filter: ProspectFilterDto): Promise<DataQualityDto> {
    const demoEnabled = await this.demo.enabled();
    const where = prospectConditions(user, filter, demoEnabled);
    const scope = demoScopeOn(ATTEMPT, demoEnabled);

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

  /**
   * Répartition par provenance, puis par libellé détaillé.
   *
   * Deux niveaux plutôt qu'un seul : la clé `origin` sert à décider (ouvrir un
   * canal, le fermer), le libellé sert à savoir QUI, et mélanger les deux dans
   * une même liste donnerait un graphique où « Banque » et « CBAO Thiès »
   * seraient des parts concurrentes du même total.
   */
  async originBreakdown(
    user: AuthenticatedUser,
    filter: ProspectFilterDto,
  ): Promise<OriginBreakdownDto> {
    const where = prospectConditions(user, filter, await this.demo.enabled());

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

  /** Même comptage, deux axes. Écrit une fois pour que les deux listes ne divergent pas. */
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
      ORDER BY COUNT(*) FILTER (WHERE ca."outcome" IN ${UNUSABLE_OUTCOMES}) DESC, label ASC
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
