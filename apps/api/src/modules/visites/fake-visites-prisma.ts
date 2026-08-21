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

export const fakeRef = (over: Partial<FakeRefRow> & { id: string; code: string }): FakeRefRow => ({
  label: over.code,
  isActive: true,
  isSystem: true,
  sortOrder: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

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
  if (where.id !== undefined && row.id !== where.id) return false;
  if (
    where.reference?.startsWith !== undefined &&
    !row.reference.startsWith(where.reference.startsWith)
  ) {
    return false;
  }
  if (
    where.visitedAt?.gte !== undefined &&
    row.visitedAt.getTime() < where.visitedAt.gte.getTime()
  ) {
    return false;
  }
  if (
    where.visitedAt?.lte !== undefined &&
    row.visitedAt.getTime() > where.visitedAt.lte.getTime()
  ) {
    return false;
  }
  if (where.entrepriseId !== undefined && row.entrepriseId !== where.entrepriseId) return false;
  if (where.objetId !== undefined && row.objetId !== where.objetId) return false;
  if (where.directionId !== undefined && row.directionId !== where.directionId) return false;
  if (where.destinataireId !== undefined && row.destinataireId !== where.destinataireId)
    return false;

  if (where.OR !== undefined) {
    const hit = where.OR.some((clause) => {
      if (clause.visitorName !== undefined) {
        return row.visitorName.toLowerCase().includes(clause.visitorName.contains.toLowerCase());
      }
      if (clause.reference !== undefined) return row.reference.includes(clause.reference.contains);
      return false;
    });
    if (!hit) return false;
  }

  return true;
};

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

  failNextCreateWithP2002 = false;
  private sequence = 0;

  readonly visiteEntreprise = this.refDelegate('entreprises');
  readonly visiteDirection = this.refDelegate('directions');
  readonly visiteDestinataire = this.refDelegate('destinataires');
  readonly visiteObjet = this.refDelegate('objets');

  readonly visite = {
    count: ({ where }: { where?: VisiteWhere } = {}): Promise<number> =>
      Promise.resolve(this.visites.filter((row) => matchesVisite(row, where)).length),

    findMany: (
      args: {
        where?: VisiteWhere;
        orderBy?: unknown;
        skip?: number;
        take?: number;
      } = {},
    ): Promise<unknown[]> => {
      const kept = this.visites
        .filter((row) => matchesVisite(row, args.where))
        .sort((left, right) => right.visitedAt.getTime() - left.visitedAt.getTime())
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
