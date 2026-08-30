import {
  BankStageType,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Prisma,
  Role,
} from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { SupervisionGranularity } from '../analytics/supervision.dto.js';
import type {
  SupervisionActivityDto,
  SupervisionActivityRowDto,
  SupervisionQueryDto,
  SupervisionTeleconseillerDto,
} from '../analytics/supervision.dto.js';
import type { SupervisionActivityService } from '../analytics/supervision.service.js';
import type {
  BrevoDispatchResult,
  BrevoMessage,
  BrevoSendOutcome,
  BrevoTransport,
} from './brevo.transport.js';

let sequence = 0;
const nextId = (prefix: string): string => `${prefix}-${String(++sequence).padStart(4, '0')}`;

export interface UserRow {
  id: string;
  fullName: string;
  role: Role;
  email: string;
  isActive: boolean;
  deletedAt: Date | null;
  departementId: string | null;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  route: string | null;
  audience: NotificationAudience;
  audienceRole: Role | null;
  audienceDepartementId: string | null;
  audienceUserIds: string[];
  status: NotificationStatus;
  scheduledFor: Date | null;
  sentAt: Date | null;
  cancelledAt: Date | null;
  transportStatus: string | null;
  templateId: string | null;
  createdById: string | null;
  reminderKey: string | null;
  period: string | null;
  createdAt: Date;
  updatedAt: Date;
  dispatchClaim: string | null;
}

export interface DeliveryRow {
  id: string;
  notificationId: string;
  userId: string;
  status: NotificationDeliveryStatus;
  error: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  reminderKey: string | null;
  period: string | null;
  createdAt: Date;
}

export interface CallTaskRow {
  id: string;
  assignedToId: string;
  status: string;
  isActive: boolean;
  campaignStatus: string;
}

export interface ScheduledCallbackRow {
  id: string;
  assignedToId: string;
  status: string;
  scheduledAt: Date;
  updatedAt: Date;
}

export interface BankCaseRow {
  id: string;
  stageType: BankStageType;
  createdAt: Date;
  lastTransitionAt: Date | null;
  deletedAt: Date | null;
}

export const ADMIN: UserRow = {
  id: 'usr-admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
  email: 'admin@cpi.sn',
  isActive: true,
  deletedAt: null,
  departementId: null,
};

const uniqueViolation = (target: string[]): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });

const matches = (
  row: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
  db: FakePrisma,
): boolean => {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (!matchesClause(row, key, expected, db)) return false;
  }
  return true;
};

function matchesClause(
  row: Record<string, unknown>,
  key: string,
  expected: unknown,
  db: FakePrisma,
): boolean {
  if (expected === undefined) return true;
  if (key === 'OR') {
    return (expected as Record<string, unknown>[]).some((branch) => matches(row, branch, db));
  }
  if (key === 'user') return matchesRelated(db.users, row.userId, expected, db);
  if (key === 'notification') {
    return matchesRelated(db.notifications, row.notificationId, expected, db);
  }
  if (key === 'deliveries') return matchesDeliveries(row.id, expected, db);
  if (key === 'campaign') return matchesProperty(row.campaignStatus, expected, 'status');
  if (key === 'currentStage') return matchesProperty(row.stageType, expected, 'type');
  if (key === 'transitions') return matchesTransitions(row.lastTransitionAt, expected);
  return matchesValue(row[key], expected);
}

function matchesRelated(
  candidates: readonly { id: string }[],
  id: unknown,
  expected: unknown,
  db: FakePrisma,
): boolean {
  const found = candidates.find((candidate) => candidate.id === id);
  return (
    found !== undefined &&
    matches(found as unknown as Record<string, unknown>, expected as Record<string, unknown>, db)
  );
}

function matchesDeliveries(id: unknown, expected: unknown, db: FakePrisma): boolean {
  const none = (expected as { none?: Record<string, unknown> }).none;
  if (none === undefined) return true;
  return !db.deliveries.some(
    (delivery) =>
      delivery.notificationId === id &&
      matches(delivery as unknown as Record<string, unknown>, none, db),
  );
}

function matchesProperty(actual: unknown, expected: unknown, key: string): boolean {
  const value = (expected as Record<string, unknown>)[key];
  return value === undefined || actual === value;
}

