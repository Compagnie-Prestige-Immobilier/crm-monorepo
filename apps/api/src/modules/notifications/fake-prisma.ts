import {
  DevicePlatform,
  NotificationAudience,
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationStatus,
  Prisma,
  Role,
} from '@crm/database';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type {
  FcmDispatchResult,
  FcmMessage,
  FcmSendOutcome,
  FcmTransport,
} from './fcm.transport.js';

/**
 * Doublure Prisma en mémoire, réservée aux tests de notification.
 *
 * Elle n'imite pas PostgreSQL. Elle reproduit exactement les quatre
 * comportements dont dépend la logique du module, et rien d'autre :
 *
 *  1. les contraintes UNIQUE lèvent une `PrismaClientKnownRequestError` P2002 —
 *     c'est sur elle que repose TOUTE l'idempotence des rappels ;
 *  2. `updateMany` renvoie un compte, ce qui permet de vérifier la prise en
 *     charge atomique d'un envoi programmé par une seule instance ;
 *  3. `upsert` sur `token` réattribue au lieu de dupliquer ;
 *  4. `groupBy` agrège, parce que les compteurs de livraison en dépendent.
 *
 * Les garanties réelles sous concurrence ne se démontrent que contre un vrai
 * serveur ; c'est l'objet des tests d'intégration.
 */

let sequence = 0;
const nextId = (prefix: string): string => `${prefix}-${String(++sequence).padStart(4, '0')}`;

export interface UserRow {
  id: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  deletedAt: Date | null;
  departementId: string | null;
}

export interface DeviceTokenRow {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  appVersion: string | null;
  lastSeenAt: Date;
  revokedAt: Date | null;
  pendingOps: number;
  pendingSince: Date | null;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  route: string | null;
  payload: unknown;
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
}

