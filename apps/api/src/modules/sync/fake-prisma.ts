/**
 * Doublure Prisma en mémoire, réservée aux tests de synchronisation.
 *
 * Elle n'imite pas PostgreSQL : elle reproduit exactement les trois
 * comportements dont dépend la logique d'idempotence, et rien d'autre.
 *
 *  1. `INSERT ... ON CONFLICT DO NOTHING` renvoie 1 ou 0 lignes affectées.
 *  2. `$transaction` restaure l'état antérieur si le rappel lève, c'est ce qui
 *     permet de vérifier qu'un groupe défaillant n'emporte pas le groupe voisin.
 *  3. Le marqueur de lot vit HORS des transactions : les tests peuvent donc
 *     constater qu'un rollback ne l'efface pas.
 *
 * Les garanties réelles (atomicité de ON CONFLICT sous concurrence, isolation
 * ReadCommitted) ne se démontrent que contre un vrai serveur : c'est l'objet de
 * `sync.integration.test.ts`.
 */

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
  /**
   * IEF de rattachement, FACULTATIVE.
   *
   * Présente dans la doublure parce que c'est le seul champ que l'utilisateur
   * peut VIDER : sans elle, le test qui distingue « champ absent » de « champ
   * vidé » n'aurait rien à observer.
   */
  iefId?: string | null;
  rev: number;
  departementId: string;
  createdById: string;
  clientCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  /**
   * Posée par `SyncService` depuis la NATURE DE L'AUTEUR.
   *
   * Elle était auparavant absente, au motif que « la remontée hors ligne est
   * du travail réel ». C'était faux : l'animateur d'une démonstration se
   * connecte sur le téléphone avec un compte de démonstration, et ses fiches
   * naissaient donc réelles. Reste facultative dans le double, pour qu'un test
   * puisse constater l'absence au lieu de la supposer.
   */
  isDemo?: boolean;
}

export interface ProspectRow {
  id: string;
  nom: string;
  prenom: string;
  phoneE164: string;
  rev: number;
  statut: string;
  banqueId: string;
  syndicatId: string;
  representantId: string;
  createdById: string;
  clientCreatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  /** Facultatif à dessein, même raison que sur `RepresentantRow`. */
  isDemo?: boolean;
}

type Row = Record<string, unknown>;

/** Filtre `where` minimal : égalité, `null`, `{ not }`, et l'imbriqué `createdBy`. */
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
  /**
   * Comptes connus, pour la seule question que `SyncService` leur pose : cet
   * auteur est-il un compte de démonstration ? Un compte ABSENT vaut « réel »,
   * ce qui est l'état de la quasi-totalité des tests et leur évite d'avoir à
   * déclarer un utilisateur qui ne les concerne pas.
   */
  users = new Map<string, { id: string; isDemo: boolean; role?: string }>();
  /** Entrées du registre de purge, dans leur ordre d'inscription. */
  demoEntities: { entityType: string; entityId: string; sequence: number }[] = [];

  /** Déclare un compte de démonstration, pour les tests qui parlent de lui. */
  addDemoUser(id: string): void {
    this.users.set(id, { id, isDemo: true });
  }

  /**
   * Déclare un compte avec son RÔLE.
   *
   * Le rôle vient désormais de la même lecture que `isDemo`, parce que le lot
   * lit son autorité en une fois : une doublure qui ne porterait pas le rôle
   * ferait retomber le service sur celui du jeton quoi qu'il arrive, et le test
   * de cohérence du lot ne pourrait pas rougir.
   */
  addUser(id: string, row: { role?: string; isDemo?: boolean } = {}): void {
    this.users.set(id, { id, isDemo: row.isDemo ?? false, ...(row.role ? { role: row.role } : {}) });
  }

  /** Compte les tentatives de transaction, pour vérifier une-transaction-par-groupe. */
  transactionCount = 0;
  /** Nombre de rollbacks constatés. */
  rollbackCount = 0;

  private key(userId: string, key: string): string {
    return `${userId}|${key}`;
  }

  // ─── SQL brut ─────────────────────────────────────────────────────────────

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

  // ─── Transactions ─────────────────────────────────────────────────────────

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => {
    this.transactionCount += 1;
    const snapshot = {
      operations: new Map(this.operations),
      representants: new Map([...this.representants].map(([k, v]) => [k, clone(v)])),
      prospects: new Map([...this.prospects].map(([k, v]) => [k, clone(v)])),
    };
    try {
      return await fn(this);
    } catch (error) {
      // Les lots (`sync_batches`) ne sont PAS restaurés : leur marqueur vit
      // hors transaction, et c'est précisément ce que les tests vérifient.
      this.operations = snapshot.operations;
      this.representants = snapshot.representants;
      this.prospects = snapshot.prospects;
      this.rollbackCount += 1;
      throw error;
    }
  };

  // ─── Modèles ──────────────────────────────────────────────────────────────

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

  /**
   * Registre de purge. Le service y inscrit les lignes fictives nées hors
   * ensemenceur ; sans cette inscription, elles retiendraient les lignes
   * semées par `onDelete: Restrict` et rendraient la purge impossible.
   */
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
}

/** Applique un `data` Prisma, y compris `{ increment: n }`. */
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
