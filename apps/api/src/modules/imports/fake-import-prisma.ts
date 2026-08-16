import { ImportKind, ImportMode, ImportStatus, type ImportJob, type Prisma } from '@crm/database';

/**
 * Doublure Prisma en mémoire pour les imports.
 *
 * POURQUOI UNE DOUBLURE QUI *INTERPRÈTE* PLUTÔT QUE DES `vi.fn()` FIGÉS.
 *
 * Les invariants de ce module ne sont pas des appels à Prisma : ce sont des
 * CONSÉQUENCES d'un enchaînement lecture/écriture. Un `updateMany` qui répond
 * `{ count: 1 }` quoi qu'on lui passe ferait passer le test du jeton de fencing
 * ALORS MÊME QUE LE JETON AURAIT ÉTÉ RETIRÉ DU CODE — c'est-à-dire qu'il ne
 * prouverait rien du tout, ce qui est pire que l'absence de test.
 *
 * Cette doublure applique donc réellement le `where` (jeton compris), fait
 * respecter l'unicité du téléphone en levant un P2002 authentique, et ANNULE
 * les écritures d'une transaction qui lève — sans quoi la propriété « un
 * travailleur qui a perdu son bail n'écrit rien » ne serait pas observable.
 *
 * Même doctrine, et même forme, que `bank-cases/fake-prisma.ts`. Le préfixe
 * `fake-` la fait sortir des balayages de source, comme les autres doubles.
 */

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
  isDemo: boolean;
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

/** Erreur d'unicité telle que Prisma la remonte. */
export class FakeUniqueViolation extends Error {
  readonly code = 'P2002';
  readonly meta = { target: ['phoneE164'], modelName: 'Representant' };

  constructor() {
    super('Unique constraint failed on the fields: (`phoneE164`)');
  }
}

/** L'instant de référence des doubles, une heure avant le `NOW` des tests. */
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
  kind?: ImportKind;
  status?: ImportStatus;
  mode?: ImportMode;
  processedRows?: number;
  createdRows?: number;
  skippedRows?: number;
  errorRows?: number;
  claimToken?: string | null;
  claimedAt?: Date | null;
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
  failureCode: null,
  failureMsg: null,
  claimToken: seed.claimToken ?? null,
  claimedAt: seed.claimedAt ?? null,
  startedAt: seed.startedAt ?? null,
  finishedAt: null,
  expiresAt: new Date(BASE.getTime() + 24 * 3_600_000),
  isDemo: false,
  createdAt: BASE,
  updatedAt: BASE,
});

type Where = Record<string, unknown>;

/** Un critère élémentaire de Prisma, tel que ce module en écrit. */
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

/** Le tri d'un `orderBy` à UNE clé, la seule forme que ce module écrit. */
function sortBy<T extends object>(
  rows: readonly T[],
  orderBy: Record<string, 'asc' | 'desc'> | undefined,
): T[] {
  const copy = [...rows];
  if (!orderBy) return copy;

  const entry = Object.entries(orderBy)[0];
  if (!entry) return copy;
  const [field, direction] = entry;

  return copy.sort((left, right) => {
    const a = (left as Record<string, unknown>)[field];
    const b = (right as Record<string, unknown>)[field];
    const delta = a instanceof Date && b instanceof Date ? a.getTime() - b.getTime() : 0;
    return direction === 'desc' ? -delta : delta;
  });
}

export class FakeImportPrisma {
  jobs: ImportJob[] = [];
  representants: FakeRepresentant[] = [];
  departements: FakeDepartement[] = [DEPARTEMENT_DAKAR];
  iefs: FakeIef[] = [IEF_ALMADIES];

  /** Appelé AVANT chaque écriture de représentants, pour simuler une course. */
  onBeforeCreateMany?: () => void;

  /** Écritures de tranche réellement VALIDÉES (transaction non annulée). */
  committedChunks = 0;

  /** Transactions ouvertes, validées ou non. */
  transactions = 0;

  /**
   * Appelé AVANT l'instantané d'une transaction.
   *
   * C'est le seul point où un test peut simuler une reprise de bail SANS que
   * l'annulation ne défasse la reprise elle-même : ce qui est fait ici entre
   * dans l'instantané, donc survit à l'annulation, exactement comme l'écriture
   * d'un autre travailleur en base.
   */
  onBeforeTransaction?: (index: number) => void;

  get importJob() {
    return {
      findUnique: ({ where }: { where: { id: string } }): Promise<ImportJob | null> => {
        const found = this.jobs.find((job) => job.id === where.id);
        return Promise.resolve(found ? { ...found } : null);
      },

      findMany: (args: {
        where?: Where;
        orderBy?: Record<string, 'asc' | 'desc'>;
        skip?: number;
        take?: number;
        select?: unknown;
      }): Promise<ImportJob[]> => {
        const found = this.jobs.filter((job) => matches(job, args.where));

        // LE TRI EST APPLIQUÉ POUR DE VRAI. Une doublure qui rendrait les lignes
        // dans l'ordre d'insertion ferait passer « le plus ancien d'abord » sans
        // que le `orderBy` existe encore dans le code : le balayage pourrait
        // affamer indéfiniment le premier arrivé sans qu'aucun test ne bronche.
        const sorted = sortBy(found, args.orderBy);

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
          // L'INDEX UNIQUE PARTIEL, appliqué pour de vrai : il ne porte que sur
          // les fiches vivantes, exactement comme
          // `representants_phone_e164_active_key`.
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
            isDemo: row.isDemo === true,
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

  /**
   * Une transaction qui ANNULE POUR DE VRAI.
   *
   * C'est ce qui rend observable la propriété centrale du moteur : la tranche
   * d'un travailleur qui a perdu son bail lève depuis l'intérieur, et les lignes
   * qu'elle venait d'écrire disparaissent avec elle. Une doublure qui se
   * contenterait d'exécuter le rappel laisserait ces lignes en place et le test
   * passerait au vert en décrivant l'inverse de la vérité.
   */
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
