import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SuggestionStatus } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { demoScope } from '../../prisma/demo-visibility.js';
import { shortCode } from '../../common/short-code.js';
import type { SuggestionDto, SuggestionListDto, SuggestionQueryDto } from './dto.js';

const suggestionNotFound = (): NotFoundException =>
  new NotFoundException({
    code: 'SUGGESTION_NOT_FOUND',
    message: 'Ce numéro suggéré est introuvable.',
  });

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly demo: DemoVisibilityService,
  ) {}

  async list(query: SuggestionQueryDto): Promise<SuggestionListDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.RepresentantSuggestionWhereInput = {
      deletedAt: null,
      ...demoScope(await this.demo.enabled()),
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

  async setStatus(id: string, status: SuggestionStatus): Promise<SuggestionDto> {
    const updated = await this.prisma.representantSuggestion.updateMany({
      where: { id, deletedAt: null, ...demoScope(await this.demo.enabled()) },
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
