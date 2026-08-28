import type { VisiteReferentielKind } from './dto.js';

export interface FakeRefRow {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeVisiteRow {
  id: string;
  reference: string;
  visitedAt: Date;
  timeKnown: boolean;
  visitorName: string;
  phone: string | null;
  phoneE164: string | null;
  entrepriseId: string;
  objetId: string;
  directionId: string | null;
  destinataireId: string | null;
  comment: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeUserRow {
  id: string;
  fullName: string;
}

export interface FakeAppSettingRow {
  key: string;
  value: string;
  updatedById: string | null;
  updatedAt: Date;
}

export interface FakeDashboardLayoutRow {
  userId: string;
  layout: unknown;
  updatedAt: Date;
}

export const fakeRef = (over: Partial<FakeRefRow> & { id: string; code: string }): FakeRefRow => ({
  label: over.code,
  isActive: true,
  isSystem: true,
  sortOrder: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

type OrderByClause = Record<string, 'asc' | 'desc' | { label: 'asc' | 'desc' }>;

interface RefWhere {
  id?: string;
  code?: string;
  label?: string;
  isActive?: boolean;
}

interface VisiteWhere {
  id?: string;
  reference?: { startsWith?: string; contains?: string };
  visitedAt?: { gte?: Date; lte?: Date };
  entrepriseId?: string;
  objetId?: string;
  directionId?: string;
  destinataireId?: string;
  OR?: {
    visitorName?: { contains: string; mode?: string };
    reference?: { contains: string };
  }[];
}

const matchesVisite = (row: FakeVisiteRow, where: VisiteWhere | undefined): boolean => {
  if (!where) return true;
  return matchesVisiteFields(row, where) && matchesVisiteSearch(row, where.OR);
};

function matchesVisiteFields(row: FakeVisiteRow, where: VisiteWhere): boolean {
  if (where.id !== undefined && row.id !== where.id) return false;
  const reference = where.reference?.startsWith;
  if (reference !== undefined && !row.reference.startsWith(reference)) return false;
  const from = where.visitedAt?.gte;
  if (from !== undefined && row.visitedAt.getTime() < from.getTime()) return false;
  const to = where.visitedAt?.lte;
  if (to !== undefined && row.visitedAt.getTime() > to.getTime()) return false;
  if (where.entrepriseId !== undefined && row.entrepriseId !== where.entrepriseId) return false;
  if (where.objetId !== undefined && row.objetId !== where.objetId) return false;
  if (where.directionId !== undefined && row.directionId !== where.directionId) return false;
  return where.destinataireId === undefined || row.destinataireId === where.destinataireId;
}

function matchesVisiteSearch(row: FakeVisiteRow, clauses: VisiteWhere['OR']): boolean {
  if (clauses === undefined) return true;
  return clauses.some((clause) => {
    if (clause.visitorName !== undefined) {
      return row.visitorName.toLowerCase().includes(clause.visitorName.contains.toLowerCase());
    }
    return clause.reference !== undefined && row.reference.includes(clause.reference.contains);
  });
}

/**
 * Double de la seule surface Prisma que le registre touche. Il applique les
 * `where` pour de vrai : un double qui rendrait toujours tout laisserait passer
 * un cloisonnement oublié.
 */
export class FakeVisitesPrisma {
  visites: FakeVisiteRow[] = [];
  entreprises: FakeRefRow[] = [];
  directions: FakeRefRow[] = [];
  destinataires: FakeRefRow[] = [];
  objets: FakeRefRow[] = [];
  users: FakeUserRow[] = [];
  appSettings: FakeAppSettingRow[] = [];
  dashboardLayouts: FakeDashboardLayoutRow[] = [];

  failNextCreateWithP2002 = false;
  private sequence = 0;

  readonly visiteEntreprise = this.refDelegate('entreprises');
  readonly visiteDirection = this.refDelegate('directions');
  readonly visiteDestinataire = this.refDelegate('destinataires');
  readonly visiteObjet = this.refDelegate('objets');

  readonly user = {
    findMany: ({ where }: { where?: { id?: { in: string[] } } } = {}): Promise<FakeUserRow[]> =>
      Promise.resolve(
        this.users.filter((row) => where?.id?.in === undefined || where.id.in.includes(row.id)),
      ),
  };

  readonly visiteDashboardLayout = {
    findUnique: ({
      where,
    }: {
      where: { userId: string };
    }): Promise<FakeDashboardLayoutRow | null> =>
      Promise.resolve(this.dashboardLayouts.find((row) => row.userId === where.userId) ?? null),

    upsert: ({
      where,
      create,
      update,
    }: {
      where: { userId: string };
      create: { userId: string; layout: unknown };
      update: { layout: unknown };
    }): Promise<FakeDashboardLayoutRow> => {
      const existing = this.dashboardLayouts.find((row) => row.userId === where.userId);
      if (existing) {
        existing.layout = update.layout;
        existing.updatedAt = new Date();
        return Promise.resolve(existing);
      }
      const row: FakeDashboardLayoutRow = {
        userId: create.userId,
        layout: create.layout,
        updatedAt: new Date(),
      };
      this.dashboardLayouts.push(row);
      return Promise.resolve(row);
    },

    deleteMany: ({ where }: { where: { userId: string } }): Promise<{ count: number }> => {
      const before = this.dashboardLayouts.length;
      this.dashboardLayouts = this.dashboardLayouts.filter((row) => row.userId !== where.userId);
      return Promise.resolve({ count: before - this.dashboardLayouts.length });
    },
  };

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }): Promise<FakeAppSettingRow | null> =>
      Promise.resolve(this.appSettings.find((row) => row.key === where.key) ?? null),

    upsert: ({
      where,
      create,
      update,
    }: {
      where: { key: string };
      create: { key: string; value: string; updatedById?: string | null };
      update: { value: string; updatedById?: string | null };
    }): Promise<FakeAppSettingRow> => {
      const existing = this.appSettings.find((row) => row.key === where.key);
      if (existing) {
        existing.value = update.value;
        existing.updatedById = update.updatedById ?? null;
        existing.updatedAt = new Date();
        return Promise.resolve(existing);
      }
      const row: FakeAppSettingRow = {
        key: create.key,
        value: create.value,
        updatedById: create.updatedById ?? null,
        updatedAt: new Date(),
      };
      this.appSettings.push(row);
      return Promise.resolve(row);
    },
  };

