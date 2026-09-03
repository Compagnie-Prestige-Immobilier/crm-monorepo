import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Projet, Role } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { performanceScore } from '../admin/performance-score.js';
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
  SupervisionScoreDto,
  SupervisionTeleconseillerDto,
  WorkShiftDto,
} from './supervision.dto.js';
import { DEFAULT_SHIFTS, WorkShiftsService } from './work-shifts.service.js';

/**
 * Qui passe des appels, et apparaît donc dans l'équipe. L'encadrement décroche
 * lui aussi : le borner au COMMERCIAL effaçait ses propres appels de l'écran.
 * L'ADMIN en est absent : c'est un compte d'administration, pas de plateau.
 */
const TELECONSEIL_ROLES = [Role.COMMERCIAL, Role.SUPERVISEUR, Role.DIRECTION] as const;

/** Même seuil que la supervision des comptes : au-delà, l'écart devient du temps mort. */
const DEAD_GAP_SECONDS = 15 * 60;

const JOUR_SECONDES = 86_400;

interface Creneau {
  debut: number;
  fin: number;
}

function secondesHorloge(value: string): number {
  const [heures = 0, minutes = 0] = value.split(':').map(Number);
  return heures * 3600 + minutes * 60;
}

function horloge(secondes: number): string {
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  return `${String(heures).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Les créneaux rabotés par le filtre horaire. Sans cette intersection, demander
 * la seule matinée diviserait la note par une journée entière.
 */
function creneauxEffectifs(shifts: readonly WorkShiftDto[], query: SupervisionQueryDto): Creneau[] {
  const bas = query.timeFrom ? secondesHorloge(query.timeFrom) : 0;
  const haut = query.timeTo ? secondesHorloge(query.timeTo) : JOUR_SECONDES;
  return shifts
    .map((shift) => ({
      debut: Math.max(secondesHorloge(shift.start), bas),
      fin: Math.min(secondesHorloge(shift.end), haut),
    }))
    .filter((creneau) => creneau.fin > creneau.debut);
}

/** Un jour passé compte ses créneaux entiers, le jour courant sa portion écoulée. */
function secondesEcoulees(jour: string, creneaux: readonly Creneau[], now: Date): number {
  const aujourdhui = now.toISOString().slice(0, 10);
  if (jour > aujourdhui) return 0;
  const instant =
    jour < aujourdhui
      ? JOUR_SECONDES
      : now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return creneaux.reduce(
    (total, creneau) =>
      total + Math.min(Math.max(instant - creneau.debut, 0), creneau.fin - creneau.debut),
    0,
  );
}

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
}

interface HistogramRow {
  id: string | null;
  label: string;
  prospects: number;
}

interface ScoreRow {
  id: string;
  appels: number;
  joints: number;
  qualifies: number;
  rappels: number;
  tempsMort: number;
}

/** Un jour où le compte a été vu : une tranche de présence, un appel, ou les deux. */
interface JourVuRow {
  id: string;
  jour: string;
  actifs: number;
}

@Injectable()
export class SupervisionActivityService {
  private readonly logger = new Logger(SupervisionActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workShifts: WorkShiftsService,
  ) {}

  async activite(query: SupervisionQueryDto): Promise<SupervisionActivityDto> {
    const granularity = query.granularity ?? SupervisionGranularity.DAY;
    // `date_trunc` exige un littéral, jamais un paramètre.
    const unit =
      granularity === SupervisionGranularity.WEEK ? Prisma.sql`'week'` : Prisma.sql`'day'`;

    const attemptScope = ALL_ROWS;
    const userScope = query.commercialId ? Prisma.sql`u."id" = ${query.commercialId}` : ALL_ROWS;
    const rolesDuPlateau = Prisma.join(
      TELECONSEIL_ROLES.map((role) => Prisma.sql`${role}::"Role"`),
    );
    const teleconseiller = Prisma.sql`u."role" IN (${rolesDuPlateau}) AND u."deletedAt" IS NULL AND ${userScope}`;

    // Un représentant est CHUES par construction : filtrer Grand Public le sort.
    const repScope = query.projet === Projet.GRAND_PUBLIC ? Prisma.sql`FALSE` : ALL_ROWS;

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
            NULL::text                                      AS representant
          FROM "call_attempts" ca
          WHERE ${attemptScope} AND ${projetScope(Prisma.sql`ca."prospectId"`)}
            AND ${withinWindow(Prisma.sql`ca."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            p."createdById", date_trunc(${unit}, p."clientCreatedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 1, NULL::text
          FROM "prospects" p
          WHERE p."deletedAt" IS NULL AND ${projetScope(Prisma.sql`p."id"`)}
            AND ${withinWindow(Prisma.sql`p."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            rca."performedById", date_trunc(${unit}, rca."clientCreatedAt"),
            0, 0, 0, 0, 0, 0, 0, 0, 0, rca."representantId"
          FROM "rep_call_attempts" rca
          WHERE ${repScope}
            AND ${repWindow}

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

    // Les créneaux bornent le temps mort et le dénominateur de la note : lus
    // avant le reste, ils ne peuvent pas s'attendre dans le même `Promise.all`.
    const shifts = await this.workShifts
      .get()
      .then((settings) => settings.shifts)
      .catch((error: unknown) => {
        this.logger.warn(`créneaux illisibles, valeurs par défaut: ${String(error)}`);
        return [...DEFAULT_SHIFTS];
      });
    const creneaux = creneauxEffectifs(shifts, query);

    // Une seule ligne par appel, prospects et représentants confondus : c'est
    // l'assiette de la note, du temps mort et des rappels.
    const tentatives = Prisma.sql`
          SELECT
            ca."performedById"                              AS "userId",
            ca."clientCreatedAt"                            AS quand,
            'prospect'                                      AS famille,
            ca."prospectId"::text                           AS cible,
            (ca."outcome" NOT IN ${UNUSABLE_OUTCOMES})::int AS joint,
            (ca."outcome" = 'METHOD_OBTAINED')::int         AS qualifie
          FROM "call_attempts" ca
          WHERE ${projetScope(Prisma.sql`ca."prospectId"`)}
            AND ${withinWindow(Prisma.sql`ca."clientCreatedAt"`, query)}

          UNION ALL
          SELECT
            rca."performedById", rca."clientCreatedAt", 'representant',
            rca."representantId"::text,
            (rca."outcome" IN ${REP_ANSWERED_OUTCOMES})::int, 0
          FROM "rep_call_attempts" rca
          WHERE ${repScope} AND ${repWindow}
    `;

    const creneauDe = Prisma.sql`CASE ${Prisma.join(
      shifts.map(
        (shift) =>
          Prisma.sql`WHEN a.quand::time >= ${shift.start}::time AND a.quand::time < ${shift.end}::time THEN ${shift.key}::text`,
      ),
      ' ',
    )} END`;

    const situes = Prisma.sql`
          SELECT a.*, ${creneauDe} AS creneau, date_trunc('day', a.quand) AS jour
          FROM (${tentatives}) a
          INNER JOIN "users" u ON u."id" = a."userId"
          WHERE ${teleconseiller}
    `;

    // Un trou n'existe qu'à l'intérieur d'un créneau ET d'une journée : sans le
    // second test, une nuit entre deux appels passerait pour du temps mort.
    const ecartMort = Prisma.sql`
      EXTRACT(EPOCH FROM p.ecart) > ${DEAD_GAP_SECONDS}
      AND p.creneau = p."creneauPrecedent" AND p.jour = p."jourPrecedent"
    `;

    const dansCreneau = creneaux.length
      ? Prisma.join(
          creneaux.map(
            (creneau) =>
              Prisma.sql`(s."slot"::time >= ${horloge(creneau.debut)}::time AND s."slot"::time < ${horloge(creneau.fin)}::time)`,
          ),
          ' OR ',
        )
      : Prisma.sql`FALSE`;

    const [
      rows,
      repRows,
      [totalRow],
      [repTotalRow],
      roster,
      prospectsByTeleconseiller,
      prospectsByRepresentant,
      rendement,
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
          COUNT(DISTINCT f.representant)::int  AS representants
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
          COUNT(DISTINCT f.representant)::int  AS representants
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
          u."isActive"        AS actif
        FROM "users" u
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

      // La note complète l'écran, elle ne le porte pas : un échec vide `scores`
      // sans effacer l'activité.
      Promise.all([
        this.prisma.$queryRaw<ScoreRow[]>`
        WITH situes AS (${situes}),
        paced AS (
          SELECT
            s.*,
            s.quand - LAG(s.quand) OVER w AS ecart,
            LAG(s.creneau) OVER w         AS "creneauPrecedent",
            LAG(s.jour) OVER w            AS "jourPrecedent"
          FROM situes s
          WINDOW w AS (PARTITION BY s."userId" ORDER BY s.quand)
        ),
        rappels AS (
          SELECT "userId", SUM(n - 1)::int AS repetitions
          FROM (
            SELECT "userId", famille, cible, COUNT(*)::int AS n
            FROM situes GROUP BY 1, 2, 3
          ) t
          GROUP BY 1
        ),
        reponses AS (${repReponses}),
        representants_qualifies AS (
          SELECT "userId", SUM(qualifie)::int AS qualifies FROM reponses GROUP BY 1
        )
        SELECT
          p."userId"                                             AS id,
          COUNT(*)::int                                          AS appels,
          SUM(p.joint)::int                                      AS joints,
          (SUM(p.qualifie) + COALESCE(MAX(q.qualifies), 0))::int AS qualifies,
          COALESCE(MAX(r.repetitions), 0)::int                   AS rappels,
          COALESCE(
            SUM(EXTRACT(EPOCH FROM p.ecart)) FILTER (WHERE ${ecartMort}), 0
          )::int                                                 AS "tempsMort"
        FROM paced p
        LEFT JOIN representants_qualifies q ON q."userId" = p."userId"
        LEFT JOIN rappels r ON r."userId" = p."userId"
        GROUP BY p."userId"
      `,
        this.prisma.$queryRaw<JourVuRow[]>`
        WITH situes AS (${situes}),
        tranches AS (
          SELECT
            s."userId"                  AS "userId",
            date_trunc('day', s."slot") AS jour,
            COALESCE(SUM(s."activeSeconds") FILTER (WHERE ${dansCreneau}), 0)::int AS actifs
          FROM "agent_activity_slots" s
          INNER JOIN "users" u ON u."id" = s."userId"
          WHERE ${teleconseiller} AND ${withinWindow(Prisma.sql`s."slot"`, query)}
          GROUP BY 1, 2
        ),
        vus AS (
          SELECT "userId", jour, actifs FROM tranches
          UNION ALL
          SELECT "userId", jour, 0 FROM situes
        )
        SELECT
          "userId"                    AS id,
          to_char(jour, 'YYYY-MM-DD') AS jour,
          SUM(actifs)::int            AS actifs
        FROM vus
        GROUP BY 1, 2
      `,
      ]).catch((error: unknown) => {
        this.logger.warn(`rendement de la fenêtre indisponible: ${String(error)}`);
        return null;
      }),
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
      })),
      scores: rendement === null ? [] : notes(roster, rendement[0], rendement[1], creneaux),
      prospectsByTeleconseiller: prospectsByTeleconseiller.map(toHistogramBar),
      prospectsByRepresentant: prospectsByRepresentant.map(toHistogramBar),
    };
  }
}

const AUCUN_APPEL: Omit<ScoreRow, 'id'> = {
  appels: 0,
  joints: 0,
  qualifies: 0,
  rappels: 0,
  tempsMort: 0,
};

/**
 * Une note par téléconseiller sur toute la fenêtre. Le dénominateur ne retient
 * que les jours OÙ LE COMPTE A ÉTÉ VU : le dépôt n'a pas de calendrier ouvré, et
 * facturer les dimanches ferait chuter l'assiduité de tout le monde.
 */
function notes(
  roster: readonly RosterRow[],
  metriques: readonly ScoreRow[],
  jours: readonly JourVuRow[],
  creneaux: readonly Creneau[],
): SupervisionScoreDto[] {
  const now = new Date();
  const metriqueDe = new Map(metriques.map((row) => [row.id, row]));
  const joursDe = new Map<string, JourVuRow[]>();
  for (const jour of jours) {
    const liste = joursDe.get(jour.id);
    if (liste === undefined) joursDe.set(jour.id, [jour]);
    else liste.push(jour);
  }

  return roster.map((membre): SupervisionScoreDto => {
    const metrique = metriqueDe.get(membre.id) ?? AUCUN_APPEL;
    const vus = joursDe.get(membre.id) ?? [];
    const entrees = {
      activeSecondsInShifts: vus.reduce((total, jour) => total + jour.actifs, 0),
      shiftSecondsElapsed: vus.reduce(
        (total, jour) => total + secondesEcoulees(jour.jour, creneaux, now),
        0,
      ),
      calls: metrique.appels,
      reached: metrique.joints,
      qualified: metrique.qualifies,
      repeatCalls: metrique.rappels,
      deadSeconds: metrique.tempsMort,
    };
    return {
      teleconseillerId: membre.id,
      teleconseillerName: membre.nom,
      ...entrees,
      score: performanceScore(entrees),
    };
  });
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
  if (query.timeFrom) bounds.push(Prisma.sql`${column}::time >= ${query.timeFrom}::time`);
  if (query.timeTo) bounds.push(Prisma.sql`${column}::time < ${query.timeTo}::time`);
  if (!bounds.length) return Prisma.sql`TRUE`;
  return Prisma.join(bounds, ' AND ');
}
