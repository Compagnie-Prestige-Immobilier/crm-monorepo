import { ConflictException, NotFoundException } from '@nestjs/common';
import { CallOutcome } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  CallOutcomeReasonError,
  CallOutcomeReasonsService,
} from './call-outcome-reasons.service.js';
import {
  CallOutcomeEffect,
  LEGACY_PAYLOAD_VERSION,
  NEW_REASON_PAYLOAD_VERSION,
  SYSTEM_OUTCOME_REASONS,
} from './call-outcome-rules.js';

interface Row {
  id: string;
  code: string;
  label: string;
  effect: string;
  requiresComment: boolean;
  requiresCallback: boolean;
  countsAsReached: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  color: string | null;
  minPayloadVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const NRP: Row = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'NRP',
  label: 'NRP',
  effect: CallOutcomeEffect.KEEP_OPEN,
  requiresComment: false,
  requiresCallback: false,
  countsAsReached: false,
  isActive: true,
  isSystem: false,
  sortOrder: 25,
  color: 'warning',
  minPayloadVersion: NEW_REASON_PAYLOAD_VERSION,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

class FakePrisma {
  rows: Row[] = [];
  lastUpdate: Record<string, unknown> | null = null;

  readonly callOutcomeReason = {
    findMany: ({
      where,
      orderBy,
    }: {
      where?: { isActive?: boolean; minPayloadVersion?: { lte: number } };
      orderBy?: unknown;
    } = {}): Promise<Row[]> => {
      void orderBy;
      const kept = this.rows.filter(
        (row) =>
          (where?.isActive === undefined || row.isActive === where.isActive) &&
          (where?.minPayloadVersion === undefined ||
            row.minPayloadVersion <= where.minPayloadVersion.lte),
      );
      return Promise.resolve(
        [...kept].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
      );
    },

    findUnique: ({
      where,
    }: {
      where: { id?: string; code?: string; label?: string };
    }): Promise<Row | null> =>
      Promise.resolve(
        this.rows.find(
          (row) =>
            (where.id !== undefined && row.id === where.id) ||
            (where.code !== undefined && row.code === where.code) ||
            (where.label !== undefined && row.label === where.label),
        ) ?? null,
      ),

    create: ({ data }: { data: Record<string, unknown> }): Promise<Row> => {
      const row = {
        id: `gen-${String(this.rows.length)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      } as Row;
      this.rows.push(row);
      return Promise.resolve(row);
    },

    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<Row> => {
      this.lastUpdate = data;
      const row = this.rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error('ligne absente du faux dépôt');
      Object.assign(row, data, { updatedAt: new Date() });
      return Promise.resolve(row);
    },
  };

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

const systemRows = (): Row[] =>
  SYSTEM_OUTCOME_REASONS.map((reason, index) => ({
    id: `sys-${String(index)}`,
    code: reason.code,
    label: reason.label,
    effect: reason.effect,
    requiresComment: reason.requiresComment,
    requiresCallback: reason.requiresCallback,
    countsAsReached: reason.countsAsReached,
    isActive: true,
    isSystem: true,
    sortOrder: reason.sortOrder,
    color: reason.color,
    minPayloadVersion: LEGACY_PAYLOAD_VERSION,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }));

const bodyOf = (error: unknown): { code?: string } =>
  (error as { response?: { code?: string } }).response ?? {};

async function refusal(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('aucune exception levée alors qu’un refus était attendu');
}

let db: FakePrisma;
let service: CallOutcomeReasonsService;

beforeEach(() => {
  db = new FakePrisma();
  db.rows = [...systemRows(), { ...NRP }];
  service = new CallOutcomeReasonsService(db.asService());
});

describe('vocabulaire du terrain', () => {
  it('un client en version 1 ne reçoit QUE les motifs système', async () => {
    const { items } = await service.listForField(LEGACY_PAYLOAD_VERSION);

    expect(items.map((item) => item.code).sort()).toEqual(
      SYSTEM_OUTCOME_REASONS.map((reason) => reason.code).sort(),
    );
    expect(items.every((item) => item.isSystem)).toBe(true);
  });

  it('chaque valeur de CallOutcome reste proposée en version 1', async () => {
    const { items } = await service.listForField(LEGACY_PAYLOAD_VERSION);
    const codes = new Set(items.map((item) => item.code));

    for (const outcome of Object.values(CallOutcome)) {
      expect(codes.has(outcome), `${outcome} disparu du vocabulaire de terrain`).toBe(true);
    }
  });

  it('un client en version 2 reçoit aussi les motifs du panneau', async () => {
    const { items } = await service.listForField(NEW_REASON_PAYLOAD_VERSION);
    expect(items.map((item) => item.code)).toContain('NRP');
  });

  it('un motif retiré des listes ne descend plus sur le terrain', async () => {
    await service.setActive(NRP.id, { isActive: false });

    const { items } = await service.listForField(NEW_REASON_PAYLOAD_VERSION);
    expect(items.map((item) => item.code)).not.toContain('NRP');
  });

  it('le panneau voit les motifs inactifs et toutes les versions', async () => {
    await service.setActive(NRP.id, { isActive: false });

    const { items } = await service.listAll();
    expect(items.map((item) => item.code)).toContain('NRP');
    expect(items).toHaveLength(SYSTEM_OUTCOME_REASONS.length + 1);
  });
});

describe('création', () => {
  it('naît hors du parc en place : version 2, non système, actif', async () => {
    const created = await service.create({
      code: 'occupe',
      label: '  Occupé  ',
      effect: CallOutcomeEffect.KEEP_OPEN,
      countsAsReached: false,
    });

    expect(created.code).toBe('OCCUPE');
    expect(created.label).toBe('Occupé');
    expect(created.minPayloadVersion).toBe(NEW_REASON_PAYLOAD_VERSION);
    expect(created.isSystem).toBe(false);
    expect(created.isActive).toBe(true);
    expect(created.countsAsReached).toBe(false);

    const { items } = await service.listForField(LEGACY_PAYLOAD_VERSION);
    expect(items.map((item) => item.code)).not.toContain('OCCUPE');
  });

  it('refuse un code déjà porté, fût-ce par un motif système', async () => {
    const error = await refusal(() =>
      service.create({
        code: CallOutcome.UNREACHABLE,
        label: 'Injoignable bis',
        effect: CallOutcomeEffect.KEEP_OPEN,
      }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.CODE_CONFLICT);
  });

  it('refuse un libellé déjà porté', async () => {
    const error = await refusal(() =>
      service.create({ code: 'NRP2', label: 'NRP', effect: CallOutcomeEffect.KEEP_OPEN }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.LABEL_CONFLICT);
  });

  it('refuse d’exiger une échéance sur un effet qui n’en planifie pas', async () => {
    const error = await refusal(() =>
      service.create({
        code: 'RELANCE',
        label: 'Relance',
        effect: CallOutcomeEffect.KEEP_OPEN,
        requiresCallback: true,
      }),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.CALLBACK_NOT_ALLOWED);
  });
});

describe('modification', () => {
  it('ne réécrit NI le code, NI l’effet, NI la version de charge utile', async () => {
    await service.update(NRP.id, {
      label: 'Ne répond pas',
      color: 'info',
      sortOrder: 26,
    });

    expect(Object.keys(db.lastUpdate ?? {}).sort()).toEqual(['color', 'label', 'sortOrder']);

    const row = db.rows.find((candidate) => candidate.id === NRP.id);
    expect(row?.code).toBe('NRP');
    expect(row?.effect).toBe(CallOutcomeEffect.KEEP_OPEN);
    expect(row?.minPayloadVersion).toBe(NEW_REASON_PAYLOAD_VERSION);
  });

  it('renomme un motif système, mais ne touche pas à sa règle de saisie', async () => {
    const renamed = await service.update('sys-0', { label: 'Méthode recueillie' });
    expect(renamed.label).toBe('Méthode recueillie');

    const error = await refusal(() => service.update('sys-0', { requiresComment: true }));
    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.SYSTEM_IMMUTABLE);
  });

  it('refuse un libellé déjà porté par un autre motif', async () => {
    const error = await refusal(() => service.update(NRP.id, { label: 'Injoignable' }));

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.LABEL_CONFLICT);
  });

  it('accepte de renommer un motif avec son propre libellé', async () => {
    await expect(service.update(NRP.id, { label: 'NRP' })).resolves.toMatchObject({ label: 'NRP' });
  });

  it('refuse d’exiger une échéance quand l’effet ne la planifie pas', async () => {
    const error = await refusal(() => service.update(NRP.id, { requiresCallback: true }));

    expect(error).toBeInstanceOf(ConflictException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.CALLBACK_NOT_ALLOWED);
  });

  it('refuse un identifiant inconnu', async () => {
    const error = await refusal(() =>
      service.update('99999999-9999-4999-8999-999999999999', { label: 'X' }),
    );

    expect(error).toBeInstanceOf(NotFoundException);
    expect(bodyOf(error).code).toBe(CallOutcomeReasonError.NOT_FOUND);
  });
});

describe('retrait', () => {
  it.each(SYSTEM_OUTCOME_REASONS.map((reason, index) => [reason.code, `sys-${String(index)}`]))(
    'le motif système %s ne se retire pas',
    async (_code, id) => {
      const error = await refusal(() => service.setActive(id, { isActive: false }));

      expect(error).toBeInstanceOf(ConflictException);
      expect(bodyOf(error).code).toBe(CallOutcomeReasonError.SYSTEM_IMMUTABLE);
    },
  );

  it('retire puis remet un motif du panneau, sans jamais le supprimer', async () => {
    await service.setActive(NRP.id, { isActive: false });
    expect(db.rows.map((row) => row.code)).toContain('NRP');

    const back = await service.setActive(NRP.id, { isActive: true });
    expect(back.isActive).toBe(true);
  });
});
