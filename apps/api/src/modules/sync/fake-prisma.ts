interface BatchRow {
  key: string;
  userId: string;
  requestHash: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  httpStatus: number | null;
  responseJson: unknown;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date;
}

interface OperationRow {
  opId: string;
  userId: string;
  batchKey: string;
  entityType: string;
  entityId: string;
  result: string;
  resultJson: unknown;
  appliedAt: Date;
}

export interface RepresentantRow {
  id: string;
  fullName: string;
  phoneE164: string;
  notes: string | null;
  iefId?: string | null;
  rev: number;
  departementId: string;
  createdById: string;
  clientCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  isDemo?: boolean;
}

export interface CallAttemptRow {
  id: string;
  prospectId: string;
  taskId: string | null;
  campaignId: string | null;
  performedById: string;
  outcome: string;
  reasonId: string | null;
  method: string | null;
  comment: string | null;
  clientCreatedAt: Date;
  isDemo: boolean;
}

interface RepresentantCommentRow {
  id: string;
  representantId: string;
  authorId: string;
  body: string;
  clientCreatedAt: Date;
  createdAt: Date;
  isDemo: boolean;
}

export interface CallOutcomeReasonRow {
  id: string;
  code: string;
  label: string;
  effect: string;
  requiresComment: boolean;
  requiresCallback: boolean;
  isActive: boolean;
}

export interface VisiteReferentielRow {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
}

export interface VisiteRow {
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
  isDemo: boolean;
}

export interface ProspectRow {
  id: string;
  nom: string;
  prenom: string;
  phoneE164: string;
  rev: number;
  statut: string;
  phase2Status?: string;
  enrollmentMethod?: string | null;
  enrollmentCapturedById?: string | null;
  enrollmentCapturedAt?: Date | null;
  banqueId: string;
  syndicatId: string;
  representantId: string;
  createdById: string;
  clientCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  isDemo?: boolean;
}