function matchesTransitions(actual: unknown, expected: unknown): boolean {
  const after = (expected as { none?: { createdAt?: { gt?: Date } } }).none?.createdAt?.gt;
  return after === undefined || !(actual instanceof Date) || actual.getTime() <= after.getTime();
}

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (expected instanceof Date)
    return actual instanceof Date && actual.getTime() === expected.getTime();
  if (typeof expected !== 'object') return actual === expected;
  const filter = expected as {
    in?: unknown[];
    lte?: Date;
    lt?: Date;
    gte?: Date;
    gt?: number;
    not?: unknown;
  };
  if (filter.in !== undefined && !filter.in.includes(actual)) return false;
  if (!matchesDateFilter(actual, filter)) return false;
  if (filter.gt !== undefined && !(typeof actual === 'number' && actual > filter.gt)) return false;
  return !('not' in filter) || actual !== filter.not;
}

function matchesDateFilter(
  actual: unknown,
  filter: { lte?: Date; lt?: Date; gte?: Date },
): boolean {
  if (filter.lte === undefined && filter.gte === undefined && filter.lt === undefined) return true;
  if (!(actual instanceof Date)) return false;
  if (filter.lte !== undefined && actual > filter.lte) return false;
  if (filter.gte !== undefined && actual < filter.gte) return false;
  return filter.lt === undefined || actual < filter.lt;
}

type OrderBy = Record<string, string> | Record<string, string>[] | undefined;

const compare = (left: unknown, right: unknown): number => {
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === 'string' && typeof right === 'string')
    return left < right ? -1 : +(left > right);
  return 0;
};

const sorted = <T extends Record<string, unknown>>(rows: readonly T[], orderBy: OrderBy): T[] => {
  let clauses: Record<string, string>[];
  if (orderBy === undefined) clauses = [];
  else if (Array.isArray(orderBy)) clauses = orderBy;
  else clauses = [orderBy];
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const delta = compare(left[field], right[field]);
        if (delta !== 0) return direction === 'desc' ? -delta : delta;
      }
    }
    return 0;
  });
};

export class FakePrisma {
  clock: () => Date = () => new Date();

  /**
   * PostgreSQL ne promet AUCUN ordre à égalité de tri. Levé, ce drapeau rend la
   * chose visible : un `orderBy` qui ne départage pas rend deux réponses
   * différentes pour la même question.
   */
  unstableTies = false;
  private tie = 0;

  private order<T extends Record<string, unknown>>(rows: readonly T[], orderBy: OrderBy): T[] {
    this.tie += 1;
    const source = this.unstableTies && this.tie % 2 === 0 ? [...rows].reverse() : rows;
    return sorted(source, orderBy);
  }

  readonly faults = new Map<string, Error>();

  breakOn(operation: 'user.findMany' | 'notificationDelivery.updateMany', error: Error): void {
    this.faults.set(operation, error);
  }

  private fault(operation: string): Promise<never> | null {
    const armed = this.faults.get(operation);
    return armed ? Promise.reject(armed) : null;
  }

  readonly users: UserRow[] = [ADMIN];
  readonly notifications: NotificationRow[] = [];
  readonly deliveries: DeliveryRow[] = [];
  readonly callTasks: CallTaskRow[] = [];
  readonly repCallTasks: CallTaskRow[] = [];
  readonly bankCases: BankCaseRow[] = [];
  readonly scheduledCallbacks: ScheduledCallbackRow[] = [];

  addUser(row: Partial<UserRow> & { id: string }): UserRow {
    const user: UserRow = {
      fullName: row.fullName ?? `Compte ${row.id}`,
      role: row.role ?? Role.COMMERCIAL,
      email: row.email ?? `${row.id}@cpi.sn`,
      isActive: row.isActive ?? true,
      deletedAt: row.deletedAt ?? null,
      departementId: row.departementId ?? null,
      id: row.id,
    };
    this.users.push(user);
    return user;
  }

  addCallTask(row: Partial<CallTaskRow> & { assignedToId: string }): CallTaskRow {
    const task: CallTaskRow = {
      id: row.id ?? nextId('task'),
      assignedToId: row.assignedToId,
      status: row.status ?? 'OPEN',
      isActive: row.isActive ?? true,
      campaignStatus: row.campaignStatus ?? 'ACTIVE',
    };
    this.callTasks.push(task);
    return task;
  }

