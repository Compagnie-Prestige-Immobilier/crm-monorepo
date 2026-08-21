import { NotFoundException } from '@nestjs/common';
import { SuggestionStatus } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { shortCode } from '../../common/short-code.js';
import { SuggestionsService } from './suggestions.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  representantSuggestion: Record<'count' | 'findMany' | 'findFirst' | 'updateMany', MockFn>;
}

const date = new Date('2026-05-04T10:00:00.000Z');

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'sug-1',
  sourceRepresentantId: 'rep-1',
  suggestedName: 'Modou Fall',
  suggestedPhoneE164: '+221779876543',
  note: null,
  status: SuggestionStatus.A_APPELER,
  suggestedById: 'com-1',
  suggestedBy: { fullName: 'Awa Sy' },
  resolvedRepresentantId: null,
  clientCreatedAt: date,
  createdAt: date,
  ...over,
});

function stub(): MockDb {
  return {
    representantSuggestion: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([row()]),
      findFirst: vi.fn().mockResolvedValue(row({ status: SuggestionStatus.APPELE })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

const build = (db: MockDb): SuggestionsService =>
  new SuggestionsService(db as unknown as PrismaService);

describe('SuggestionsService : liste', () => {
  it('désigne le représentant source par son code court, jamais par son nom', async () => {
    const db = stub();

    const result = await build(db).list({});

    expect(result.items[0]).toMatchObject({
      sourceRepresentantId: 'rep-1',
      sourceRepresentantShortCode: shortCode('rep-1'),
      suggestedByName: 'Awa Sy',
      suggestedPhoneE164: '+221779876543',
    });
    expect(JSON.stringify(result.items[0])).not.toContain('Fatou');
  });

  it('écarte les lignes supprimées et les lignes fictives, mode éteint', async () => {
    const db = stub();

    await build(db).list({ status: SuggestionStatus.A_APPELER });

    const where = (db.representantSuggestion.findMany.mock.calls[0] as [{ where: unknown }])[0]
      .where;
    expect(where).toMatchObject({
      deletedAt: null,
      status: SuggestionStatus.A_APPELER,
    });
  });

  it('pagine sur la page demandée', async () => {
    const db = stub();
    db.representantSuggestion.count.mockResolvedValue(53);

    const result = await build(db).list({ page: 3, pageSize: 25 });

    const args = (db.representantSuggestion.findMany.mock.calls[0] as [Record<string, unknown>])[0];
    expect(args).toMatchObject({ skip: 50, take: 25 });
    expect(result.meta).toEqual({ total: 53, page: 3, pageSize: 25, pageCount: 3 });
  });
});

describe('SuggestionsService : bascule de statut', () => {
  it('marque un numéro appelé', async () => {
    const db = stub();

    const result = await build(db).setStatus('sug-1', SuggestionStatus.APPELE);

    const call = (
      db.representantSuggestion.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ]
    )[0];
    expect(call.where).toMatchObject({ id: 'sug-1', deletedAt: null });
    expect(call.data).toEqual({ status: SuggestionStatus.APPELE });
    expect(result.status).toBe(SuggestionStatus.APPELE);
  });

  it('ne distingue pas « inconnue » de « hors du périmètre visible »', async () => {
    const db = stub();
    db.representantSuggestion.updateMany.mockResolvedValue({ count: 0 });

    await expect(build(db).setStatus('sug-1', SuggestionStatus.ABANDONNE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
