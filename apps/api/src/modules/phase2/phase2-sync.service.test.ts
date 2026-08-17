import { CallOutcome, Phase2Status } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Phase2SyncService, type Phase2TransactionClient } from './phase2-sync.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockTx {
  callAttempt: Record<'findUnique' | 'createMany', MockFn>;
  callTask: Record<'findFirst' | 'updateMany', MockFn>;
  prospect: Record<'findFirst' | 'updateMany', MockFn>;
}

const prospectRow = (isDemo: boolean): Record<string, unknown> => ({
  id: 'p-1',
  phase2Status: Phase2Status.PENDING,
  enrollmentMethod: null,
  rev: 3,
  updatedAt: new Date('2026-08-01T09:00:00.000Z'),
  enrollmentCapturedById: null,
  enrollmentCapturedAt: null,
  isDemo,
});

let tx: MockTx;

const prepare = (isDemo: boolean): void => {
  tx = {
    callAttempt: {
      findUnique: vi.fn().mockResolvedValue(null),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    callTask: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    prospect: {
      findFirst: vi.fn().mockResolvedValue(prospectRow(isDemo)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
};

const op = {
  id: 'att-1',
  prospectId: 'p-1',
  outcome: CallOutcome.UNREACHABLE,
  clientCreatedAt: '2026-08-01T10:00:00.000Z',
};

const apply = (): Promise<unknown> =>
  new Phase2SyncService().applyCallAttempt(tx as unknown as Phase2TransactionClient, 'com-1', op);

const writtenRow = (): Record<string, unknown> =>
  (tx.callAttempt.createMany.mock.calls[0]?.[0] as { data: Record<string, unknown>[] }).data[0] ??
  {};

describe('nature de la tentative écrite', () => {
  beforeEach(() => {
    prepare(false);
  });

  it('prospect réel : la tentative est réelle', async () => {
    await apply();
    expect(writtenRow().isDemo).toBe(false);
  });

  it('prospect de démonstration : la tentative le suit', async () => {
    prepare(true);
    await apply();
    expect(writtenRow().isDemo).toBe(true);
  });

  it('lit la nature du prospect dans la MÊME lecture que son état', async () => {
    await apply();

    const select = (
      tx.prospect.findFirst.mock.calls[0]?.[0] as { select?: Record<string, unknown> }
    ).select;
    expect(select?.isDemo).toBe(true);
  });

  it('ne divulgue pas la nature de la fiche dans l’état rendu', async () => {
    const result = (await apply()) as { state: Record<string, unknown> };
    expect(Object.keys(result.state)).not.toContain('isDemo');
  });
});