  addRepCallTask(row: Partial<CallTaskRow> & { assignedToId: string }): CallTaskRow {
    const task: CallTaskRow = {
      id: row.id ?? nextId('rep-task'),
      assignedToId: row.assignedToId,
      status: row.status ?? 'OPEN',
      isActive: row.isActive ?? true,
      campaignStatus: row.campaignStatus ?? 'ACTIVE',
    };
    this.repCallTasks.push(task);
    return task;
  }

  addScheduledCallback(
    row: Partial<ScheduledCallbackRow> & { assignedToId: string; scheduledAt: Date },
  ): ScheduledCallbackRow {
    const callback: ScheduledCallbackRow = {
      id: row.id ?? nextId('callback'),
      assignedToId: row.assignedToId,
      status: row.status ?? 'PENDING',
      scheduledAt: row.scheduledAt,
      updatedAt: row.updatedAt ?? row.scheduledAt,
    };
    this.scheduledCallbacks.push(callback);
    return callback;
  }

  addBankCase(row: Partial<BankCaseRow> = {}): BankCaseRow {
    const bankCase: BankCaseRow = {
      id: row.id ?? nextId('case'),
      stageType: row.stageType ?? BankStageType.OPEN,
      createdAt: row.createdAt ?? new Date(),
      lastTransitionAt: row.lastTransitionAt ?? null,
      deletedAt: row.deletedAt ?? null,
    };
    this.bankCases.push(bankCase);
    return bankCase;
  }

