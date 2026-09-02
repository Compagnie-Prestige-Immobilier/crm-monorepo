import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SuggestionStatus } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { shortCode } from '../../common/short-code.js';
import { isAdmin, readsEveryone } from '../../common/scope.js';
import { SUGGESTION_STATUS_TRANSITIONS, assertTransition } from '../../common/transitions.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import type { SuggestionDto, SuggestionListDto, SuggestionQueryDto } from './dto.js';

const suggestionNotFound = (): NotFoundException =>
  new NotFoundException({
    code: 'SUGGESTION_NOT_FOUND',
    message: 'Ce numéro suggéré est introuvable.',
  });

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, query: SuggestionQueryDto): Promise<SuggestionListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    // Une piste est le numéro d'un TIERS, donné par un représentant à un
    // téléconseiller précis. Sans cette clause, chaque commercial lisait le
    // carnet de ses collègues et pouvait solder leurs pistes.
    const where: Prisma.RepresentantSuggestionWhereInput = {
      deletedAt: null,
      ...(readsEveryone(user) ? {} : { suggestedById: user.id }),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.representantSuggestion.count({ where }),
      this.prisma.representantSuggestion.findMany({
        where,
        include: { suggestedBy: { select: { fullName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map(toDto),
      meta: { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async setStatus(
    user: AuthenticatedUser,
    id: string,
    status: SuggestionStatus,
  ): Promise<SuggestionDto> {
    // Même périmètre que la liste : ce qu'on lit, on peut le solder.
    const scope = readsEveryone(user) ? {} : { suggestedById: user.id };
    const courant = await this.prisma.representantSuggestion.findFirst({
      where: { id, deletedAt: null, ...scope },
      select: { status: true },
    });
    if (!courant) throw suggestionNotFound();

    // Une piste soldée l'est : « appelé » et « abandonné » sont terminaux. La
    // règle n'existait que dans l'écran, qui cessait de proposer l'action.
    assertTransition(SUGGESTION_STATUS_TRANSITIONS, courant.status, status, {
      code: 'SUGGESTION_TRANSITION_REFUSED',
      label: 'Numéro suggéré',
      ...(isAdmin(user) ? { bypass: true } : {}),
    });

    // Le statut de départ est DANS le `where` : deux bascules concurrentes ne
    // peuvent pas se croiser entre la lecture et l'écriture.
    const updated = await this.prisma.representantSuggestion.updateMany({
      where: { id, deletedAt: null, status: courant.status, ...scope },
      data: { status },
    });
    if (updated.count === 0) throw suggestionNotFound();

    const row = await this.prisma.representantSuggestion.findFirst({
      where: { id },
      include: { suggestedBy: { select: { fullName: true } } },
    });
    if (!row) throw suggestionNotFound();

    return toDto(row);
  }
}

interface SuggestionRow {
  id: string;
  sourceRepresentantId: string;
  suggestedName: string | null;
  suggestedPhoneE164: string;
  note: string | null;
  status: SuggestionStatus;
  suggestedById: string;
  suggestedBy: { fullName: string };
  resolvedRepresentantId: string | null;
  clientCreatedAt: Date;
  createdAt: Date;
}

/** Le représentant source est désigné par son code court, comme sur le programme papier : aucun nom n'y figure. */
function toDto(row: SuggestionRow): SuggestionDto {
  return {
    id: row.id,
    sourceRepresentantId: row.sourceRepresentantId,
    sourceRepresentantShortCode: shortCode(row.sourceRepresentantId),
    suggestedName: row.suggestedName,
    suggestedPhoneE164: row.suggestedPhoneE164,
    note: row.note,
    status: row.status,
    suggestedById: row.suggestedById,
    suggestedByName: row.suggestedBy.fullName,
    resolvedRepresentantId: row.resolvedRepresentantId,
    clientCreatedAt: row.clientCreatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}
