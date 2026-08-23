import { ImportKind, ImportMode, ImportStatus, type ImportJob, type Prisma } from '@crm/database';

export interface FakeRepresentant {
  id: string;
  fullName: string;
  phoneE164: string;
  departementId: string;
  iefId: string | null;
  notes: string | null;
  createdById: string;
  clientCreatedAt: Date;
  deletedAt: Date | null;
}

export interface FakeDepartement {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface FakeIef {
  id: string;
  name: string;
  code: string;
  departementId: string;
  isActive: boolean;
}

export class FakeUniqueViolation extends Error {
  readonly code = 'P2002';
  readonly meta = { target: ['phoneE164'], modelName: 'Representant' };

  constructor() {
    super('Unique constraint failed on the fields: (`phoneE164`)');
  }
}

const BASE = new Date('2026-08-16T09:00:00.000Z');

export const DEPARTEMENT_DAKAR: FakeDepartement = {
  id: 'dep-dakar',
  name: 'Dakar',
  code: 'DK',
  isActive: true,
};

export const IEF_ALMADIES: FakeIef = {
  id: 'ief-almadies',
  name: 'IEF Almadies',
  code: 'ALM',
  departementId: DEPARTEMENT_DAKAR.id,
  isActive: true,
};

export interface FakeJobSeed {
  id?: string;
  createdAt?: Date;
  kind?: ImportKind;
  status?: ImportStatus;
  mode?: ImportMode;
  processedRows?: number;
  createdRows?: number;
  skippedRows?: number;
  errorRows?: number;
  claimToken?: string | null;
  claimedAt?: Date | null;
  failureCode?: string | null;
  startedAt?: Date | null;
  report?: Prisma.JsonValue | null;
}

export const fakeJob = (seed: FakeJobSeed = {}): ImportJob => ({
  id: seed.id ?? 'job-1',
  kind: seed.kind ?? ImportKind.REPRESENTANTS,
  status: seed.status ?? ImportStatus.queued,
  mode: seed.mode ?? ImportMode.APPLY,
  requestedById: 'admin-1',
  fileName: 'representants.xlsx',
  fileBytes: 4_096,
  storagePath: '/tmp/imports/job-1.xlsx',
  totalRows: null,
  processedRows: seed.processedRows ?? 0,
  createdRows: seed.createdRows ?? 0,
  skippedRows: seed.skippedRows ?? 0,
  errorRows: seed.errorRows ?? 0,
  report: seed.report ?? null,
  failureCode: seed.failureCode ?? null,
  failureMsg: null,
  claimToken: seed.claimToken ?? null,
  claimedAt: seed.claimedAt ?? null,
  startedAt: seed.startedAt ?? null,
  finishedAt: null,
  expiresAt: new Date(BASE.getTime() + 24 * 3_600_000),
  createdAt: seed.createdAt ?? BASE,
  updatedAt: BASE,
});

type Where = Record<string, unknown>;

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null;
  if (expected instanceof Date) {
    return actual instanceof Date && actual.getTime() === expected.getTime();
  }
  if (typeof expected === 'object') {
    const operators = expected as Record<string, unknown>;
    return Object.entries(operators).every(([operator, operand]) => {
      switch (operator) {
        case 'in':
          return Array.isArray(operand) && operand.includes(actual);
        case 'not':
          return !matchesValue(actual, operand);
        case 'lt':
          return actual instanceof Date && operand instanceof Date && actual < operand;
        case 'lte':
          return actual instanceof Date && operand instanceof Date && actual <= operand;
        case 'gt':
          return actual instanceof Date && operand instanceof Date && actual > operand;
        case 'gte':
          return actual instanceof Date && operand instanceof Date && actual >= operand;
        default:
          throw new Error(`Opérateur non pris en charge par la doublure : ${operator}`);
      }
    });
  }
  return actual === expected;
}

function matches(row: object, where: Where | undefined): boolean {
  if (!where) return true;
  const fields = row as Record<string, unknown>;
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'OR') {
      return Array.isArray(expected) && expected.some((clause) => matches(row, clause as Where));
    }
    if (field === 'AND') {
      return Array.isArray(expected) && expected.every((clause) => matches(row, clause as Where));
    }
    return matchesValue(fields[field], expected);
  });
}

type OrderBy = Record<string, 'asc' | 'desc'>;

function compareOn(left: object, right: object, criterion: OrderBy): number {
  const entry = Object.entries(criterion)[0];
  if (!entry) return 0;
  const [field, direction] = entry;
  const a = (left as Record<string, unknown>)[field];
  const b = (right as Record<string, unknown>)[field];

  let delta = 0;
  if (a instanceof Date && b instanceof Date) delta = a.getTime() - b.getTime();
  else if (typeof a === 'string' && typeof b === 'string') delta = a < b ? -1 : a > b ? 1 : 0;
  else if (typeof a === 'number' && typeof b === 'number') delta = a - b;

  return direction === 'desc' ? -delta : delta;
}

