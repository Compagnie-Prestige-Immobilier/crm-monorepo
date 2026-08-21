import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { dakarWallClock, inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { dakarDate } from './visites.service.js';
import type {
  VisiteStatBucketDto,
  VisiteStatJourDto,
  VisiteStatMoisDto,
  VisiteStatsDto,
  VisiteStatsQueryDto,
} from './dto.js';

export const VisiteStatsError = {
  RANGE_INVALID: 'VISITE_STATS_RANGE_INVALID',
  RANGE_TOO_WIDE: 'VISITE_STATS_RANGE_TOO_WIDE',
} as const;

/** Le classeur va du mois à l'année ; au-delà, l'agrégat se fait hors ligne. */
const MAX_SPAN_DAYS = 400;

const DAY_MS = 86_400_000;

interface CountedRow {
  visitedAt: Date;
  entrepriseId: string;
  objetId: string;
  directionId: string | null;
  destinataireId: string | null;
}

interface Entry {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
}

/**
 * Toutes les entrées ACTIVES, y compris à zéro, comme les onglets du classeur.
 * Plus celles retirées des listes qui ont compté sur la période : les taire
 * ferait un total supérieur à la somme de ses parts, sans explication.
 */
const bucketsOf = (entries: readonly Entry[], counts: Map<string, number>): VisiteStatBucketDto[] =>
  entries
    .filter((entry) => entry.isActive || counts.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      code: entry.code,
      label: entry.label,
      count: counts.get(entry.id) ?? 0,
    }));

const tally = (
  rows: readonly CountedRow[],
  key: (row: CountedRow) => string | null,
): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = key(row);
    if (id === null) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

const monthKey = (instant: Date): string => {
  const { year, month } = dakarWallClock(instant);
  return `${String(year)}-${String(month).padStart(2, '0')}`;
};

/**
 * Les statistiques du classeur : un total, quatre répartitions listant TOUTES
 * les entrées du référentiel y compris celles à zéro, et la marche du mois.
 *
 * La somme d'une répartition peut être inférieure au total, exactement comme
 * dans le classeur : direction et destinataire sont facultatifs, et l'écart est
 * rendu par `sansDirection` et `sansDestinataire` plutôt que laissé à deviner.
 */
@Injectable()
export class VisitesStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(query: VisiteStatsQueryDto): Promise<VisiteStatsDto> {
    const from = inclusiveDateFrom(query.from);
    const to = inclusiveDateTo(query.to);

    if (to.getTime() < from.getTime()) {
      throw new BadRequestException({
        code: VisiteStatsError.RANGE_INVALID,
        message: 'La date de fin précède la date de début.',
      });
    }
    if (to.getTime() - from.getTime() > MAX_SPAN_DAYS * DAY_MS) {
      throw new BadRequestException({
        code: VisiteStatsError.RANGE_TOO_WIDE,
        message: `La période ne peut pas dépasser ${String(MAX_SPAN_DAYS)} jours.`,
      });
    }

    const where = { visitedAt: { gte: from, lte: to } };

    const [rows, entreprises, directions, destinataires, objets] = await Promise.all([
      this.prisma.visite.findMany({
        where,
        select: {
          visitedAt: true,
          entrepriseId: true,
          objetId: true,
          directionId: true,
          destinataireId: true,
        },
      }),
      this.entries('entreprises'),
      this.entries('directions'),
      this.entries('destinataires'),
      this.entries('objets'),
    ]);

    return {
      from: query.from,
      to: query.to,
      total: rows.length,
      parEntreprise: bucketsOf(
        entreprises,
        tally(rows, (row) => row.entrepriseId),
      ),
      parDirection: bucketsOf(
        directions,
        tally(rows, (row) => row.directionId),
      ),
      parDestinataire: bucketsOf(
        destinataires,
        tally(rows, (row) => row.destinataireId),
      ),
      parObjet: bucketsOf(
        objets,
        tally(rows, (row) => row.objetId),
      ),
      parMois: this.byMonth(rows, from, to),
      parJour: this.byDay(rows),
      sansDirection: rows.filter((row) => row.directionId === null).length,
      sansDestinataire: rows.filter((row) => row.destinataireId === null).length,
    };
  }

  /** Chaque mois de la période, même vide : un graphique à trous se lit mal. */
  private byMonth(rows: readonly CountedRow[], from: Date, to: Date): VisiteStatMoisDto[] {
    const counts = tally(rows, (row) => monthKey(row.visitedAt));

    const months: VisiteStatMoisDto[] = [];
    const start = dakarWallClock(from);
    const end = dakarWallClock(to);

    for (let year = start.year, month = start.month; ;) {
      const key = `${String(year)}-${String(month).padStart(2, '0')}`;
      months.push({ month: key, count: counts.get(key) ?? 0 });

      if (year === end.year && month === end.month) break;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return months;
  }

  private byDay(rows: readonly CountedRow[]): VisiteStatJourDto[] {
    const counts = tally(rows, (row) => dakarDate(row.visitedAt));
    return [...counts.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  private async entries(
    kind: 'entreprises' | 'directions' | 'destinataires' | 'objets',
  ): Promise<Entry[]> {
    const args = {
      select: { id: true, code: true, label: true, isActive: true },
      orderBy: { sortOrder: 'asc' as const },
    };

    if (kind === 'entreprises') return this.prisma.visiteEntreprise.findMany(args);
    if (kind === 'directions') return this.prisma.visiteDirection.findMany(args);
    if (kind === 'destinataires') return this.prisma.visiteDestinataire.findMany(args);
    return this.prisma.visiteObjet.findMany(args);
  }
}
