import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { readsEveryone } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type {
  SegmentConversionAuthorDto,
  SegmentConversionDto,
  SegmentConversionListDto,
  SegmentConversionOriginDto,
  SegmentConversionsQueryDto,
} from './segment-conversions.dto.js';

const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class SegmentConversionsService {
  constructor(private readonly prisma: PrismaService) {}

  async conversions(
    user: AuthenticatedUser,
    query: SegmentConversionsQueryDto,
  ): Promise<SegmentConversionListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(user, query);

    const [total, rows, byOrigin, byAuthor] = await Promise.all([
      this.prisma.segmentChange.count({ where }),
      this.prisma.segmentChange.findMany({
        where,
        include: {
          changedBy: { select: { id: true, fullName: true } },
          prospect: { select: { nom: true, prenom: true } },
        },
        // `id` en second critère : sans lui, deux bascules de la même milliseconde
        // s'échangent entre deux pages et l'une disparaît.
        orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.segmentChange.groupBy({
        by: ['fromSegment'],
        where,
        _count: { _all: true },
      }),
      this.prisma.segmentChange.groupBy({
        by: ['changedById'],
        where,
        _count: { _all: true },
      }),
    ]);

    const authorIds = byAuthor.map((group) => group.changedById);
    const authors = authorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameById = new Map(authors.map((author) => [author.id, author.fullName]));

    return {
      items: rows.map((row): SegmentConversionDto => ({
        id: row.id,
        prospectId: row.prospectId,
        prospectName: `${row.prospect.prenom} ${row.prospect.nom}`.replace(/\s+/gu, ' ').trim(),
        fromSegment: row.fromSegment,
        toSegment: row.toSegment,
        reason: row.reason,
        changedById: row.changedById,
        changedByName: row.changedBy.fullName,
        source: row.source,
        changedAt: row.changedAt.toISOString(),
      })),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      byOriginSegment: byOrigin
        .map((group): SegmentConversionOriginDto => ({
          segment: group.fromSegment,
          conversions: group._count._all,
        }))
        .sort((left, right) => right.conversions - left.conversions),
      byAuthor: byAuthor
        .map((group): SegmentConversionAuthorDto => ({
          userId: group.changedById,
          // Un auteur supprimé reste l'auteur de sa bascule : effacer le nom
          // effacerait l'attribution que cette table existe pour porter.
          fullName: nameById.get(group.changedById) ?? 'Compte supprimé',
          conversions: group._count._all,
        }))
        .sort((left, right) => right.conversions - left.conversions),
    };
  }

  /** Prisma et non SQL brut : les deux segments sont stockés et les trois index composites de `SegmentChange` servent ces clauses. */
  private buildWhere(
    user: AuthenticatedUser,
    query: SegmentConversionsQueryDto,
  ): Prisma.SegmentChangeWhereInput {
    const changedAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom !== undefined) changedAt.gte = inclusiveDateFrom(query.dateFrom);
    if (query.dateTo !== undefined) changedAt.lte = inclusiveDateTo(query.dateTo);

    // Écrasement et non fusion : un `changedById` reçu du client ne doit jamais
    // élargir la portée, seulement la restreindre.
    const author = readsEveryone(user) ? query.changedById : user.id;

    return {
      ...(author !== undefined ? { changedById: author } : {}),
      ...(query.fromSegment !== undefined ? { fromSegment: query.fromSegment } : {}),
      ...(query.toSegment !== undefined ? { toSegment: query.toSegment } : {}),
      ...(Object.keys(changedAt).length > 0 ? { changedAt } : {}),
    };
  }
}
