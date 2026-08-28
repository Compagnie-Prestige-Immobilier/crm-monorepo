import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { UNUSABLE_OUTCOMES, ALL_ROWS, rate } from './pilotage.sql.js';
import { SupervisionGranularity } from './supervision.dto.js';
import type {
  SupervisionActivityDto,
  SupervisionHistogramBarDto,
  SupervisionActivityRowDto,
  SupervisionQueryDto,
  SupervisionTeleconseillerDto,
} from './supervision.dto.js';

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

    const attemptScope = ALL_ROWS;
    const taskScope = ALL_ROWS;
    const userScope = ALL_ROWS;
    const teleconseiller = Prisma.sql`u."role" = ${Role.COMMERCIAL}::"Role" AND u."deletedAt" IS NULL AND ${userScope}`;

    const [rows, roster, prospectsByTeleconseiller, prospectsByRepresentant] = await Promise.all([
      this.prisma.$queryRaw<ActivityRow[]>`
        WITH faits AS (
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
          WHERE ${attemptScope} AND ${withinWindow(Prisma.sql`ca."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            p."createdById", date_trunc(${unit}, p."clientCreatedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 1, NULL::text, 0
          FROM "prospects" p
          WHERE p."deletedAt" IS NULL AND TRUE
            AND ${withinWindow(Prisma.sql`p."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            rca."performedById", date_trunc(${unit}, rca."clientCreatedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 0, rca."representantId", 0
          FROM "rep_call_attempts" rca
          WHERE TRUE
            AND ${withinWindow(Prisma.sql`rca."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            ct."assignedToId", date_trunc(${unit}, ct."completedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 0, NULL::text, 1
          FROM "call_tasks" ct
          WHERE ct."completedAt" IS NOT NULL AND ${taskScope}
            AND ${withinWindow(Prisma.sql`ct."completedAt"`, query)}
        )
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
          AND ${withinWindow(Prisma.sql`p."clientCreatedAt"`, query)}
        GROUP BY r."id", r."fullName"
        ORDER BY prospects DESC, label ASC
      `,
    ]);

    return {
      from: query.actFrom ? inclusiveDateFrom(query.actFrom).toISOString() : null,
      to: query.actTo ? inclusiveDateTo(query.actTo).toISOString() : null,
      granularity,
      items: rows.map((row): SupervisionActivityRowDto => ({
        bucket: row.jour,
        teleconseillerId: row.id,
        teleconseillerName: row.nom,
        calls: row.appels,
        unreachable: row.injoignables,
        wrongNumber: row.faux,
        refused: row.refus,
        other: row.autres,
        methodObtained: row.methodes,
        callback: row.rappels,
        reachRate: rate(row.joignables, row.appels),
        prospectsCreated: row.prospects,
        representantsContacted: row.representants,
        tasksClosed: row.taches,
      })),
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
