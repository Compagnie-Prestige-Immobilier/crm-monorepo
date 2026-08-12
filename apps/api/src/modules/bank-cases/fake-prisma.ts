import type { Prisma } from '@crm/database';
import { BankStageType, Phase2Status, Role } from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Doublure Prisma en mémoire pour Banque & Finance.
 *
 * POURQUOI UNE DOUBLURE QUI *INTERPRÈTE* PLUTÔT QUE DES `vi.fn()` FIGÉS.
 *
 * Les invariants de ce module — unicité de la référence, garde de révision,
 * verrou terminal, copie d'identité — ne sont pas des appels à Prisma : ce sont
 * des CONSÉQUENCES d'un enchaînement lecture/écriture. Une doublure qui rendrait
 * toujours la même ligne les vérifierait tous « vrais » sans rien démontrer :
 * un `updateMany` qui répond `{count: 1}` quoi qu'on lui passe fait passer le
 * test de conflit de révision alors même que la garde aurait été supprimée du
 * code.
 *
 * Cette doublure applique donc réellement le `where` sur un petit magasin
 * mémoire, fait respecter l'unicité de `referenceKey` en levant un P2002
 * authentique, et hydrate les `include` comme le ferait Prisma.
 *
 * Ce qu'elle ne peut PAS faire, et qu'on ne lui demande pas : exécuter le SQL
 * brut de la liste, des agrégats et de l'export. Ces chemins-là sont couverts
 * par `bank-cases.integration.test.ts`, contre un vrai PostgreSQL — c'est le
 * seul moyen honnête de prouver que le tableau de bord et la liste comptent le
 * même ensemble.
 */