  get user() {
    return {
      findMany: (args: { where?: Record<string, unknown> }) =>
        this.fault('user.findMany') ??
        Promise.resolve(
          this.users.filter((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ),
        ),
    };
  }

  private buildNotification(data: Record<string, unknown>): NotificationRow {
    return {
      id: (data.id as string | undefined) ?? nextId('ntf'),
      title: String(data.title),
      body: String(data.body),
      category: (data.category as NotificationCategory | undefined) ?? NotificationCategory.ANNONCE,
      route: (data.route as string | null | undefined) ?? null,
      audience: (data.audience as NotificationAudience | undefined) ?? NotificationAudience.ALL,
      audienceRole: (data.audienceRole as Role | null | undefined) ?? null,
      audienceDepartementId: (data.audienceDepartementId as string | null | undefined) ?? null,
      audienceUserIds: (data.audienceUserIds as string[] | undefined) ?? [],
      status: (data.status as NotificationStatus | undefined) ?? NotificationStatus.SENT,
      scheduledFor: (data.scheduledFor as Date | null | undefined) ?? null,
      sentAt: null,
      cancelledAt: null,
      transportStatus: null,
      templateId: (data.templateId as string | null | undefined) ?? null,
      createdById: (data.createdById as string | null | undefined) ?? null,
      reminderKey: (data.reminderKey as string | null | undefined) ?? null,
      period: (data.period as string | null | undefined) ?? null,
      createdAt: (data.createdAt as Date | undefined) ?? this.clock(),
      updatedAt: this.clock(),
      dispatchClaim: (data.dispatchClaim as string | null | undefined) ?? null,
    };
  }

  private buildDelivery(notificationId: string, seed: Record<string, unknown>): DeliveryRow {
    return {
      id: (seed.id as string | undefined) ?? nextId('dlv'),
      notificationId,
      userId: String(seed.userId),
      status:
        (seed.status as NotificationDeliveryStatus | undefined) ??
        NotificationDeliveryStatus.PENDING,
      error: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      reminderKey: (seed.reminderKey as string | null | undefined) ?? null,
      period: (seed.period as string | null | undefined) ?? null,
      createdAt: (seed.createdAt as Date | undefined) ?? new Date(),
    };
  }

  private notificationClash(row: NotificationRow): boolean {
    return (
      row.reminderKey !== null &&
      this.notifications.some(
        (existing) => existing.reminderKey === row.reminderKey && existing.period === row.period,
      )
    );
  }

  private deliveryClash(row: DeliveryRow): boolean {
    if (
      this.deliveries.some(
        (existing) =>
          existing.notificationId === row.notificationId && existing.userId === row.userId,
      )
    ) {
      return true;
    }
    return (
      row.reminderKey !== null &&
      this.deliveries.some(
        (existing) =>
          existing.reminderKey === row.reminderKey &&
          existing.userId === row.userId &&
          existing.period === row.period,
      )
    );
  }

  get notification() {
    return {
      createMany: (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const data of args.data) {
          const row = this.buildNotification(data);
          if (this.notificationClash(row)) {
            if (args.skipDuplicates) continue;
            return Promise.reject(uniqueViolation(['reminderKey', 'period']));
          }
          this.notifications.push(row);
          count += 1;
        }
        return Promise.resolve({ count });
      },

      create: (args: { data: Record<string, unknown> }) => {
        const data = args.data;
        const reminderKey = (data.reminderKey as string | null | undefined) ?? null;
        const period = (data.period as string | null | undefined) ?? null;

        if (
          reminderKey !== null &&
          this.notifications.some((row) => row.reminderKey === reminderKey && row.period === period)
        ) {
          return Promise.reject(uniqueViolation(['reminderKey', 'period']));
        }

        const row = this.buildNotification(data);

        const nested = data.deliveries as
          | { createMany?: { data: Record<string, unknown>[] }; create?: Record<string, unknown>[] }
          | undefined;
        const seeds = nested?.createMany?.data ?? nested?.create ?? [];

        const prepared: DeliveryRow[] = [];
        for (const seed of seeds) {
          const delivery = this.buildDelivery(row.id, seed);

          const clash =
            delivery.reminderKey !== null &&
            this.deliveries.some(
              (existing) =>
                existing.reminderKey === delivery.reminderKey &&
                existing.userId === delivery.userId &&
                existing.period === delivery.period,
            );
          if (clash) return Promise.reject(uniqueViolation(['reminderKey', 'userId', 'period']));

          prepared.push(delivery);
        }

        this.notifications.push(row);
        this.deliveries.push(...prepared);
        return Promise.resolve(row);
      },

      findUnique: (args: { where: { id: string } }) =>
        Promise.resolve(this.decorate(this.notifications.find((row) => row.id === args.where.id))),

      findFirst: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.decorate(
            this.notifications.find((row) =>
              matches(row as unknown as Record<string, unknown>, args.where, this),
            ),
          ),
        ),

      findMany: (args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: OrderBy;
      }) => {
        const matching = this.notifications.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        const rows = this.order(
          matching as unknown as Record<string, unknown>[],
          args.orderBy ?? { createdAt: 'desc' },
        ) as unknown as NotificationRow[];
        const skip = args.skip ?? 0;
        const take = args.take ?? rows.length;
        return Promise.resolve(rows.slice(skip, skip + take).map((row) => this.decorate(row)));
      },