/**
 * Trie comme PostgreSQL, C'EST-À-DIRE SANS PROMESSE SUR LES EX ÆQUO.
 *
 * Deux lignes que le tri ne départage pas sont rendues dans un ordre qui change
 * d'un appel à l'autre : c'est ce que fait un moteur réel, et c'est ce qui rend
 * visible une pagination sans second critère unique.
 */
function sortBy<T extends object>(
  rows: readonly T[],
  orderBy: OrderBy | readonly OrderBy[] | undefined,
  call: number,
): T[] {
  if (!orderBy) return [...rows];
  const criteria: readonly OrderBy[] = Array.isArray(orderBy) ? orderBy : [orderBy as OrderBy];

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      for (const criterion of criteria) {
        const delta = compareOn(left.row, right.row, criterion);
        if (delta !== 0) return delta;
      }
      return call % 2 === 0 ? left.index - right.index : right.index - left.index;
    })
    .map((entry) => entry.row);
}

export class FakeImportPrisma {
  jobs: ImportJob[] = [];
  representants: FakeRepresentant[] = [];
  departements: FakeDepartement[] = [DEPARTEMENT_DAKAR];
  iefs: FakeIef[] = [IEF_ALMADIES];

  onBeforeCreateMany?: () => void;

  findManyCalls = 0;

  committedChunks = 0;

  transactions = 0;

  onBeforeTransaction?: (index: number) => void;

  get importJob() {
    return {
      findUnique: ({ where }: { where: { id: string } }): Promise<ImportJob | null> => {
        const found = this.jobs.find((job) => job.id === where.id);
        return Promise.resolve(found ? { ...found } : null);
      },

      findMany: (args: {
        where?: Where;
        orderBy?: OrderBy | readonly OrderBy[];
        skip?: number;
        take?: number;
        select?: unknown;
      }): Promise<ImportJob[]> => {
        this.findManyCalls += 1;
        const found = this.jobs.filter((job) => matches(job, args.where));

        const sorted = sortBy(found, args.orderBy, this.findManyCalls);

        const from = args.skip ?? 0;
        const page = sorted.slice(from, args.take === undefined ? undefined : from + args.take);
        return Promise.resolve(page.map((job) => ({ ...job })));
      },

      count: (args: { where?: Where }): Promise<number> =>
        Promise.resolve(this.jobs.filter((job) => matches(job, args.where)).length),

      create: ({ data }: { data: Record<string, unknown> }): Promise<ImportJob> => {
        const job = { ...fakeJob({}), ...data };
        this.jobs.push(job);
        return Promise.resolve({ ...job });
      },

      updateMany: ({
        where,
        data,
      }: {
        where?: Where;
        data: Record<string, unknown>;
      }): Promise<{ count: number }> => {
        let count = 0;
        for (const job of this.jobs) {
          if (!matches(job, where)) continue;
          Object.assign(job, data, { updatedAt: new Date() });
          count += 1;
        }
        return Promise.resolve({ count });
      },
    };
  }

  get representant() {
    return {
      findMany: (args: { where?: Where }): Promise<{ phoneE164: string }[]> =>
        Promise.resolve(
          this.representants
            .filter((row) => matches(row, args.where))
            .map((row) => ({ phoneE164: row.phoneE164 })),
        ),

      createMany: ({
        data,
        skipDuplicates,
      }: {
        data: Record<string, unknown>[];
        skipDuplicates?: boolean;
      }): Promise<{ count: number }> => {
        this.onBeforeCreateMany?.();
        let count = 0;
        for (const row of data) {
          const phone = row.phoneE164 as string;
          const taken = this.representants.some(
            (existing) => existing.phoneE164 === phone && existing.deletedAt === null,
          );
          if (taken) {
            if (skipDuplicates === true) continue;
            throw new FakeUniqueViolation();
          }
          this.representants.push({
            id: row.id as string,
            fullName: row.fullName as string,
            phoneE164: phone,
            departementId: row.departementId as string,
            iefId: (row.iefId as string | null) ?? null,
            notes: (row.notes as string | null) ?? null,
            createdById: row.createdById as string,
            clientCreatedAt: row.clientCreatedAt as Date,
            deletedAt: null,
          });
          count += 1;
        }
        return Promise.resolve({ count });
      },
    };
  }

  get departement() {
    return {
      findMany: (args: { where?: Where }): Promise<FakeDepartement[]> =>
        Promise.resolve(
          this.departements.filter((row) => matches(row, args.where)).map((row) => ({ ...row })),
        ),
    };
  }

  get ief() {
    return {
      findMany: (args: { where?: Where }): Promise<FakeIef[]> =>
        Promise.resolve(
          this.iefs.filter((row) => matches(row, args.where)).map((row) => ({ ...row })),
        ),
    };
  }

  async $transaction<T>(run: (tx: FakeImportPrisma) => Promise<T>): Promise<T> {
    this.transactions += 1;
    this.onBeforeTransaction?.(this.transactions);

    const jobs = this.jobs.map((job) => ({ ...job }));
    const representants = this.representants.map((row) => ({ ...row }));

    try {
      const result = await run(this);
      this.committedChunks += 1;
      return result;
    } catch (error) {
      this.jobs = jobs;
      this.representants = representants;
      throw error;
    }
  }
}
