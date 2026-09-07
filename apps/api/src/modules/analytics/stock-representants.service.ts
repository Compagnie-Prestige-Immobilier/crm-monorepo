import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { StockRepresentantsDto, StockRepresentantsPartDto } from './supervision.dto.js';

interface StockRow {
  total: number;
  jamaisAppeles: number;
  injoignables: number;
}

/**
 * Le stock des représentants, sans fenêtre : ce qu'il y a à appeler, pas ce
 * qui a été fait. « Injoignable » se lit sur le statut porté par la fiche,
 * hors « Injoignable définitif » qui ne repasse jamais (EB-06).
 */
@Injectable()
export class StockRepresentantsService {
  constructor(private readonly prisma: PrismaService) {}

  async stock(): Promise<StockRepresentantsDto> {
    const [[compte = { total: 0, jamaisAppeles: 0, injoignables: 0 }], parDepartement, parIef] =
      await Promise.all([
      this.prisma.$queryRaw<StockRow[]>`
        SELECT
          COUNT(*)::int                                         AS total,
          COUNT(*) FILTER (WHERE r."lastCallAt" IS NULL)::int  AS "jamaisAppeles",
          COUNT(*) FILTER (
            WHERE sq."effect" = 'UNREACHABLE' AND sq."code" <> 'INJOIGNABLE_DEFINITIF'
          )::int                                                AS injoignables
        FROM "representants" r
        LEFT JOIN "statuts_qualification" sq ON sq."id" = r."statutQualificationId"
        WHERE r."deletedAt" IS NULL
      `,
      this.prisma.$queryRaw<StockRepresentantsPartDto[]>`
        SELECT d."id", d."name" AS label, COUNT(r."id")::int AS count
        FROM "departements" d
        LEFT JOIN "representants" r ON r."departementId" = d."id" AND r."deletedAt" IS NULL
        GROUP BY d."id", d."name"
        ORDER BY count DESC, label ASC
      `,
      this.prisma.$queryRaw<StockRepresentantsPartDto[]>`
        SELECT i."id", i."name" AS label, COUNT(r."id")::int AS count
        FROM "iefs" i
        LEFT JOIN "representants" r ON r."iefId" = i."id" AND r."deletedAt" IS NULL
        GROUP BY i."id", i."name"
        ORDER BY count DESC, label ASC
      `,
    ]);

    return { ...compte, parDepartement, parIef };
  }
}
