import { CallOutcome, Phase2Status } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Phase2SyncService, type Phase2TransactionClient } from './phase2-sync.service.js';

/**
 * La nature de la TENTATIVE d'appel, à l'écriture.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'ASYMÉTRIE CORRIGÉE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `RepCallAttempt` renseignait `isDemo` ; `CallAttempt` ne le faisait pas. Les
 * deux tables portent pourtant la colonne, et les deux chemins sont écrits l'un
 * en miroir de l'autre, jusque dans leurs commentaires.
 *
 * La conséquence se lit sur un chiffre : le taux de joignabilité et le nombre
 * de tentatives affichés mode ÉTEINT comptaient les appels passés sur des
 * fiches de démonstration, puisque rien ne les distinguait. La colonne prenait
 * son défaut, FALSE, et l'agrégat cloisonné les laissait donc passer.
 *
 * La tentative suit LE PROSPECT et non l'interrupteur : le lot remonte par la
 * synchronisation mobile, parfois longtemps après la saisie, et l'état du mode
 * au moment de la remontée ne dit rien de la fiche appelée.
 */

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

/** Première ligne passée à `createMany`. */
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

  /**
   * La valeur ne peut pas être devinée après coup : si la projection cesse de
   * demander la colonne, `prospect.isDemo` vaut `undefined` et l'héritage
   * retombe en silence sur le défaut de la base.
   */
  it('lit la nature du prospect dans la MÊME lecture que son état', async () => {
    await apply();

    const select = (
      tx.prospect.findFirst.mock.calls[0]?.[0] as { select?: Record<string, unknown> }
    ).select;
    expect(select?.isDemo).toBe(true);
  });

  /** La nature de la ligne n'a rien à faire dans la réponse rendue au mobile. */
  it('ne divulgue pas la nature de la fiche dans l’état rendu', async () => {
    const result = (await apply()) as { state: Record<string, unknown> };
    expect(Object.keys(result.state)).not.toContain('isDemo');
  });
});