      count: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.notifications.filter((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ).length,
        ),

      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = this.notifications.find((candidate) => candidate.id === args.where.id);
        if (!row) return Promise.reject(new Error('notification introuvable'));
        Object.assign(row, args.data, { updatedAt: this.clock() });
        return Promise.resolve(this.decorate(row));
      },

      updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = this.notifications.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        for (const row of rows) Object.assign(row, args.data, { updatedAt: this.clock() });
        return Promise.resolve({ count: rows.length });
      },
    };
  }

  get notificationDelivery() {
    return {
      createMany: (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const seed of args.data) {
          const row = this.buildDelivery(String(seed.notificationId), seed);
          if (this.deliveryClash(row)) {
            if (args.skipDuplicates) continue;
            return Promise.reject(uniqueViolation(['reminderKey', 'userId', 'period']));
          }
          this.deliveries.push(row);
          count += 1;
        }
        return Promise.resolve({ count });
      },

      findMany: (args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: OrderBy;
      }) => {
        const matching = this.deliveries.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        const rows = this.order(
          matching as unknown as Record<string, unknown>[],
          args.orderBy,
        ) as unknown as DeliveryRow[];
        const skip = args.skip ?? 0;
        const take = args.take ?? rows.length;
        return Promise.resolve(
          rows.slice(skip, skip + take).map((row) => ({
            ...row,
            user: this.users.find((user) => user.id === row.userId),
            notification: this.notifications.find(
              (notification) => notification.id === row.notificationId,
            ),
          })),
        );
      },

      findFirst: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.deliveries.find((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ) ?? null,
        ),

      count: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.deliveries.filter((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ).length,
        ),

      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = this.deliveries.find((candidate) => candidate.id === args.where.id);
        if (!row) return Promise.reject(new Error('livraison introuvable'));
        Object.assign(row, args.data);
        return Promise.resolve(row);
      },

      updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const armed = this.fault('notificationDelivery.updateMany');
        if (armed) return armed;
        const rows = this.deliveries.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        for (const row of rows) Object.assign(row, args.data);
        return Promise.resolve({ count: rows.length });
      },

      groupBy: (args: { where?: Record<string, unknown> }) => {
        const rows = this.deliveries.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        const buckets = new Map<string, number>();
        for (const row of rows) {
          const key = `${row.notificationId} ${row.status}`;
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        return Promise.resolve(
          [...buckets.entries()].map(([key, count]) => {
            const [notificationId, status] = key.split(' ');
            return {
              notificationId: notificationId ?? '',
              status: status as NotificationDeliveryStatus,
              _count: { _all: count },
            };
          }),
        );
      },
    };
  }

  private groupTasksBy(
    source: readonly { assignedToId: string }[],
    where?: Record<string, unknown>,
  ) {
    const rows = source.filter((row) =>
      matches(row as unknown as Record<string, unknown>, where, this),
    );
    const buckets = new Map<string, number>();
    for (const row of rows) buckets.set(row.assignedToId, (buckets.get(row.assignedToId) ?? 0) + 1);
    return Promise.resolve(
      [...buckets.entries()].map(([assignedToId, count]) => ({
        assignedToId,
        _count: { _all: count },
      })),
    );
  }

  get callTask() {
    return {
      groupBy: (args: { where?: Record<string, unknown> }) =>
        this.groupTasksBy(this.callTasks, args.where),
    };
  }

  get repCallTask() {
    return {
      groupBy: (args: { where?: Record<string, unknown> }) =>
        this.groupTasksBy(this.repCallTasks, args.where),
    };
  }

  get scheduledCallback() {
    return {
      groupBy: (args: { where?: Record<string, unknown> }) =>
        this.groupTasksBy(this.scheduledCallbacks, args.where),
      count: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.scheduledCallbacks.filter((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ).length,
        ),
    };
  }

  get bankCase() {
    return {
      count: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.bankCases.filter((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ).length,
        ),
    };
  }

  get notificationTemplate() {
    const rows: Record<string, unknown>[] = [];
    return {
      findMany: () => Promise.resolve(rows),
      findFirst: () => Promise.resolve(null),
    };
  }

  private decorate(row: NotificationRow | undefined): unknown {
    if (!row) return null;
    const createdBy = this.users.find((user) => user.id === row.createdById);
    return { ...row, createdBy: createdBy ? { fullName: createdBy.fullName } : null };
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

const DELEGATES = new Set([
  'user',
  'notification',
  'notificationDelivery',
  'notificationTemplate',
  'callTask',
  'repCallTask',
  'scheduledCallback',
  'bankCase',
]);

/** La même doublure, avec la trace de chaque aller-retour qu'on lui demande. */
export const countingPrisma = (db: FakePrisma): { prisma: PrismaService; calls: string[] } => {
  const calls: string[] = [];
  const prisma = new Proxy(db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property);
      if (typeof property !== 'string' || !DELEGATES.has(property)) return value;

      const delegate = value as Record<string, (args: unknown) => unknown>;
      const traced: Record<string, unknown> = {};
      for (const [name, operation] of Object.entries(delegate)) {
        traced[name] = (args: unknown): unknown => {
          calls.push(`${property}.${name}`);
          return operation(args);
        };
      }
      return traced;
    },
  }) as unknown as PrismaService;

  return { prisma, calls };
};

const LIGNE_VIDE = {
  bucket: '',
  teleconseillerId: '',
  teleconseillerName: '',
  calls: 0,
  unreachable: 0,
  wrongNumber: 0,
  refused: 0,
  other: 0,
  methodObtained: 0,
  callback: 0,
  reachRate: null,
  prospectsCreated: 0,
  representantsContacted: 0,
  repCalls: 0,
  repReached: 0,
  repCallback: 0,
  repUnreachable: 0,
  repOther: 0,
  repContactRate: null,
  repCallbackRate: null,
  repQuestioned: 0,
  repQualified: 0,
  repQualificationRate: null,
} satisfies SupervisionActivityRowDto;