export interface FakeStage {
  id: string;
  code: string;
  label: string;
  position: number;
  color: string;
  type: BankStageType;
  isActive: boolean;
  isInitial: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeReason {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FakeUser {
  id: string;
  fullName: string;
  role: Role;
}

export interface FakeProspect {
  id: string;
  nom: string;
  prenom: string;
  phoneE164: string;
  banqueId: string;
  phase2Status: Phase2Status;
  deletedAt: Date | null;
}

export interface FakeCase {
  id: string;
  reference: string;
  referenceKey: string;
  prospectId: string;
  customerName: string;
  customerPhoneE164: string;
  processingBankId: string;
  currentStageId: string;
  amountXof: Prisma.Decimal | null;
  rejectionReasonId: string | null;
  rejectionDetail: string | null;
  rev: number;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface FakeTransition {
  id: string;
  caseId: string;
  fromStageId: string | null;
  toStageId: string;
  performedById: string;
  amountXof: Prisma.Decimal | null;
  rejectionReasonId: string | null;
  rejectionDetail: string | null;
  comment: string | null;
  correctionReason: string | null;
  createdAt: Date;
}

const BASE = new Date('2026-08-01T08:00:00.000Z');

const stage = (
  id: string,
  code: string,
  label: string,
  position: number,
  type: BankStageType,
  flags: { isInitial?: boolean; isSystem?: boolean; isActive?: boolean } = {},
): FakeStage => ({
  id,
  code,
  label,
  position,
  color: 'info',
  type,
  isActive: flags.isActive ?? true,
  isInitial: flags.isInitial ?? false,
  isSystem: flags.isSystem ?? false,
  createdAt: BASE,
  updatedAt: BASE,
});

/** Les quatre étapes réellement semées en base de développement. */
export const STAGE_A_TRAITER = stage(
  'stg-a-traiter',
  'A_TRAITER',
  'À traiter',
  1,
  BankStageType.OPEN,
  {
    isInitial: true,
    isSystem: true,
  },
);
export const STAGE_EN_TRAITEMENT = stage(
  'stg-en-traitement',
  'EN_TRAITEMENT_BANQUE',
  'En traitement banque',
  2,
  BankStageType.OPEN,
);
export const STAGE_ENCAISSE = stage(
  'stg-encaisse',
  'ENCAISSE',
  'Encaissé',
  100,
  BankStageType.CASHED,
  {
    isSystem: true,
  },
);
export const STAGE_REJETE = stage('stg-rejete', 'REJETE', 'Rejeté', 101, BankStageType.REJECTED, {
  isSystem: true,
});

export const REASON_INCOMPLET: FakeReason = {
  id: 'rsn-incomplet',
  code: 'DOSSIER_INCOMPLET',
  label: 'Dossier incomplet',
  isActive: true,
  sortOrder: 10,
};
export const REASON_AUTRE: FakeReason = {
  id: 'rsn-autre',
  code: 'AUTRE',
  label: 'Autre',
  isActive: true,
  sortOrder: 999,
};
export const REASON_RETIRE: FakeReason = {
  id: 'rsn-retire',
  code: 'RETIRE',
  label: 'Motif retiré du référentiel',
  isActive: false,
  sortOrder: 500,
};

export const AGENT: FakeUser = {
  id: 'usr-agent',
  fullName: 'Fatou Ndiaye',
  role: Role.BANQUE_FINANCE,
};
export const AGENT_BIS: FakeUser = {
  id: 'usr-agent-2',
  fullName: 'Ibrahima Fall',
  role: Role.BANQUE_FINANCE,
};
export const ADMIN: FakeUser = {
  id: 'usr-admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

type Where = Record<string, unknown>;

/** Erreur d'unicité telle que Prisma la remonte. `isPrismaKnownError` la reconnaît. */
export class FakeUniqueViolation extends Error {
  readonly code = 'P2002';
  readonly meta = { target: ['referenceKey'], modelName: 'BankCase' };

  constructor() {
    super('Unique constraint failed on the fields: (`referenceKey`)');
  }
}

export class FakePrisma {
  stages: FakeStage[] = [
    { ...STAGE_A_TRAITER },
    { ...STAGE_EN_TRAITEMENT },
    { ...STAGE_ENCAISSE },
    { ...STAGE_REJETE },
  ];
  reasons: FakeReason[] = [{ ...REASON_INCOMPLET }, { ...REASON_AUTRE }, { ...REASON_RETIRE }];
  users: FakeUser[] = [{ ...AGENT }, { ...AGENT_BIS }, { ...ADMIN }];
  banques = [
    { id: 'bnq-cbao', name: 'Compagnie Bancaire de l’Afrique Occidentale', shortName: 'CBAO' },
    { id: 'bnq-bhs', name: 'Banque de l’Habitat du Sénégal', shortName: 'BHS' },
  ];
  prospects: FakeProspect[] = [];
  cases: FakeCase[] = [];
  transitions: FakeTransition[] = [];

  /**
   * Simule l'insertion concurrente d'un autre agent : appelée juste avant que
   * `bankCase.create` ne contrôle l'unicité, elle reproduit exactement la
   * fenêtre entre le pré-contrôle du service et l'écriture réelle.
   */
  onBeforeCaseCreate: (() => void) | undefined;

  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, '0')}`;
  }

  private clock(): Date {
    this.sequence += 1;
    return new Date(BASE.getTime() + this.sequence * 1000);
  }

  addProspect(over: Partial<FakeProspect> & { id: string }): FakeProspect {
    const row: FakeProspect = {
      nom: 'Diop',
      prenom: 'Awa',
      phoneE164: '+221771234567',
      banqueId: 'bnq-cbao',
      phase2Status: Phase2Status.METHOD_OBTAINED,
      deletedAt: null,
      ...over,
    };
    this.prospects.push(row);
    return row;
  }

  addCase(
    over: Partial<FakeCase> & { id: string; reference: string; referenceKey: string },
  ): FakeCase {
    const row: FakeCase = {
      prospectId: 'psp-1',
      customerName: 'Awa Diop',
      customerPhoneE164: '+221771234567',
      processingBankId: 'bnq-cbao',
      currentStageId: STAGE_A_TRAITER.id,
      amountXof: null,
      rejectionReasonId: null,
      rejectionDetail: null,
      rev: 1,
      createdById: AGENT.id,
      updatedById: null,
      createdAt: this.clock(),
      updatedAt: this.clock(),
      deletedAt: null,
      ...over,
    };
    this.cases.push(row);
    return row;
  }

  // ─── Hydratation des `include` ────────────────────────────────────────────

  private hydrateCase(row: FakeCase): unknown {
    return {
      ...row,
      currentStage: this.stages.find((item) => item.id === row.currentStageId),
      processingBank: this.banques.find((item) => item.id === row.processingBankId),
      rejectionReason: this.reasons.find((item) => item.id === row.rejectionReasonId) ?? null,
      createdBy: this.users.find((item) => item.id === row.createdById),
      updatedBy: this.users.find((item) => item.id === row.updatedById) ?? null,
    };
  }

  private hydrateTransition(row: FakeTransition): unknown {
    return {
      ...row,
      fromStage: this.stages.find((item) => item.id === row.fromStageId) ?? null,
      toStage: this.stages.find((item) => item.id === row.toStageId),
      rejectionReason: this.reasons.find((item) => item.id === row.rejectionReasonId) ?? null,
      performedBy: this.users.find((item) => item.id === row.performedById),
    };
  }

  /** Applique les formes de `where` que ce module produit réellement. */
  private matchesCase(row: FakeCase, where: Where): boolean {
    for (const [key, expected] of Object.entries(where)) {
      if (expected === undefined) continue;
      const actual = (row as unknown as Record<string, unknown>)[key];
      if (key === 'deletedAt') {
        if ((actual ?? null) !== expected) return false;
        continue;
      }
      if (typeof expected === 'object' && expected !== null && 'in' in expected) {
        if (!(expected.in as unknown[]).includes(actual)) return false;
        continue;
      }
      if (actual !== expected) return false;
    }
    return true;
  }

  // ─── Surface Prisma consommée par le module ───────────────────────────────

  readonly bankCase = {
    findFirst: ({ where, include }: { where: Where; include?: unknown }): Promise<unknown> => {
      const row = this.cases.find((item) => this.matchesCase(item, where));
      if (!row) return Promise.resolve(null);
      return Promise.resolve(include ? this.hydrateCase(row) : { ...row });
    },

    findMany: ({ where, include }: { where: Where; include?: unknown }): Promise<unknown[]> => {
      const rows = this.cases.filter((item) => this.matchesCase(item, where));
      return Promise.resolve(rows.map((row) => (include ? this.hydrateCase(row) : { ...row })));
    },

    count: ({ where }: { where: Where }): Promise<number> =>
      Promise.resolve(this.cases.filter((item) => this.matchesCase(item, where)).length),

    create: ({
      data,
      include,
    }: {
      data: Record<string, unknown>;
      include?: unknown;
    }): Promise<unknown> => {
      this.onBeforeCaseCreate?.();
      const referenceKey = data.referenceKey as string;
      // Contrainte d'unicité réelle : c'est elle qui produit le P2002 que le
      // service doit rattraper, et non un `mockRejectedValue` posé à la main.
      if (
        this.cases.some((item) => item.referenceKey === referenceKey && item.deletedAt === null)
      ) {
        return Promise.reject(new FakeUniqueViolation());
      }
      const now = this.clock();
      const row: FakeCase = {
        id: (data.id as string | undefined) ?? this.nextId('case'),
        reference: data.reference as string,
        referenceKey,
        prospectId: data.prospectId as string,
        customerName: data.customerName as string,
        customerPhoneE164: data.customerPhoneE164 as string,
        processingBankId: data.processingBankId as string,
        currentStageId: data.currentStageId as string,
        amountXof: null,
        rejectionReasonId: null,
        rejectionDetail: null,
        rev: 1,
        createdById: data.createdById as string,
        updatedById: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.cases.push(row);
      return Promise.resolve(include ? this.hydrateCase(row) : { ...row });
    },

    updateMany: ({
      where,
      data,
    }: {
      where: Where;
      data: Record<string, unknown>;
    }): Promise<{ count: number }> => {
      const rows = this.cases.filter((item) => this.matchesCase(item, where));
      for (const row of rows) {
        const target = row as unknown as Record<string, unknown>;
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && typeof value === 'object' && 'increment' in value) {
            target[key] = (target[key] as number) + (value.increment as number);
            continue;
          }
          target[key] = value;
        }
        row.updatedAt = this.clock();
      }
      // Unicité contrôlée après coup, comme le ferait la base sur un UPDATE.
      const keys = this.cases
        .filter((item) => item.deletedAt === null)
        .map((item) => item.referenceKey);
      if (new Set(keys).size !== keys.length) return Promise.reject(new FakeUniqueViolation());
      return Promise.resolve({ count: rows.length });
    },
  };

  readonly bankCaseTransition = {
    create: ({ data }: { data: Record<string, unknown> }): Promise<unknown> => {
      const row: FakeTransition = {
        id: this.nextId('trs'),
        caseId: data.caseId as string,
        fromStageId: (data.fromStageId as string | undefined) ?? null,
        toStageId: data.toStageId as string,
        performedById: data.performedById as string,
        amountXof: (data.amountXof as Prisma.Decimal | undefined) ?? null,
        rejectionReasonId: (data.rejectionReasonId as string | undefined) ?? null,
        rejectionDetail: (data.rejectionDetail as string | undefined) ?? null,
        comment: (data.comment as string | undefined) ?? null,
        correctionReason: (data.correctionReason as string | undefined) ?? null,
        createdAt: this.clock(),
      };
      this.transitions.push(row);
      return Promise.resolve({ ...row });
    },

    findMany: ({ where }: { where: Where }): Promise<unknown[]> => {
      // `caseId` arrive soit en égalité simple (détail d'un dossier), soit en
      // `{ in: [...] }` (export par lots) : les deux formes sont produites par
      // le module et doivent donc être interprétées ici.
      const wanted = where.caseId;
      const keeps =
        typeof wanted === 'object' && wanted !== null && 'in' in wanted
          ? (id: string): boolean => (wanted.in as string[]).includes(id)
          : (id: string): boolean => id === wanted;

      const rows = this.transitions
        .filter((item) => keeps(item.caseId))
        .sort(
          (left, right) =>
            left.caseId.localeCompare(right.caseId) ||
            left.createdAt.getTime() - right.createdAt.getTime(),
        );
      return Promise.resolve(rows.map((row) => this.hydrateTransition(row)));
    },
  };

  readonly bankCaseStage = {
    findMany: ({ where, orderBy }: { where?: Where; orderBy?: unknown } = {}): Promise<
      unknown[]
    > => {
      let rows = [...this.stages];
      if (where?.isActive !== undefined)
        rows = rows.filter((item) => item.isActive === where.isActive);
      if (where?.type !== undefined) rows = rows.filter((item) => item.type === where.type);
      rows.sort(
        (left, right) => left.position - right.position || left.code.localeCompare(right.code),
      );
      void orderBy;
      return Promise.resolve(rows.map((row) => ({ ...row })));
    },

    findFirst: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.stages.find((item) =>
        Object.entries(where).every(
          ([key, value]) => (item as unknown as Record<string, unknown>)[key] === value,
        ),
      );
      return Promise.resolve(row ? { ...row } : null);
    },

    findUnique: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.stages.find(
        (item) => item.id === where.id || (where.code !== undefined && item.code === where.code),
      );
      return Promise.resolve(row ? { ...row } : null);
    },

    create: ({ data }: { data: Record<string, unknown> }): Promise<unknown> => {
      if (this.stages.some((item) => item.code === data.code)) {
        return Promise.reject(new FakeUniqueViolation());
      }
      const row: FakeStage = {
        id: this.nextId('stg'),
        code: data.code as string,
        label: data.label as string,
        position: data.position as number,
        color: data.color as string,
        type: data.type as BankStageType,
        isActive: data.isActive as boolean,
        isInitial: data.isInitial as boolean,
        isSystem: data.isSystem as boolean,
        createdAt: this.clock(),
        updatedAt: this.clock(),
      };
      this.stages.push(row);
      return Promise.resolve({ ...row });
    },

    update: ({
      where,
      data,
    }: {
      where: Where;
      data: Record<string, unknown>;
    }): Promise<unknown> => {
      const row = this.stages.find((item) => item.id === where.id);
      if (!row) return Promise.reject(new Error(`étape ${String(where.id)} absente`));
      Object.assign(row, data, { updatedAt: this.clock() });
      return Promise.resolve({ ...row });
    },
  };

  readonly bankRejectionReason = {
    findUnique: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.reasons.find((item) => item.id === where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
    findMany: ({ where }: { where?: Where } = {}): Promise<unknown[]> => {
      const rows =
        where?.isActive === true ? this.reasons.filter((item) => item.isActive) : [...this.reasons];
      return Promise.resolve(
        [...rows]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((row) => ({ ...row })),
      );
    },
  };

  readonly prospect = {
    findFirst: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.prospects.find(
        (item) => item.id === where.id && (item.deletedAt ?? null) === (where.deletedAt ?? null),
      );
      return Promise.resolve(row ? { ...row } : null);
    },
  };

  readonly banque = {
    findUnique: ({ where }: { where: Where }): Promise<unknown> => {
      const row = this.banques.find((item) => item.id === where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
  };

  /**
   * `$transaction` séquentiel. Il ne rejoue PAS d'annulation : aucun test de ce
   * fichier n'en dépend, et une fausse atomicité donnerait l'illusion d'avoir
   * prouvé quelque chose que seule la vraie base peut démontrer — c'est le rôle
   * de la suite d'intégration.
   */
  $transaction<T>(work: ((tx: FakePrisma) => Promise<T>) | Promise<unknown>[]): Promise<T> {
    if (Array.isArray(work)) return Promise.all(work) as Promise<T>;
    return work(this);
  }

  /** Aucun chemin testé ici ne passe par le SQL brut : voir l'en-tête du fichier. */
  $queryRaw(): Promise<never[]> {
    throw new Error(
      '$queryRaw n’est pas simulé : les chemins SQL sont couverts par bank-cases.integration.test.ts',
    );
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}
