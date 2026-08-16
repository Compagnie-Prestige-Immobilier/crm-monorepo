import { Injectable } from '@nestjs/common';
import { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { inclusiveDateFrom, inclusiveDateTo } from '../../common/date-bounds.js';
import { isAdmin } from '../../common/scope.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type {
  SegmentConversionAuthorDto,
  SegmentConversionDto,
  SegmentConversionListDto,
  SegmentConversionOriginDto,
  SegmentConversionsQueryDto,
} from './segment-conversions.dto.js';

const DEFAULT_PAGE_SIZE = 25;

/**
 * Lecture des conversions de segment.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI PRISMA ET NON DU SQL BRUT, CONTRAIREMENT AUX AUTRES AGRÉGATS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les agrégats de prospection composent leur `WHERE` à la main parce qu'ils
 * croisent quatre tables et que le segment, lui, n'existe nulle part : il faut
 * le RECALCULER à chaque ligne. Ici, rien de tel : les deux segments sont
 * STOCKÉS, la période est une simple borne sur `changedAt`, et les trois index
 * composites du modèle servent exactement ces clauses. Écrire du SQL brut
 * ajouterait une seconde définition du filtre sans rien gagner.
 */
@Injectable()
export class SegmentConversionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async conversions(
    user: AuthenticatedUser,
    query: SegmentConversionsQueryDto,
  ): Promise<SegmentConversionListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(user, query, await this.demo.enabled());

    const [total, rows, byOrigin, byAuthor] = await Promise.all([
      this.prisma.segmentChange.count({ where }),
      this.prisma.segmentChange.findMany({
        where,
        include: {
          changedBy: { select: { id: true, fullName: true } },
          prospect: { select: { nom: true, prenom: true } },
        },
        // `id` en second critère : sans lui, deux bascules de la même
        // milliseconde peuvent s'échanger entre deux pages, et l'une disparaît
        // de la pagination.
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

    // UNE seule lecture d'annuaire pour tout le décompte par auteur : la
    // variante évidente, lire l'utilisateur ligne par ligne, produirait un
    // aller-retour par personne apparaissant dans la période.
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
          // Un auteur désactivé puis supprimé logiquement reste l'auteur de
          // sa bascule : rendre une chaîne vide effacerait l'attribution que
          // cette table existe pour porter.
          fullName: nameById.get(group.changedById) ?? 'Compte supprimé',
          conversions: group._count._all,
        }))
        .sort((left, right) => right.conversions - left.conversions),
    };
  }

  /**
   * Le filtre, écrit UNE fois et partagé par la page, le total et les deux
   * décomptes. Trois définitions séparées finiraient par décrire trois
   * populations, et l'écran additionnerait des chiffres qui ne se rapportent
   * pas au même ensemble.
   */
  private buildWhere(
    user: AuthenticatedUser,
    query: SegmentConversionsQueryDto,
    demoEnabled: boolean,
  ): Prisma.SegmentChangeWhereInput {
    const changedAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom !== undefined) changedAt.gte = inclusiveDateFrom(query.dateFrom);
    if (query.dateTo !== undefined) changedAt.lte = inclusiveDateTo(query.dateTo);

    // Cloisonnement : un COMMERCIAL ne lit que les bascules QU'IL A FAITES.
    // L'appliquer par écrasement, et non par fusion, est délibéré : un
    // `changedById` reçu du client ne doit jamais élargir la portée, seulement
    // la restreindre à l'intérieur de ce que l'appelant peut déjà voir.
    const author = isAdmin(user) ? query.changedById : user.id;

    return {
      ...demoScope(demoEnabled),
      ...(author !== undefined ? { changedById: author } : {}),
      ...(query.fromSegment !== undefined ? { fromSegment: query.fromSegment } : {}),
      ...(query.toSegment !== undefined ? { toSegment: query.toSegment } : {}),
      ...(Object.keys(changedAt).length > 0 ? { changedAt } : {}),
    };
  }
}
