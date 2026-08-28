import { Injectable } from '@nestjs/common';
import { Prisma, Projet, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import {
  UNUSABLE_OUTCOMES,
  REP_ANSWERED_OUTCOMES,
  REP_LIVE_OUTCOMES,
  ALL_ROWS,
  rate,
} from './pilotage.sql.js';
import { SupervisionGranularity } from './supervision.dto.js';
import type {
  SupervisionActivityCountsDto,
  SupervisionActivityDto,
  SupervisionHistogramBarDto,
  SupervisionActivityRowDto,
  SupervisionQueryDto,
  SupervisionTeleconseillerDto,
} from './supervision.dto.js';

/**
 * Qui passe des appels, et apparaît donc dans l'équipe. L'encadrement décroche
 * lui aussi : le borner au COMMERCIAL effaçait ses propres appels de l'écran.
 * L'ADMIN en est absent : c'est un compte d'administration, pas de plateau.
 */
const TELECONSEIL_ROLES = [Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION] as const;

interface ActivityRow {
  jour: string;
  id: string;
  nom: string;
  appels: number;
  injoignables: number;
  faux: number;
  refus: number;
  autres: number;
  methodes: number;
  rappels: number;
  joignables: number;
  prospects: number;
  representants: number;
  taches: number;
}

type TotalRow = Omit<ActivityRow, 'jour' | 'id' | 'nom'>;

const TOTAL_VIDE: TotalRow = {
  appels: 0,
  injoignables: 0,
  faux: 0,
  refus: 0,
  autres: 0,
  methodes: 0,
  rappels: 0,
  joignables: 0,
  prospects: 0,
  representants: 0,
  taches: 0,
};

type RepTotalRow = Omit<RepRow, 'jour' | 'id'>;

interface RepRow {
  jour: string;
  id: string;
  appels: number;
  joints: number;
  rappels: number;
  injoignables: number;
  autres: number;
  interroges: number;
  qualifies: number;
}

const REP_VIDE: Omit<RepRow, 'jour' | 'id'> = {
  appels: 0,
  joints: 0,
  rappels: 0,
  injoignables: 0,
  autres: 0,
  interroges: 0,
  qualifies: 0,
};

interface RosterRow {
  id: string;
  nom: string;
  actif: boolean;
  ouvertes: number;
}

interface HistogramRow {
  id: string | null;
  label: string;
  prospects: number;
}

@Injectable()
export class SupervisionActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async activite(query: SupervisionQueryDto): Promise<SupervisionActivityDto> {
    const granularity = query.granularity ?? SupervisionGranularity.DAY;
    // `date_trunc` exige un littéral, jamais un paramètre.
    const unit =
      granularity === SupervisionGranularity.WEEK ? Prisma.sql`'week'` : Prisma.sql`'day'`;

    const campaign = (column: Prisma.Sql): Prisma.Sql =>
      query.campaignId ? Prisma.sql`${column} = ${query.campaignId}` : ALL_ROWS;

    const attemptScope = campaign(Prisma.sql`ca."campaignId"`);
    const taskScope = campaign(Prisma.sql`ct."campaignId"`);
    const userScope = query.commercialId ? Prisma.sql`u."id" = ${query.commercialId}` : ALL_ROWS;
    const rolesDuPlateau = Prisma.join(
      TELECONSEIL_ROLES.map((role) => Prisma.sql`${role}::"Role"`),
    );
    const teleconseiller = Prisma.sql`u."role" IN (${rolesDuPlateau}) AND u."deletedAt" IS NULL AND ${userScope}`;

    // Un représentant est CHUES par construction : filtrer Grand Public le sort.
    const repScope =
      query.projet === Projet.GRAND_PUBLIC
        ? Prisma.sql`FALSE`
        : campaign(Prisma.sql`rca."campaignId"`);

    const repWindow = withinWindow(Prisma.sql`rca."clientCreatedAt"`, query);
    const projetScope = (prospectId: Prisma.Sql): Prisma.Sql =>
      query.projet === undefined
        ? ALL_ROWS
        : Prisma.sql`EXISTS (
            SELECT 1 FROM "prospect_journeys" pj
            WHERE pj."prospectId" = ${prospectId} AND pj."projet" = ${query.projet}::"Projet"
          )`;

    // La ligne d'équipe se relit sur les MÊMES faits que les lignes d'agents,
    // sinon les deux dérivent au premier filtre ajouté.
    const membreEquipe = (column: Prisma.Sql): Prisma.Sql =>
      Prisma.sql`${column} IN (SELECT u."id" FROM "users" u WHERE ${teleconseiller})`;

    const faits = Prisma.sql`
          SELECT
            ca."performedById"                              AS "userId",
            date_trunc(${unit}, ca."clientCreatedAt")       AS bucket,
            1                                               AS appel,
            (ca."outcome" = 'UNREACHABLE')::int             AS injoignable,
            (ca."outcome" = 'WRONG_NUMBER')::int            AS faux,
            (ca."outcome" = 'REFUSED')::int                 AS refus,
            (ca."outcome" = 'OTHER')::int                   AS autre,
            (ca."outcome" = 'METHOD_OBTAINED')::int         AS methode,
            (ca."outcome" = 'CALLBACK')::int                AS rappel,
            (ca."outcome" NOT IN ${UNUSABLE_OUTCOMES})::int AS joignable,
            0                                               AS prospect,
            NULL::text                                      AS representant,
            0                                               AS tache
          FROM "call_attempts" ca
          WHERE ${attemptScope} AND ${projetScope(Prisma.sql`ca."prospectId"`)}
            AND ${withinWindow(Prisma.sql`ca."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            p."createdById", date_trunc(${unit}, p."clientCreatedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 1, NULL::text, 0
          FROM "prospects" p
          WHERE p."deletedAt" IS NULL AND ${projetScope(Prisma.sql`p."id"`)}
            AND ${withinWindow(Prisma.sql`p."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            rca."performedById", date_trunc(${unit}, rca."clientCreatedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 0, rca."representantId", 0
          FROM "rep_call_attempts" rca
          WHERE ${repScope}
            AND ${repWindow}

          UNION ALL
          SELECT
            ct."assignedToId", date_trunc(${unit}, ct."completedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 0, NULL::text, 1
          FROM "call_tasks" ct
          WHERE ct."completedAt" IS NOT NULL AND ${taskScope}
            AND ${projetScope(Prisma.sql`ct."prospectId"`)}
            AND ${withinWindow(Prisma.sql`ct."completedAt"`, query)}
    `;

    const repTentatives = Prisma.sql`
          SELECT
            rca."performedById"                             AS "userId",
            date_trunc(${unit}, rca."clientCreatedAt")      AS bucket,
            (rca."outcome" IN ${REP_LIVE_OUTCOMES})::int     AS appel,
            (rca."outcome" IN ${REP_ANSWERED_OUTCOMES})::int AS joint,
            (rca."outcome" = 'CALLBACK')::int                AS rappel,
            (rca."outcome" = 'UNREACHABLE')::int             AS injoignable,
            (rca."outcome" NOT IN ${REP_LIVE_OUTCOMES})::int AS autre
          FROM "rep_call_attempts" rca
          WHERE ${repScope} AND ${repWindow}
    `;

    // Un représentant ne se qualifie qu'une fois : c'est sa DERNIÈRE réponse de
    // la fenêtre qui vaut, et elle revient à qui l'a obtenue. Le classement se
    // fait sur TOUS les agents, sans quoi filtrer sur l'un lui attribuerait une
    // réponse que l'autre a obtenue après lui.
    const repReponses = Prisma.sql`
          SELECT DISTINCT ON (rca."representantId")
            rca."performedById"                        AS "userId",
            date_trunc(${unit}, rca."clientCreatedAt") AS bucket,
            (rca."outcome" = 'REACHED')::int           AS qualifie
          FROM "rep_call_attempts" rca
          WHERE rca."outcome" IN ${REP_ANSWERED_OUTCOMES} AND ${repScope} AND ${repWindow}
          ORDER BY rca."representantId", rca."clientCreatedAt" DESC, rca."id" DESC
    `;

    const [
      rows,
      repRows,
      [totalRow],
      [repTotalRow],
      roster,
      prospectsByTeleconseiller,
      prospectsByRepresentant,
    ] = await Promise.all([
      this.prisma.$queryRaw<ActivityRow[]>`
        WITH faits AS (${faits})
        SELECT
          to_char(f.bucket, 'YYYY-MM-DD')      AS jour,
          u."id"                               AS id,
          u."fullName"                         AS nom,
          SUM(f.appel)::int                    AS appels,
          SUM(f.injoignable)::int              AS injoignables,
          SUM(f.faux)::int                     AS faux,
          SUM(f.refus)::int                    AS refus,
          SUM(f.autre)::int                    AS autres,
          SUM(f.methode)::int                  AS methodes,
          SUM(f.rappel)::int                   AS rappels,
          SUM(f.joignable)::int                AS joignables,
          SUM(f.prospect)::int                 AS prospects,
          COUNT(DISTINCT f.representant)::int  AS representants,
          SUM(f.tache)::int                    AS taches
        FROM faits f
        INNER JOIN "users" u ON u."id" = f."userId"
        WHERE ${teleconseiller}
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC, 3 ASC
      `,
      this.prisma.$queryRaw<RepRow[]>`
        WITH tentatives AS (${repTentatives}),
        reponses AS (${repReponses}),
        interroges AS (
          SELECT "userId", bucket, COUNT(*)::int AS interroges, SUM(qualifie)::int AS qualifies
          FROM reponses
          GROUP BY 1, 2
        )
        SELECT
          to_char(t.bucket, 'YYYY-MM-DD')     AS jour,
          t."userId"                          AS id,
          SUM(t.appel)::int                   AS appels,
          SUM(t.joint)::int                   AS joints,
          SUM(t.rappel)::int                  AS rappels,
          SUM(t.injoignable)::int             AS injoignables,
          SUM(t.autre)::int                   AS autres,
          COALESCE(MAX(i.interroges), 0)::int AS interroges,
          COALESCE(MAX(i.qualifies), 0)::int  AS qualifies
        FROM tentatives t
        LEFT JOIN interroges i ON i."userId" = t."userId" AND i.bucket = t.bucket
        GROUP BY 1, 2
      `,
      this.prisma.$queryRaw<TotalRow[]>`
        WITH faits AS (${faits})
        SELECT
          COALESCE(SUM(f.appel), 0)::int       AS appels,
          COALESCE(SUM(f.injoignable), 0)::int AS injoignables,
          COALESCE(SUM(f.faux), 0)::int        AS faux,
          COALESCE(SUM(f.refus), 0)::int       AS refus,
          COALESCE(SUM(f.autre), 0)::int       AS autres,
          COALESCE(SUM(f.methode), 0)::int     AS methodes,
          COALESCE(SUM(f.rappel), 0)::int      AS rappels,
          COALESCE(SUM(f.joignable), 0)::int   AS joignables,
          COALESCE(SUM(f.prospect), 0)::int    AS prospects,
          COUNT(DISTINCT f.representant)::int  AS representants,
          COALESCE(SUM(f.tache), 0)::int       AS taches
        FROM faits f
        WHERE ${membreEquipe(Prisma.sql`f."userId"`)}
      `,
      this.prisma.$queryRaw<RepTotalRow[]>`
        WITH tentatives AS (${repTentatives}),
        reponses AS (${repReponses})
        SELECT
          COALESCE(SUM(t.appel), 0)::int       AS appels,
          COALESCE(SUM(t.joint), 0)::int       AS joints,
          COALESCE(SUM(t.rappel), 0)::int      AS rappels,
          COALESCE(SUM(t.injoignable), 0)::int AS injoignables,
          COALESCE(SUM(t.autre), 0)::int       AS autres,
          (
            SELECT COUNT(*)::int FROM reponses r
            WHERE ${membreEquipe(Prisma.sql`r."userId"`)}
          )                                    AS interroges,
          (
            SELECT COALESCE(SUM(r.qualifie), 0)::int FROM reponses r
            WHERE ${membreEquipe(Prisma.sql`r."userId"`)}
          )                                    AS qualifies
        FROM tentatives t
        WHERE ${membreEquipe(Prisma.sql`t."userId"`)}
      `,
      this.prisma.$queryRaw<RosterRow[]>`
        SELECT
          u."id"              AS id,
          u."fullName"        AS nom,
          u."isActive"        AS actif,
          COUNT(ct."id")::int AS ouvertes
        FROM "users" u
        LEFT JOIN "call_tasks" ct
          ON ct."assignedToId" = u."id" AND ct."status" = 'OPEN' AND ${taskScope}
        WHERE ${teleconseiller}
        GROUP BY u."id", u."fullName", u."isActive"
        ORDER BY u."fullName" ASC
      `,
      this.prisma.$queryRaw<HistogramRow[]>`
        SELECT
          u."id"                   AS id,
          u."fullName"             AS label,
          COUNT(p."id")::int       AS prospects
        FROM "users" u
        LEFT JOIN "prospects" p
          ON p."createdById" = u."id"
          AND p."deletedAt" IS NULL
          AND ${projetScope(Prisma.sql`p."id"`)}
          AND ${withinWindow(Prisma.sql`p."clientCreatedAt"`, query)}
        WHERE ${teleconseiller}
        GROUP BY u."id", u."fullName"
        ORDER BY prospects DESC, label ASC
      `,
      this.prisma.$queryRaw<HistogramRow[]>`
        SELECT
          r."id"                   AS id,
          r."fullName"             AS label,
          COUNT(p."id")::int       AS prospects
        FROM "representants" r
        INNER JOIN "prospects" p
          ON p."representantId" = r."id"
          AND p."deletedAt" IS NULL
          AND ${projetScope(Prisma.sql`p."id"`)}
          AND ${withinWindow(Prisma.sql`p."clientCreatedAt"`, query)}
        GROUP BY r."id", r."fullName"
        ORDER BY prospects DESC, label ASC
      `,
    ]);

    const repParLigne = new Map(repRows.map((row) => [`${row.jour}|${row.id}`, row]));

    return {
      from: query.actFrom ? inclusiveDateFrom(query.actFrom).toISOString() : null,
      to: query.actTo ? inclusiveDateTo(query.actTo).toISOString() : null,
      granularity,
      totals: chiffres(totalRow ?? TOTAL_VIDE, repTotalRow ?? REP_VIDE),
      items: rows.map((row): SupervisionActivityRowDto => {
        const rep = repParLigne.get(`${row.jour}|${row.id}`) ?? REP_VIDE;
        return Object.assign(chiffres(row, rep), {
          bucket: row.jour,
          teleconseillerId: row.id,
          teleconseillerName: row.nom,
        });
      }),
      teleconseillers: roster.map((row): SupervisionTeleconseillerDto => ({
        id: row.id,
        fullName: row.nom,
        isActive: row.actif,
        openTasks: row.ouvertes,
      })),
      prospectsByTeleconseiller: prospectsByTeleconseiller.map(toHistogramBar),
      prospectsByRepresentant: prospectsByRepresentant.map(toHistogramBar),
    };
  }
}

function chiffres(base: TotalRow, rep: RepTotalRow): SupervisionActivityCountsDto {
  return {
    calls: base.appels,
    unreachable: base.injoignables,
    wrongNumber: base.faux,
    refused: base.refus,
    other: base.autres,
    methodObtained: base.methodes,
    callback: base.rappels,
    reachRate: rate(base.joignables, base.appels),
    prospectsCreated: base.prospects,
    representantsContacted: base.representants,
    tasksClosed: base.taches,
    repCalls: rep.appels,
    repReached: rep.joints,
    repCallback: rep.rappels,
    repUnreachable: rep.injoignables,
    repOther: rep.autres,
    repContactRate: rate(rep.joints, rep.appels),
    repCallbackRate: rate(rep.rappels, rep.appels),
    repQuestioned: rep.interroges,
    repQualified: rep.qualifies,
    repQualificationRate: rate(rep.qualifies, rep.interroges),
  };
}

function toHistogramBar(row: HistogramRow): SupervisionHistogramBarDto {
  return { id: row.id, label: row.label, prospects: row.prospects };
}

function withinWindow(column: Prisma.Sql, query: SupervisionQueryDto): Prisma.Sql {
  const bounds: Prisma.Sql[] = [];
  if (query.actFrom) bounds.push(Prisma.sql`${column} >= ${inclusiveDateFrom(query.actFrom)}`);
  if (query.actTo) bounds.push(Prisma.sql`${column} <= ${inclusiveDateTo(query.actTo)}`);
  if (!bounds.length) return Prisma.sql`TRUE`;
  return Prisma.join(bounds, ' AND ');
}
