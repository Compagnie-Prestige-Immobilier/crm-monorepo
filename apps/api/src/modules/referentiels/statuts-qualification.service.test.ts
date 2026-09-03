import { ConflictException, NotFoundException } from '@nestjs/common';
import { RepCallOutcome, StatutQualificationEffect } from '@crm/database';
import { beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  StatutQualificationError,
  StatutsQualificationService,
  outcomeOf,
} from './statuts-qualification.service.js';

interface Row {
  id: string;
  code: string;
  label: string;
  effect: StatutQualificationEffect;
  requiresCallback: boolean;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  minPayloadVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const ligne = (over: Partial<Row> & Pick<Row, 'id' | 'code' | 'label' | 'effect'>): Row => ({
  requiresCallback: false,
  isActive: true,
  isSystem: false,
  sortOrder: 100,
  minPayloadVersion: 6,
  createdAt: new Date('2026-09-03T00:00:00Z'),
  updatedAt: new Date('2026-09-03T00:00:00Z'),
  ...over,
});

const INTERESSE = ligne({
  id: '1',
  code: 'INTERESSE',
  label: 'Intéressé',
  effect: StatutQualificationEffect.REACHED,
  isSystem: true,
  sortOrder: 10,
});

const A_RAPPELER = ligne({
  id: '2',
  code: 'A_RAPPELER',
  label: 'À rappeler',
  effect: StatutQualificationEffect.SCHEDULE_CALLBACK,
  requiresCallback: true,
  isSystem: true,
  sortOrder: 70,
});

const PAS_DE_REPONSE = ligne({
  id: '3',
  code: 'PAS_DE_REPONSE',
  label: 'Pas de réponse',
  effect: StatutQualificationEffect.UNREACHABLE,
  isSystem: true,
  sortOrder: 110,
});

class FakePrisma {
  rows: Row[] = [];

