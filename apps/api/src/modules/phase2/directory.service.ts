import { Injectable } from '@nestjs/common';
import type { Prisma } from '@crm/database';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  decodeDirectoryCursor,
  encodeDirectoryCursor,
  fromMicros,
  toMicros,
  type DirectoryCursor,
} from './directory-cursor.js';
import type { DirectoryEntryDto, DirectoryPageDto, DirectoryQueryDto } from './dto.js';

const DIRECTORY_SAFETY_LAG_MS = 2_000;

const DIRECTORY_DEFAULT_PAGE_SIZE = 2_000;

const DIRECTORY_SELECT = {
  id: true,
  phoneE164: true,
  phase2Status: true,
  enrollmentMethod: true,
  rev: true,
  updatedAt: true,
} satisfies Prisma.ProspectSelect;

type DirectoryRow = Prisma.ProspectGetPayload<{ select: typeof DIRECTORY_SELECT }>;

const toEntry = (row: DirectoryRow): DirectoryEntryDto => ({
  prospectId: row.id,
  phoneE164: row.phoneE164,
  phase2Status: row.phase2Status,
  enrollmentMethod: row.enrollmentMethod,
  rev: row.rev,
  updatedAt: row.updatedAt.toISOString(),
});

function keyset(cursor: DirectoryCursor | undefined, safeNow: Date): Prisma.ProspectWhereInput {
  const clauses: Prisma.ProspectWhereInput[] = [{ updatedAt: { lt: safeNow } }];

  if (cursor) {
    const at = fromMicros(cursor.t);
    clauses.push({
      OR: [{ updatedAt: { gt: at } }, { AND: [{ updatedAt: at }, { id: { gt: cursor.id } }] }],
    });
  }

  return { AND: clauses };
}

@Injectable()
export class Phase2DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(query: DirectoryQueryDto): Promise<DirectoryPageDto> {
    const limit = query.limit ?? DIRECTORY_DEFAULT_PAGE_SIZE;
    const incoming = decodeDirectoryCursor(query.since);
    const serverTime = new Date();
    const safeNow = new Date(serverTime.getTime() - DIRECTORY_SAFETY_LAG_MS);

    const rows = await this.prisma.prospect.findMany({
      where: {
        deletedAt: null,
        ...keyset(incoming, safeNow),
      },
      select: DIRECTORY_SELECT,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    const last = rows.at(-1);

    return {
      entries: rows.map(toEntry),
      nextCursor: last
        ? encodeDirectoryCursor({ v: 1, t: toMicros(last.updatedAt), id: last.id })
        : (query.since ?? ''),
      hasMore: rows.length === limit,
      serverTime: serverTime.toISOString(),
    };
  }
}