type Row = Record<string, unknown>;

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (key === 'AND') {
      if (!(expected as Row[]).every((clause) => matches(row, clause))) return false;
      continue;
    }
    const actual = row[key];
    if (expected === null) {
      if (actual !== null && actual !== undefined) return false;
      continue;
    }
    if (typeof expected === 'object') {
      const filter = expected as { not?: unknown; in?: unknown[] };
      if ('not' in filter && actual === filter.not) return false;
      if (filter.in && !filter.in.includes(actual)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

const clone = <T>(value: T): T => structuredClone(value);

export class FakePrisma {
  batches = new Map<string, BatchRow>();
  operations = new Map<string, OperationRow>();
  representants = new Map<string, RepresentantRow>();
  prospects = new Map<string, ProspectRow>();
  callAttempts = new Map<string, CallAttemptRow>();
  representantComments = new Map<string, RepresentantCommentRow>();
  callOutcomeReasons = new Map<string, CallOutcomeReasonRow>();
  visites = new Map<string, VisiteRow>();
  visiteEntreprises = new Map<string, VisiteReferentielRow>();
  visiteObjets = new Map<string, VisiteReferentielRow>();
  visiteDirections = new Map<string, VisiteReferentielRow>();
  visiteDestinataires = new Map<string, VisiteReferentielRow>();
  users = new Map<string, { id: string; isDemo: boolean; role?: string }>();
  demoEntities: { entityType: string; entityId: string; sequence: number }[] = [];

  addDemoUser(id: string): void {
    this.users.set(id, { id, isDemo: true });
  }

  addUser(id: string, row: { role?: string; isDemo?: boolean } = {}): void {
    this.users.set(id, {
      id,
      isDemo: row.isDemo ?? false,
      ...(row.role ? { role: row.role } : {}),
    });
  }

  transactionCount = 0;
  rollbackCount = 0;

  private key(userId: string, key: string): string {
    return `${userId}|${key}`;
  }

  $executeRaw = (strings: TemplateStringsArray, ...values: unknown[]): Promise<number> => {
    const sql = strings.join('?');

    if (sql.includes('INSERT INTO "sync_batches"')) {
      const [key, userId, hash, expiresAt] = values as [string, string, string, Date];
      const id = this.key(userId, key);
      if (this.batches.has(id)) return Promise.resolve(0);
      this.batches.set(id, {
        key,
        userId,
        requestHash: hash,
        status: 'IN_PROGRESS',
        httpStatus: null,
        responseJson: null,
        createdAt: new Date(),
        completedAt: null,
        expiresAt,
      });
      return Promise.resolve(1);
    }

    if (sql.includes('UPDATE "sync_batches"')) {
      const [hash, userId, key] = values as [string, string, string];
      const row = this.batches.get(this.key(userId, key));
      if (!row || row.status !== 'IN_PROGRESS') return Promise.resolve(0);
      if (Date.now() - row.createdAt.getTime() < 60_000) return Promise.resolve(0);
      row.requestHash = hash;
      row.createdAt = new Date();
      row.responseJson = null;
      row.httpStatus = null;
      return Promise.resolve(1);
    }

    if (sql.includes('INSERT INTO "sync_operations"')) {
      const [opId, userId, batchKey, entityType, entityId] = values as [
        string,
        string,
        string,
        string,
        string,
      ];
      if (this.operations.has(opId)) return Promise.resolve(0);
      this.operations.set(opId, {
        opId,
        userId,
        batchKey,
        entityType,
        entityId,
        result: 'APPLIED',
        resultJson: null,
        appliedAt: new Date(),
      });
      return Promise.resolve(1);
    }

    throw new Error(`FakePrisma : SQL non pris en charge, ${sql}`);
  };

  $queryRaw = (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    const sql = strings.join('?');
    if (sql.includes('FROM "sync_batches"')) {
      const [userId, key] = values as [string, string];
      const row = this.batches.get(this.key(userId, key));
      return Promise.resolve(row ? [clone(row)] : []);
    }
    throw new Error(`FakePrisma : requête non prise en charge, ${sql}`);
  };

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => {
    this.transactionCount += 1;
    const snapshot = {
      operations: new Map(this.operations),
      representants: new Map([...this.representants].map(([k, v]) => [k, clone(v)])),
      prospects: new Map([...this.prospects].map(([k, v]) => [k, clone(v)])),
      callAttempts: new Map([...this.callAttempts].map(([k, v]) => [k, clone(v)])),
      representantComments: new Map([...this.representantComments].map(([k, v]) => [k, clone(v)])),
      visites: new Map([...this.visites].map(([k, v]) => [k, clone(v)])),
    };
    try {
      return await fn(this);
    } catch (error) {
      this.operations = snapshot.operations;
      this.representants = snapshot.representants;
      this.prospects = snapshot.prospects;
      this.callAttempts = snapshot.callAttempts;
      this.representantComments = snapshot.representantComments;
      this.visites = snapshot.visites;
      this.rollbackCount += 1;
      throw error;
    }
  };

  syncBatch = {
    updateMany: (args: { where: { userId: string; key: string }; data: Partial<BatchRow> }) => {
      const row = this.batches.get(this.key(args.where.userId, args.where.key));
      if (!row) return Promise.resolve({ count: 0 });
      Object.assign(row, args.data);
      return Promise.resolve({ count: 1 });
    },
    deleteMany: (args: { where: { userId: string; key: string; status?: string } }) => {
      const id = this.key(args.where.userId, args.where.key);
      const row = this.batches.get(id);
      if (!row || (args.where.status && row.status !== args.where.status)) {
        return Promise.resolve({ count: 0 });
      }
      this.batches.delete(id);
      return Promise.resolve({ count: 1 });
    },
  };

  syncOperation = {
    findUnique: (args: { where: { opId: string } }) =>
      Promise.resolve(this.operations.get(args.where.opId) ?? null),
    update: (args: { where: { opId: string }; data: Partial<OperationRow> }) => {
      const row = this.operations.get(args.where.opId);
      if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
      Object.assign(row, args.data);
      return Promise.resolve(row);
    },
  };

  user = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.users.get(args.where.id) ?? null),
  };

  demoEntity = {
    aggregate: () =>
      Promise.resolve({
        _max: {
          sequence: this.demoEntities.length
            ? Math.max(...this.demoEntities.map((row) => row.sequence))
            : null,
        },
      }),
    upsert: (args: {
      where: { entityType_entityId: { entityType: string; entityId: string } };
      create: { entityType: string; entityId: string; sequence: number };
    }) => {
      const key = args.where.entityType_entityId;
      const existing = this.demoEntities.find(
        (row) => row.entityType === key.entityType && row.entityId === key.entityId,
      );
      if (existing) return Promise.resolve(existing);
      this.demoEntities.push({ ...args.create });
      return Promise.resolve(args.create);
    },
  };

  representant = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.representants.get(args.where.id) ?? null),
    findFirst: (args: { where?: Row }) =>
      Promise.resolve(
        [...this.representants.values()].find((row) =>
          matches(row as unknown as Row, args.where),
        ) ?? null,
      ),
    upsert: (args: { where: { id: string }; create: Row; update: Row }) => {
      const existing = this.representants.get(args.where.id);
      if (existing) {
        applyUpdate(existing as unknown as Row, args.update);
        return Promise.resolve(existing);
      }
      const created = {
        notes: null,
        rev: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...args.create,
      } as unknown as RepresentantRow;
      this.representants.set(created.id, created);
      return Promise.resolve(created);
    },
    update: (args: { where: { id: string }; data: Row }) => {
      const row = this.representants.get(args.where.id);
      if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
      applyUpdate(row as unknown as Row, args.data);
      return Promise.resolve(row);
    },
  };

  callOutcomeReason = {
    findUnique: (args: { where: { code: string } }) =>
      Promise.resolve(this.callOutcomeReasons.get(args.where.code) ?? null),
  };

  callAttempt = {
    findUnique: (args: { where: { id: string } }) => {
      const row = this.callAttempts.get(args.where.id);
      return Promise.resolve(row ? { ...row, task: null } : null);
    },
    createMany: (args: { data: CallAttemptRow[] }) => {
      let count = 0;
      for (const row of args.data) {
        if (this.callAttempts.has(row.id)) continue;
        this.callAttempts.set(row.id, clone(row));
        count += 1;
      }
      return Promise.resolve({ count });
    },
  };

  representantComment = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.representantComments.get(args.where.id) ?? null),
    createMany: (args: { data: RepresentantCommentRow[] }) => {
      let count = 0;
      for (const row of args.data) {
        if (this.representantComments.has(row.id)) continue;
        this.representantComments.set(row.id, clone(row));
        count += 1;
      }
      return Promise.resolve({ count });
    },
  };

  // Vide par defaut : une tentative arrive alors hors file, comme avant. Un test
  // qui veut une campagne remplit `callTasks` lui-meme.
  callTasks = new Map<string, Row>();

  callTask = {
    findFirst: (args: { where?: Row }) =>
      Promise.resolve([...this.callTasks.values()].find((row) => matches(row, args.where)) ?? null),
    updateMany: () => Promise.resolve({ count: 0 }),
  };

  scheduledCallback = {
    updateMany: () => Promise.resolve({ count: 0 }),
    createMany: () => Promise.resolve({ count: 1 }),
  };

  prospect = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.prospects.get(args.where.id) ?? null),
    findFirst: (args: { where?: Row; include?: unknown }) => {
      const row = [...this.prospects.values()].find((item) =>
        matches(item as unknown as Row, args.where),
      );
      if (!row) return Promise.resolve(null);
      return Promise.resolve({
        ...row,
        createdBy: { id: row.createdById, fullName: `Commercial ${row.createdById}` },
        representant: { id: row.representantId, fullName: `Rep ${row.representantId}` },
      });
    },
    upsert: (args: { where: { id: string }; create: Row; update: Row }) => {
      const existing = this.prospects.get(args.where.id);
      if (existing) {
        applyUpdate(existing as unknown as Row, args.update);
        return Promise.resolve(existing);
      }
      const created = {
        statut: 'NOUVEAU',
        phase2Status: 'PENDING',
        enrollmentMethod: null,
        enrollmentCapturedById: null,
        enrollmentCapturedAt: null,
        rev: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...args.create,
      } as unknown as ProspectRow;
      this.prospects.set(created.id, created);
      return Promise.resolve(created);
    },
    update: (args: { where: { id: string }; data: Row }) => {
      const row = this.prospects.get(args.where.id);
      if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
      applyUpdate(row as unknown as Row, args.data);
      return Promise.resolve(row);
    },
    updateMany: (args: { where: Row; data: Row }) => {
      let count = 0;
      for (const row of this.prospects.values()) {
        if (!matches(row as unknown as Row, args.where)) continue;
        applyUpdate(row as unknown as Row, args.data);
        count += 1;
      }
      return Promise.resolve({ count });
    },
  };

  private hydrateVisite(row: VisiteRow): Row {
    return {
      ...row,
      entreprise: this.visiteEntreprises.get(row.entrepriseId) ?? null,
      objet: this.visiteObjets.get(row.objetId) ?? null,
      direction: row.directionId ? (this.visiteDirections.get(row.directionId) ?? null) : null,
      destinataire: row.destinataireId
        ? (this.visiteDestinataires.get(row.destinataireId) ?? null)
        : null,
    };
  }

  visiteEntreprise = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.visiteEntreprises.get(args.where.id) ?? null),
  };

  visiteObjet = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.visiteObjets.get(args.where.id) ?? null),
  };

  visiteDirection = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.visiteDirections.get(args.where.id) ?? null),
  };

  visiteDestinataire = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.visiteDestinataires.get(args.where.id) ?? null),
  };

  visite = {
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.visites.get(args.where.id) ?? null),
    findFirst: (args: { where?: Row }) => {
      const where = args.where ?? {};
      const reference = where.reference as { startsWith: string } | undefined;
      if (reference) {
        const rows = [...this.visites.values()]
          .filter((row) => row.reference.startsWith(reference.startsWith))
          .sort((a, b) => (a.reference < b.reference ? 1 : -1));
        return Promise.resolve(rows[0] ? { reference: rows[0].reference } : null);
      }
      const rows = [...this.visites.values()].filter((row) =>
        matches(row as unknown as Row, where),
      );
      return Promise.resolve(rows[0] ?? null);
    },
    create: (args: { data: Row }) => {
      const data = args.data;
      const id = (data.id as string | undefined) ?? `fake-visite-${String(this.visites.size + 1)}`;
      if (this.visites.has(id)) {
        throw Object.assign(new Error('unique violation'), { code: 'P2002' });
      }
      const row = {
        phone: null,
        phoneE164: null,
        directionId: null,
        destinataireId: null,
        comment: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDemo: false,
        ...data,
        id,
      } as VisiteRow;
      this.visites.set(row.id, row);
      return Promise.resolve(this.hydrateVisite(row));
    },
  };
}

function applyUpdate(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) {
      row[key] = (row[key] as number) + (value as { increment: number }).increment;
      continue;
    }
    row[key] = value;
  }
  row.updatedAt = new Date();
}