/** Le module analytics rendu par son service réel ; ici on ne fournit que sa réponse. */
export class FakeActivity {
  readonly items: SupervisionActivityRowDto[] = [];
  readonly teleconseillers: SupervisionTeleconseillerDto[] = [];
  readonly prospectsByTeleconseiller: { id: string | null; label: string; prospects: number }[] =
    [];
  readonly prospectsByRepresentant: { id: string | null; label: string; prospects: number }[] = [];
  readonly windows: { from: string | undefined; to: string | undefined }[] = [];

  addRow(row: Partial<SupervisionActivityRowDto> & { teleconseillerId: string }): void {
    this.items.push(
      Object.assign({ ...LIGNE_VIDE, teleconseillerName: row.teleconseillerId }, row),
    );
  }

  addTeleconseiller(row: Partial<SupervisionTeleconseillerDto> & { id: string }): void {
    this.teleconseillers.push({
      fullName: row.fullName ?? `Compte ${row.id}`,
      isActive: row.isActive ?? true,
      id: row.id,
    });
  }

  activite(query: SupervisionQueryDto): Promise<SupervisionActivityDto> {
    this.windows.push({ from: query.actFrom, to: query.actTo });
    return Promise.resolve({
      from: null,
      to: null,
      granularity: SupervisionGranularity.DAY,
      totals: LIGNE_VIDE,
      items: this.items,
      teleconseillers: this.teleconseillers,
      prospectsByTeleconseiller: this.prospectsByTeleconseiller,
      prospectsByRepresentant: this.prospectsByRepresentant,
    });
  }

  asService(): SupervisionActivityService {
    return this as unknown as SupervisionActivityService;
  }
}

export class FakeBrevoTransport implements BrevoTransport {
  readonly sent: BrevoMessage[] = [];
  /** Appels HTTP sortants, à distinguer du nombre de messages composés. */
  calls = 0;
  configured = false;

  constructor(
    private readonly outcomeFor: (recipient: string) => BrevoSendOutcome = (email) => ({
      email,
      ok: true,
    }),
  ) {}

  isConfigured(): boolean {
    return this.configured;
  }

  unavailableReason(): string | null {
    return this.configured ? null : 'Transport e-mail de test désactivé.';
  }

  send(messages: readonly BrevoMessage[]): Promise<BrevoDispatchResult> {
    this.calls += 1;
    if (!this.configured) {
      return Promise.resolve({
        status: 'NOT_CONFIGURED',
        outcomes: [],
        detail: 'Transport e-mail de test désactivé.',
      });
    }
    this.sent.push(...messages);
    const outcomes = messages.flatMap((message) =>
      message.recipients.map((recipient) => this.outcomeFor(recipient.email)),
    );

    const delivered = outcomes.filter((outcome) => outcome.ok).length;
    const failed = outcomes.find((outcome) => !outcome.ok);

    return Promise.resolve({
      status: outcomes.length > 0 && delivered === 0 ? 'TRANSPORT_ERROR' : 'SENT',
      outcomes,
      ...(delivered === 0 && failed?.errorCode !== undefined ? { detail: failed.errorCode } : {}),
    });
  }

  get allAddresses(): string[] {
    return this.sent.flatMap((message) => message.recipients.map((recipient) => recipient.email));
  }
}

export class BrokenBrevoTransport implements BrevoTransport {
  isConfigured(): boolean {
    return true;
  }

  unavailableReason(): string | null {
    return null;
  }

  send(): Promise<BrevoDispatchResult> {
    return Promise.resolve({
      status: 'TRANSPORT_ERROR',
      outcomes: [],
      detail: 'HTTP_401',
    });
  }
}

export class ThrowingBrevoTransport implements BrevoTransport {
  isConfigured(): boolean {
    return true;
  }

  unavailableReason(): string | null {
    return null;
  }

  send(): Promise<BrevoDispatchResult> {
    return Promise.reject(new Error('socket hang up'));
  }
}