export interface DeliveryRow {
  id: string;
  notificationId: string;
  userId: string;
  status: NotificationDeliveryStatus;
  deviceToken: string | null;
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

export const ADMIN: UserRow = {
  id: 'usr-admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
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

/** Égalité, `null`, `{ in }`, `{ lte }`, `{ gt }`, et le `where` imbriqué `user`/`notification`. */
const matches = (
  row: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
  db: FakePrisma,
): boolean => {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue;

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
    if (key === 'campaign') {
      const clause = expected as { status?: unknown };
      if (clause.status !== undefined && row.campaignStatus !== clause.status) return false;
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
      const filter = expected as { in?: unknown[]; lte?: Date; gt?: number; not?: unknown };
      if (filter.in && !filter.in.includes(actual)) return false;
      if (filter.lte !== undefined) {
        if (!(actual instanceof Date) || actual.getTime() > filter.lte.getTime()) return false;
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
  readonly users: UserRow[] = [ADMIN];
  readonly deviceTokens: DeviceTokenRow[] = [];
  readonly notifications: NotificationRow[] = [];
  readonly deliveries: DeliveryRow[] = [];
  readonly callTasks: CallTaskRow[] = [];

  // ── Amorces ───────────────────────────────────────────────────────────────

  addUser(row: Partial<UserRow> & { id: string }): UserRow {
    const user: UserRow = {
      fullName: row.fullName ?? `Compte ${row.id}`,
      role: row.role ?? Role.COMMERCIAL,
      isActive: row.isActive ?? true,
      deletedAt: row.deletedAt ?? null,
      departementId: row.departementId ?? null,
      id: row.id,
    };
    this.users.push(user);
    return user;
  }

  addDevice(row: Partial<DeviceTokenRow> & { userId: string; token: string }): DeviceTokenRow {
    const device: DeviceTokenRow = {
      id: row.id ?? nextId('dev'),
      userId: row.userId,
      token: row.token,
      platform: row.platform ?? DevicePlatform.ANDROID,
      appVersion: row.appVersion ?? null,
      lastSeenAt: row.lastSeenAt ?? new Date(),
      revokedAt: row.revokedAt ?? null,
      pendingOps: row.pendingOps ?? 0,
      pendingSince: row.pendingSince ?? null,
    };
    this.deviceTokens.push(device);
    return device;
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

  // ── Délégués ──────────────────────────────────────────────────────────────

  get user() {
    return {
      findMany: (args: { where?: Record<string, unknown> }) =>
        Promise.resolve(
          this.users.filter((row) =>
            matches(row as unknown as Record<string, unknown>, args.where, this),
          ),
        ),
    };
  }

  get deviceToken() {
    return {
      findMany: (args: { where?: Record<string, unknown>; distinct?: string[] }) => {
        let rows = this.deviceTokens.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        if (args.distinct?.includes('userId')) {
          const seen = new Set<string>();
          rows = rows.filter((row) =>
            seen.has(row.userId) ? false : (seen.add(row.userId), true),
          );
        }
        return Promise.resolve(
          rows.map((row) => ({ ...row, user: this.users.find((user) => user.id === row.userId) })),
        );
      },

      findUnique: (args: { where: { token: string } }) =>
        Promise.resolve(this.deviceTokens.find((row) => row.token === args.where.token) ?? null),

      upsert: (args: {
        where: { token: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existing = this.deviceTokens.find((row) => row.token === args.where.token);
        if (existing) {
          Object.assign(existing, args.update);
          return Promise.resolve(existing);
        }
        const created: DeviceTokenRow = {
          id: nextId('dev'),
          userId: String(args.create.userId),
          token: args.where.token,
          platform: (args.create.platform as DevicePlatform | undefined) ?? DevicePlatform.ANDROID,
          appVersion: (args.create.appVersion as string | null | undefined) ?? null,
          lastSeenAt: (args.create.lastSeenAt as Date | undefined) ?? new Date(),
          revokedAt: null,
          pendingOps: (args.create.pendingOps as number | undefined) ?? 0,
          pendingSince: (args.create.pendingSince as Date | null | undefined) ?? null,
        };
        this.deviceTokens.push(created);
        return Promise.resolve(created);
      },

      updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = this.deviceTokens.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        for (const row of rows) Object.assign(row, args.data);
        return Promise.resolve({ count: rows.length });
      },
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
          payload: data.payload ?? null,
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
          createdAt: new Date(),
        };

        const nested = data.deliveries as
          | { createMany?: { data: Record<string, unknown>[] }; create?: Record<string, unknown>[] }
          | undefined;
        const seeds = nested?.createMany?.data ?? nested?.create ?? [];

        // Les livraisons sont préparées AVANT d'être publiées : une contrainte
        // violée sur l'une d'elles doit annuler la notification entière, comme
        // le ferait la transaction implicite d'une écriture imbriquée.
        const prepared: DeliveryRow[] = [];
        for (const seed of seeds) {
          const delivery: DeliveryRow = {
            id: nextId('dlv'),
            notificationId: row.id,
            userId: String(seed.userId),
            status:
              (seed.status as NotificationDeliveryStatus | undefined) ??
              NotificationDeliveryStatus.PENDING,
            deviceToken: null,
            error: null,
            sentAt: null,
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            reminderKey: (seed.reminderKey as string | null | undefined) ?? null,
            period: (seed.period as string | null | undefined) ?? null,
            createdAt: new Date(),
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
        Object.assign(row, args.data);
        return Promise.resolve(this.decorate(row));
      },

      updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = this.notifications.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        for (const row of rows) Object.assign(row, args.data);
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

  get callTask() {
    return {
      groupBy: (args: { where?: Record<string, unknown> }) => {
        const rows = this.callTasks.filter((row) =>
          matches(row as unknown as Record<string, unknown>, args.where, this),
        );
        const buckets = new Map<string, number>();
        for (const row of rows)
          buckets.set(row.assignedToId, (buckets.get(row.assignedToId) ?? 0) + 1);
        return Promise.resolve(
          [...buckets.entries()].map(([assignedToId, count]) => ({
            assignedToId,
            _count: { _all: count },
          })),
        );
      },
    };
  }

  get notificationTemplate() {
    const rows: Record<string, unknown>[] = [];
    return {
      findMany: () => Promise.resolve(rows),
      findUnique: () => Promise.resolve(null),
    };
  }

  /** Ajoute la relation `createdBy` attendue par la projection du service. */
  private decorate(row: NotificationRow | undefined): unknown {
    if (!row) return null;
    const createdBy = this.users.find((user) => user.id === row.createdById);
    return { ...row, createdBy: createdBy ? { fullName: createdBy.fullName } : null };
  }

  /** Le service attend un `PrismaService` ; il n'utilise que les délégués ci-dessus. */
  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transports de test
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transport enregistreur. `outcomeFor` décide, jeton par jeton, du sort de
 * chaque message — c'est ce qui permet de composer un lot où UN seul jeton
 * échoue et de vérifier que les autres passent quand même.
 */
export class FakeTransport implements FcmTransport {
  readonly batches: FcmMessage[][] = [];
  configured = true;

  constructor(
    private readonly outcomeFor: (message: FcmMessage) => FcmSendOutcome = (message) => ({
      token: message.token,
      ok: true,
    }),
  ) {}

  isConfigured(): boolean {
    return this.configured;
  }

  unavailableReason(): string | null {
    return this.configured ? null : 'Transport de test désactivé.';
  }

  send(messages: readonly FcmMessage[]): Promise<FcmDispatchResult> {
    if (!this.configured) {
      return Promise.resolve({
        status: 'NOT_CONFIGURED',
        outcomes: [],
        detail: 'Transport de test désactivé.',
      });
    }
    this.batches.push([...messages]);
    return Promise.resolve({
      status: 'SENT',
      outcomes: messages.map((message) => this.outcomeFor(message)),
    });
  }

  /** Tous les messages envoyés, tous lots confondus. */
  get allMessages(): FcmMessage[] {
    return this.batches.flat();
  }
}

/** Transport dont l'authentification échoue. Aucun jeton ne doit être élagué. */
export class BrokenTransport implements FcmTransport {
  isConfigured(): boolean {
    return true;
  }

  unavailableReason(): string | null {
    return null;
  }

  send(): Promise<FcmDispatchResult> {
    return Promise.resolve({
      status: 'TRANSPORT_ERROR',
      outcomes: [],
      detail: 'token endpoint HTTP 401',
    });
  }
}
