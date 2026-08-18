import {
  CallOutcome,
  EnrollmentMethod,
  Phase2Status,
  ScheduledCallbackStatus,
} from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Phase2SyncService, type Phase2TransactionClient } from './phase2-sync.service.js';
import type { CallAttemptOpDto } from './dto.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockTx {
  callAttempt: Record<'findUnique' | 'createMany', MockFn>;
  callTask: Record<'findFirst' | 'updateMany', MockFn>;
  prospect: Record<'findFirst' | 'updateMany', MockFn>;
  scheduledCallback: Record<'updateMany' | 'createMany', MockFn>;
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
    scheduledCallback: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
};

const op = {
  id: 'att-1',
  prospectId: 'p-1',
  outcome: CallOutcome.UNREACHABLE,
  clientCreatedAt: '2026-08-01T10:00:00.000Z',
};

const apply = (override: Partial<CallAttemptOpDto> = {}): Promise<unknown> =>
  new Phase2SyncService().applyCallAttempt(tx as unknown as Phase2TransactionClient, 'com-1', {
    ...op,
    ...override,
  });

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

const RAPPEL = '2026-08-02T09:00:00.000Z';

const callbackWritten = (): Record<string, unknown> =>
  (tx.scheduledCallback.createMany.mock.calls[0]?.[0] as { data: Record<string, unknown>[] })
    .data[0] ?? {};

describe('rappel planifié', () => {
  beforeEach(() => {
    prepare(false);
  });

  it('CALLBACK avec date : le rappel est créé sur la tentative qui l’a promis', async () => {
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    const row = callbackWritten();
    expect(row.prospectId).toBe('p-1');
    expect(row.sourceAttemptId).toBe('att-1');
    expect(row.assignedToId).toBe('com-1');
    expect((row.scheduledAt as Date).toISOString()).toBe(RAPPEL);
    expect(row.isDemo).toBe(false);
  });

  it('rattache le rappel à la campagne quand l’appel en vient', async () => {
    tx.callTask.findFirst.mockResolvedValue({ id: 'task-1', campaignId: 'camp-1' });
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(callbackWritten().taskId).toBe('task-1');
    expect(callbackWritten().campaignId).toBe('camp-1');
  });

  it('hors campagne, le rappel existe quand même, sans tâche', async () => {
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(callbackWritten().taskId).toBeNull();
    expect(callbackWritten().campaignId).toBeNull();
  });

  it('dépose le rappel précédent en SUPERSEDED avant d’insérer', async () => {
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    const [args] = tx.scheduledCallback.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ prospectId: 'p-1', status: ScheduledCallbackStatus.PENDING });
    expect(args.data).toEqual({ status: ScheduledCallbackStatus.SUPERSEDED });
    expect(tx.scheduledCallback.updateMany.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      tx.scheduledCallback.createMany.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('CALLBACK sans date ne planifie rien, et n’efface pas le rappel en cours', async () => {
    await apply({ outcome: CallOutcome.CALLBACK });

    expect(tx.scheduledCallback.createMany).not.toHaveBeenCalled();
    expect(tx.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('le rejeu de la MÊME tentative ne recrée pas de rappel', async () => {
    tx.callAttempt.findUnique.mockResolvedValue({ id: 'att-1', taskId: null, task: null });
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(tx.scheduledCallback.createMany).not.toHaveBeenCalled();
    expect(tx.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('une tentative perdue à l’insertion ne déclenche aucun rappel', async () => {
    tx.callAttempt.createMany.mockResolvedValue({ count: 0 });
    await apply({ outcome: CallOutcome.CALLBACK, callbackAt: RAPPEL });

    expect(tx.scheduledCallback.createMany).not.toHaveBeenCalled();
  });

  it('une issue terminale clôt le rappel en cours et dit lequel l’a clos', async () => {
    await apply({ outcome: CallOutcome.METHOD_OBTAINED, method: EnrollmentMethod.PLATFORM });

    const [args] = tx.scheduledCallback.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ prospectId: 'p-1', status: ScheduledCallbackStatus.PENDING });
    expect(args.data).toEqual({
      status: ScheduledCallbackStatus.DONE,
      closedAttemptId: 'att-1',
    });
  });

  it('une issue NON terminale laisse le rappel en attente', async () => {
    await apply();

    expect(tx.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });
});
