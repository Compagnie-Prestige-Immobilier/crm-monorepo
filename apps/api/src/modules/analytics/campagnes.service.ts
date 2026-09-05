import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { ALL_ROWS, REP_LIVE_OUTCOMES, rate } from './pilotage.sql.js';
import type {
  SupervisionCampagneDto,
  SupervisionCampagnesDto,
  SupervisionCampagnesTotauxDto,
  SupervisionQueryDto,
} from './supervision.dto.js';

interface LigneRow {
  lotId: string;
  name: string;
  cible: 'REPRESENTANTS' | 'PROSPECTS';
  createdAt: Date;
  teleconseillerId: string;
  teleconseillerName: string;
  prevues: number;
  appelees: number;
  traitees: number;
}

/**
 * Taux de contact et d'exploitation (EB-33) par campagne et par téléconseiller.
 * Une campagne est un `LotExport` ; le dénominateur est ce qui a été confié
 * pour les jours de programme de la fenêtre, pas un objectif : EB-17 le
 * remplacera. Une fiche est « appelée » dès qu'une tentative la vise depuis la
 * création du lot, par qui que ce soit, et « traitée » quand cette tentative
 * porte un statut ou une issue vivante.
 */
@Injectable()
export class CampagnesService {
  constructor(private readonly prisma: PrismaService) {}

  async campagnes(query: SupervisionQueryDto): Promise<SupervisionCampagnesDto> {
    const from = query.actFrom ? inclusiveDateFrom(query.actFrom) : null;
    const to = query.actTo ? inclusiveDateTo(query.actTo) : null;
    const projet = query.projet ? Prisma.sql`l."projet" = ${query.projet}::"Projet"` : ALL_ROWS;
    const assignee = query.commercialId
      ? Prisma.sql`i."assigneeId" = ${query.commercialId}`
      : ALL_ROWS;
    // Jour 1 du programme = la journée de création du lot.
    const jourProgramme = Prisma.sql`(date_trunc('day', l."createdAt") + (i."day" - 1) * interval '1 day')`;
    const dansLaFenetre = Prisma.join(
      [
        from ? Prisma.sql`${jourProgramme} >= ${from}` : ALL_ROWS,
        to ? Prisma.sql`${jourProgramme} <= ${to}` : ALL_ROWS,
      ],
      ' AND ',
    );
    const avantLaFin = to ? Prisma.sql`t."clientCreatedAt" <= ${to}` : ALL_ROWS;
    const viseLaFiche = Prisma.sql`
      t."clientCreatedAt" >= l."createdAt" AND ${avantLaFin}
      AND CASE WHEN l."cible" = 'REPRESENTANTS'
               THEN t."representantId" = i."representantId"
               ELSE t."prospectId" = i."prospectId" END
    `;

    const rows = await this.prisma.$queryRaw<LigneRow[]>`
      WITH tentatives AS (
        SELECT "representantId", NULL::text AS "prospectId", "clientCreatedAt",
               ("outcome" IN ${REP_LIVE_OUTCOMES} OR "statutQualificationId" IS NOT NULL) AS traite
        FROM "rep_call_attempts"
        UNION ALL
        SELECT NULL::text, "prospectId", "clientCreatedAt", TRUE
        FROM "call_attempts"
      ),
      fiches AS (
        SELECT
          l."id" AS "lotId", l."name", l."cible", l."createdAt", i."assigneeId",
          EXISTS (SELECT 1 FROM tentatives t WHERE ${viseLaFiche})               AS appelee,
          EXISTS (SELECT 1 FROM tentatives t WHERE t.traite AND ${viseLaFiche})  AS traitee
        FROM "lots_export" l
        INNER JOIN "lot_export_items" i ON i."lotId" = l."id"
        WHERE i."assigneeId" IS NOT NULL AND ${projet} AND ${assignee} AND ${dansLaFenetre}
      )
      SELECT
        f."lotId", f."name", f."cible", f."createdAt",
        f."assigneeId"                          AS "teleconseillerId",
        u."fullName"                            AS "teleconseillerName",
        COUNT(*)::int                           AS prevues,
        COUNT(*) FILTER (WHERE f.appelee)::int  AS appelees,
        COUNT(*) FILTER (WHERE f.traitee)::int  AS traitees
      FROM fiches f
      INNER JOIN "users" u ON u."id" = f."assigneeId"
      GROUP BY 1, 2, 3, 4, 5, 6
      ORDER BY f."createdAt" DESC, f."name" ASC, u."fullName" ASC
    `;

    const parLot = new Map<string, SupervisionCampagneDto>();
    for (const row of rows) {
      const lot = parLot.get(row.lotId) ?? {
        id: row.lotId,
        name: row.name,
        cible: row.cible,
        createdAt: row.createdAt.toISOString(),
        prevues: 0,
        appelees: 0,
        traitees: 0,
        contactRate: null,
        exploitationRate: null,
        parTeleconseiller: [],
      };
      lot.prevues += row.prevues;
      lot.appelees += row.appelees;
      lot.traitees += row.traitees;
      lot.parTeleconseiller.push({
        teleconseillerId: row.teleconseillerId,
        teleconseillerName: row.teleconseillerName,
        prevues: row.prevues,
        appelees: row.appelees,
        traitees: row.traitees,
        contactRate: rate(row.appelees, row.prevues),
        exploitationRate: rate(row.traitees, row.prevues),
      });
      parLot.set(row.lotId, lot);
    }

    const items = [...parLot.values()];
    for (const lot of items) {
      lot.contactRate = rate(lot.appelees, lot.prevues);
      lot.exploitationRate = rate(lot.traitees, lot.prevues);
    }
    const somme = (cle: 'prevues' | 'appelees' | 'traitees'): number =>
      items.reduce((total, lot) => total + lot[cle], 0);
    const [prevues, appelees, traitees] = [somme('prevues'), somme('appelees'), somme('traitees')];
    const totals: SupervisionCampagnesTotauxDto = {
      prevues,
      appelees,
      traitees,
      contactRate: rate(appelees, prevues),
      exploitationRate: rate(traitees, prevues),
    };

    return { items, totals };
  }
}