  readonly statutQualification = {
    findMany: ({
      where,
    }: {
      where?: { isActive?: boolean; minPayloadVersion?: { lte: number } };
      orderBy?: unknown;
    } = {}): Promise<Row[]> =>
      Promise.resolve(
        this.rows
          .filter(
            (row) =>
              (where?.isActive === undefined || row.isActive === where.isActive) &&
              (where?.minPayloadVersion === undefined ||
                row.minPayloadVersion <= where.minPayloadVersion.lte),
          )
          .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
      ),

    findFirst: ({
      where,
      orderBy,
    }: {
      where: { effect: { in: StatutQualificationEffect[] } };
      orderBy?: unknown;
      select?: unknown;
    }): Promise<Row | null> => {
      void orderBy;
      const branche = this.rows
        .filter((row) => where.effect.in.includes(row.effect))
        .sort((a, b) => b.sortOrder - a.sortOrder);
      return Promise.resolve(branche[0] ?? null);
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

    count: ({
      where,
    }: {
      where: {
        isActive: boolean;
        effect: { in: StatutQualificationEffect[] };
        id?: { not: string };
      };
    }): Promise<number> =>
      Promise.resolve(
        this.rows.filter(
          (row) =>
            row.isActive === where.isActive &&
            where.effect.in.includes(row.effect) &&
            (where.id === undefined || row.id !== where.id.not),
        ).length,
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
      const row = this.rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error('ligne absente du faux dépôt');
      Object.assign(row, data, { updatedAt: new Date() });
      return Promise.resolve(row);
    },
  };
}

let prisma: FakePrisma;
let service: StatutsQualificationService;

beforeEach(() => {
  prisma = new FakePrisma();
  prisma.rows = [{ ...INTERESSE }, { ...A_RAPPELER }, { ...PAS_DE_REPONSE }];
  service = new StatutsQualificationService(prisma as unknown as PrismaService);
});

describe('l’effet commande l’issue enregistrée', () => {
  it('traduit les cinq effets, sans en oublier un', () => {
    expect(outcomeOf(StatutQualificationEffect.REACHED)).toBe(RepCallOutcome.REACHED);
    expect(outcomeOf(StatutQualificationEffect.REFUSED)).toBe(RepCallOutcome.REFUSED);
    expect(outcomeOf(StatutQualificationEffect.SCHEDULE_CALLBACK)).toBe(RepCallOutcome.CALLBACK);
    expect(outcomeOf(StatutQualificationEffect.UNREACHABLE)).toBe(RepCallOutcome.UNREACHABLE);
    expect(outcomeOf(StatutQualificationEffect.WRONG_NUMBER)).toBe(RepCallOutcome.WRONG_NUMBER);
  });
});

describe('ce que la saisie reçoit', () => {
  it('ne sert que les statuts actifs, dans l’ordre dicté', async () => {
    prisma.rows.push(
      ligne({
        id: '9',
        code: 'RETIRE',
        label: 'Retiré',
        effect: StatutQualificationEffect.REACHED,
        isActive: false,
        sortOrder: 5,
      }),
    );

    const { items } = await service.listForField(6);

    expect(items.map((item) => item.code)).toEqual(['INTERESSE', 'A_RAPPELER', 'PAS_DE_REPONSE']);
  });

  it('cache un statut qu’un appareil ancien ne saurait pas renvoyer', async () => {
    prisma.rows.push(
      ligne({
        id: '8',
        code: 'NOUVEAU',
        label: 'Nouveau',
        effect: StatutQualificationEffect.REACHED,
        minPayloadVersion: 7,
      }),
    );

    expect((await service.listForField(6)).items.map((i) => i.code)).not.toContain('NOUVEAU');
    expect((await service.listForField(7)).items.map((i) => i.code)).toContain('NOUVEAU');
  });

  it('rend TOUT à l’administration, désactivés compris', async () => {
    prisma.rows.push(
      ligne({
        id: '9',
        code: 'RETIRE',
        label: 'Retiré',
        effect: StatutQualificationEffect.REACHED,
        isActive: false,
      }),
    );

    expect((await service.listAll()).items).toHaveLength(4);
  });
});

describe('création', () => {
  it('refuse un code déjà pris', async () => {
    await expect(
      service.create({
        code: 'interesse',
        label: 'Autre',
        effect: StatutQualificationEffect.REACHED,
      }),
    ).rejects.toMatchObject({ response: { code: StatutQualificationError.CODE_CONFLICT } });
  });

  it('refuse un libellé déjà porté', async () => {
    await expect(
      service.create({
        code: 'AUTRE',
        label: 'Intéressé',
        effect: StatutQualificationEffect.REACHED,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('pose le nouveau statut à la fin de SA branche, jamais au milieu de l’autre', async () => {
    const cree = await service.create({
      code: 'MESSAGERIE_PLEINE',
      label: 'Messagerie pleine',
      effect: StatutQualificationEffect.UNREACHABLE,
    });

    // Le dernier de la branche « non abouti » est PAS_DE_REPONSE, à 110.
    expect(prisma.rows.find((row) => row.id === cree.id)?.sortOrder).toBe(120);
  });

  it('normalise le code en majuscules et n’est jamais système', async () => {
    const cree = await service.create({
      code: ' curieux ',
      label: ' Curieux ',
      effect: StatutQualificationEffect.REACHED,
    });

    expect(cree.code).toBe('CURIEUX');
    expect(cree.label).toBe('Curieux');
    expect(cree.isSystem).toBe(false);
  });

  it('refuse d’exiger une date sur un effet qui ne planifie aucun rappel', async () => {
    await expect(
      service.create({
        code: 'CURIEUX',
        label: 'Curieux',
        effect: StatutQualificationEffect.REACHED,
        requiresCallback: true,
      }),
    ).rejects.toMatchObject({ response: { code: StatutQualificationError.CALLBACK_NOT_ALLOWED } });
  });
});

describe('modification', () => {
  it('laisse renommer un statut système', async () => {
    const modifie = await service.update('1', { label: 'Très curieux' });
    expect(modifie.label).toBe('Très curieux');
  });

  it('refuse de toucher la RÈGLE d’un statut système', async () => {
    await expect(service.update('2', { requiresCallback: false })).rejects.toMatchObject({
      response: { code: StatutQualificationError.SYSTEM_IMMUTABLE },
    });
  });

  it('refuse un statut inconnu', async () => {
    await expect(service.update('inconnu', { label: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('activation', () => {
  it('laisse l’administrateur désactiver un statut système', async () => {
    prisma.rows.push(
      ligne({
        id: '4',
        code: 'TRES_INTERESSE',
        label: 'Très intéressé',
        effect: StatutQualificationEffect.REACHED,
        isSystem: true,
      }),
    );

    expect((await service.setActive('1', { isActive: false })).isActive).toBe(false);
  });

  it('refuse de vider une branche de son DERNIER statut actif', async () => {
    await expect(service.setActive('3', { isActive: false })).rejects.toMatchObject({
      response: { code: StatutQualificationError.LAST_OF_BRANCH },
    });
  });

  it('réactive sans jamais se plaindre', async () => {
    prisma.rows[0]!.isActive = false;

    expect((await service.setActive('1', { isActive: true })).isActive).toBe(true);
  });
});