  readonly visite = {
    count: ({ where }: { where?: VisiteWhere } = {}): Promise<number> =>
      Promise.resolve(this.visites.filter((row) => matchesVisite(row, where)).length),

    findMany: (
      args: {
        where?: VisiteWhere;
        orderBy?: OrderByClause[];
        skip?: number;
        take?: number;
      } = {},
    ): Promise<unknown[]> => {
      const kept = this.visites
        .filter((row) => matchesVisite(row, args.where))
        .sort((left, right) => this.compareVisites(left, right, args.orderBy))
        .map((row) => this.hydrate(row));
      const from = args.skip ?? 0;
      return Promise.resolve(args.take === undefined ? kept : kept.slice(from, from + args.take));
    },

    findFirst: (args: { where?: VisiteWhere; orderBy?: unknown }): Promise<unknown> => {
      const kept = this.visites
        .filter((row) => matchesVisite(row, args.where))
        .sort((left, right) => right.reference.localeCompare(left.reference));
      const found = kept[0];
      return Promise.resolve(found === undefined ? null : this.hydrate(found));
    },

    create: ({ data }: { data: Record<string, unknown> }): Promise<unknown> => {
      if (this.failNextCreateWithP2002) {
        this.failNextCreateWithP2002 = false;
        return Promise.reject(Object.assign(new Error('unique'), { code: 'P2002' }));
      }
      const reference = String(data.reference);
      if (this.visites.some((row) => row.reference === reference)) {
        return Promise.reject(Object.assign(new Error('unique'), { code: 'P2002' }));
      }

      this.sequence += 1;
      const row = {
        id: `visite-${String(this.sequence)}`,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        ...(data as unknown as Omit<FakeVisiteRow, 'id' | 'createdAt' | 'updatedAt'>),
      };
      this.visites.push(row);
      return Promise.resolve(this.hydrate(row));
    },

    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }): Promise<unknown> => {
      const row = this.visites.find((candidate) => candidate.id === where.id);
      if (!row) return Promise.reject(new Error('P2025'));
      Object.assign(row, data);
      return Promise.resolve(this.hydrate(row));
    },
  };

  $transaction<T>(run: (client: FakeVisitesPrisma) => Promise<T>): Promise<T> {
    return run(this);
  }

  /** Double du seul cas que `orderBy` sert vraiment : `visitedAt`, `visitorName`, `reference`, ou une relation triée sur `label`. */
  private compareVisites(
    left: FakeVisiteRow,
    right: FakeVisiteRow,
    orderBy: OrderByClause[] | undefined,
  ): number {
    for (const clause of orderBy ?? [{ visitedAt: 'desc' }]) {
      const compared = this.compareByClause(left, right, clause);
      if (compared !== 0) return compared;
    }
    return 0;
  }

  private compareByClause(
    left: FakeVisiteRow,
    right: FakeVisiteRow,
    clause: OrderByClause,
  ): number {
    const [field, spec] = Object.entries(clause)[0] ?? [];
    if (field === undefined) return 0;

    if (field === 'visitedAt') {
      return this.applyDirection(left.visitedAt.getTime() - right.visitedAt.getTime(), spec);
    }
    if (field === 'visitorName' || field === 'reference') {
      return this.applyDirection(left[field].localeCompare(right[field]), spec);
    }

    const relations: Record<string, FakeRefRow[]> = {
      entreprise: this.entreprises,
      direction: this.directions,
      destinataire: this.destinataires,
      objet: this.objets,
    };
    const rows = relations[field];
    if (rows === undefined || typeof spec !== 'object') return 0;
    const idField = `${field}Id` as keyof FakeVisiteRow;
    const labelOf = (row: FakeVisiteRow): string =>
      rows.find((candidate) => candidate.id === row[idField])?.label ?? '';
    return this.applyDirection(labelOf(left).localeCompare(labelOf(right)), spec.label);
  }

  private applyDirection(compared: number, direction: unknown): number {
    return direction === 'asc' ? compared : -compared;
  }

  private hydrate(row: FakeVisiteRow): unknown {
    const ref = (rows: FakeRefRow[], id: string | null): unknown => {
      const found = rows.find((candidate) => candidate.id === id);
      return found === undefined ? null : { id: found.id, code: found.code, label: found.label };
    };
    return {
      ...row,
      entreprise: ref(this.entreprises, row.entrepriseId),
      objet: ref(this.objets, row.objetId),
      direction: ref(this.directions, row.directionId),
      destinataire: ref(this.destinataires, row.destinataireId),
    };
  }

  private refDelegate(kind: VisiteReferentielKind) {
    const rows = (): FakeRefRow[] => this[kind];

    return {
      findMany: (args: { where?: RefWhere } = {}): Promise<FakeRefRow[]> =>
        Promise.resolve(
          rows()
            .filter(
              (row) => args.where?.isActive === undefined || row.isActive === args.where.isActive,
            )
            .sort(
              (left, right) =>
                left.sortOrder - right.sortOrder || left.label.localeCompare(right.label),
            ),
        ),

      findUnique: ({ where }: { where: RefWhere }): Promise<FakeRefRow | null> =>
        Promise.resolve(
          rows().find(
            (row) =>
              (where.id !== undefined && row.id === where.id) ||
              (where.code !== undefined && row.code === where.code) ||
              (where.label !== undefined && row.label === where.label),
          ) ?? null,
        ),

      create: ({ data }: { data: Record<string, unknown> }): Promise<FakeRefRow> => {
        this.sequence += 1;
        const row = fakeRef({
          id: `ref-${String(this.sequence)}`,
          ...(data as unknown as { code: string }),
        });
        rows().push(row);
        return Promise.resolve(row);
      },

      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<FakeRefRow> => {
        const row = rows().find((candidate) => candidate.id === where.id);
        if (!row) return Promise.reject(new Error('P2025'));
        Object.assign(row, data, { updatedAt: new Date('2026-02-01T00:00:00Z') });
        return Promise.resolve(row);
      },
    };
  }
}
