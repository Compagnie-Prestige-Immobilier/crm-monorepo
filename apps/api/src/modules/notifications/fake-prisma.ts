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
  isDemo: boolean;
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
  isDemo: boolean;
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
  isDemo: boolean;
}

export interface CallTaskRow {
  id: string;
  assignedToId: string;
  status: string;
  isActive: boolean;
  campaignStatus: string;
  isDemo: boolean;
}

export interface ScheduledCallbackRow {
  id: string;
  assignedToId: string;
  status: string;
  scheduledAt: Date;
  isDemo: boolean;
}

export interface BankCaseRow {
  id: string;
  stageType: BankStageType;
  createdAt: Date;
  lastTransitionAt: Date | null;
  deletedAt: Date | null;
  isDemo: boolean;
}

export const ADMIN: UserRow = {
  id: 'usr-admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
  email: 'admin@cpi.sn',
  isActive: true,
  deletedAt: null,
  isDemo: false,
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
    if (expected === undefined) continue;

    if (key === 'OR') {
      const branches = expected as Record<string, unknown>[];
      if (!branches.some((branch) => matches(row, branch, db))) return false;
      continue;
    }

    if (key === 'user') {
      const user = db.users.find((candidate) => candidate.id === row.userId);
      if (
        !user ||
        !matches(
          user as unknown as Record<string, unknown>,
          expected as Record<string, unknown>,
          db,
        )
      ) {
        return false;
      }
      continue;
    }
    if (key === 'notification') {
      const notification = db.notifications.find(
        (candidate) => candidate.id === row.notificationId,
      );
      if (
        !notification ||
        !matches(
          notification as unknown as Record<string, unknown>,
          expected as Record<string, unknown>,
          db,
        )
      ) {
        return false;
      }
      continue;
    }
    if (key === 'deliveries') {
      const clause = expected as { none?: Record<string, unknown> };
      if (clause.none !== undefined) {
        const id = row.id;
        const found = db.deliveries.some(
          (delivery) =>
            delivery.notificationId === id &&
            matches(delivery as unknown as Record<string, unknown>, clause.none, db),
        );
        if (found) return false;
      }
      continue;
    }
    if (key === 'campaign') {
      const clause = expected as { status?: unknown };
      if (clause.status !== undefined && row.campaignStatus !== clause.status) return false;
      continue;
    }
    if (key === 'currentStage') {
      const clause = expected as { type?: unknown };
      if (clause.type !== undefined && row.stageType !== clause.type) return false;
      continue;
    }
    if (key === 'transitions') {
      const clause = expected as { none?: { createdAt?: { gt?: Date } } };
      const after = clause.none?.createdAt?.gt;
      if (after !== undefined) {
        const last = row.lastTransitionAt;
        if (last instanceof Date && last.getTime() > after.getTime()) return false;
      }
      continue;
    }

    const actual = row[key];
    if (expected === null) {
      if (actual !== null && actual !== undefined) return false;
      continue;
    }
    if (expected instanceof Date) {
      if (!(actual instanceof Date) || actual.getTime() !== expected.getTime()) return false;
      continue;
    }
    if (typeof expected === 'object') {
      const filter = expected as {
        in?: unknown[];
        lte?: Date;
        lt?: Date;
        gt?: number;
        not?: unknown;
      };
      if (filter.in && !filter.in.includes(actual)) return false;
      if (filter.lte !== undefined) {
        if (!(actual instanceof Date) || actual.getTime() > filter.lte.getTime()) return false;
      }
      if (filter.lt !== undefined) {
        if (!(actual instanceof Date) || actual.getTime() >= filter.lt.getTime()) return false;
      }
      if (filter.gt !== undefined && !(typeof actual === 'number' && actual > filter.gt))
        return false;
      if ('not' in filter && actual === filter.not) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
};

export class FakePrisma {
  clock: () => Date = () => new Date();

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
      isDemo: row.isDemo ?? false,
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
      isDemo: row.isDemo ?? false,
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
      isDemo: row.isDemo ?? false,
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
      isDemo: row.isDemo ?? false,
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
      isDemo: row.isDemo ?? false,
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

  get notification() {
    return {
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

        const row: NotificationRow = {
          id: nextId('ntf'),
          title: String(data.title),
          body: String(data.body),
          category:
            (data.category as NotificationCategory | undefined) ?? NotificationCategory.ANNONCE,
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
          reminderKey,
          period,
          createdAt: this.clock(),
          updatedAt: this.clock(),
          dispatchClaim: (data.dispatchClaim as string | null | undefined) ?? null,
          isDemo: data.isDemo === true,
        };

        const nested = data.deliveries as
          | { createMany?: { data: Record<string, unknown>[] }; create?: Record<string, unknown>[] }
          | undefined;
        const seeds = nested?.createMany?.data ?? nested?.create ?? [];

        const prepared: DeliveryRow[] = [];
        for (const seed of seeds) {
          const delivery: DeliveryRow = {
            id: nextId('dlv'),
            notificationId: row.id,
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
            createdAt: new Date(),
            isDemo: seed.isDemo === true,
          };

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
        orderBy?: Record<string, string>;
      }) => {
        let rows = this.notifications.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
      findMany: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.deliveries
            .filter((row) => matches(row as unknown as Record<string, unknown>, args.where, this))
            .map((row) => ({
              ...row,
              user: this.users.find((user) => user.id === row.userId),
              notification: this.notifications.find(
                (notification) => notification.id === row.notificationId,
              ),
            })),
        ),

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

export class FakeBrevoTransport implements BrevoTransport {
  readonly sent: BrevoMessage[] = [];
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
