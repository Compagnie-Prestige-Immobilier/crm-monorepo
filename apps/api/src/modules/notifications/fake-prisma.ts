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

/**
 * Doublure Prisma en mémoire, réservée aux tests de notification.
 *
 * Elle n'imite pas PostgreSQL. Elle reproduit exactement les trois
 * comportements dont dépend la logique du module, et rien d'autre :
 *
 *  1. les contraintes UNIQUE lèvent une `PrismaClientKnownRequestError` P2002 :
 *     c'est sur elle que repose TOUTE l'idempotence des rappels ;
 *  2. `updateMany` renvoie un compte, ce qui permet de vérifier la prise en
 *     charge atomique d'un envoi programmé par une seule instance ;
 *  3. `groupBy` agrège, parce que les compteurs de livraison en dépendent.
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
  /** Le schéma la rend obligatoire. La chaîne vide tient lieu d'« aucune
   *  adresse » : c'est le seul cas que la branche e-mail doit écarter. */
  email: string;
  isActive: boolean;
  deletedAt: Date | null;
  departementId: string | null;
  /** Présent parce que le schéma le porte : sans lui, `where: { isDemo: false }`
   *  ne correspondrait à aucune ligne et la doublure validerait un faux. */
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
  /**
   * Horodatage `@updatedAt`, rafraîchi par la doublure à CHAQUE écriture.
   *
   * Il ne décore pas la ligne : c'est lui qui date le BAIL posé par
   * `dispatchDue` sur une notification prise en charge. Une doublure qui le
   * laisserait figé ferait passer la reprise des expéditions abandonnées pour
   * correcte quel que soit le code, et le renouvellement du bail, qui interdit
   * à deux repreneurs de gagner ensemble, ne serait plus exercé du tout.
   */
  updatedAt: Date;
  /** Même raison que sur `UserRow` : le schéma le porte, la doublure aussi. */
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
  /** Même raison que sur `UserRow` : le schéma le porte, la doublure aussi. */
  isDemo: boolean;
}

export interface CallTaskRow {
  id: string;
  assignedToId: string;
  status: string;
  isActive: boolean;
  campaignStatus: string;
  /** Même raison que sur `UserRow` : le schéma le porte, la doublure aussi. */
  isDemo: boolean;
}

/** Dossier bancaire, réduit à ce que les rappels du pôle banque interrogent. */
export interface BankCaseRow {
  id: string;
  /** Type de l'étape COURANTE, dénormalisé : la doublure ne porte pas d'étapes. */
  stageType: BankStageType;
  createdAt: Date;
  /** Date de la dernière transition, ou `null` si le dossier n'a jamais bougé. */
  lastTransitionAt: Date | null;
  deletedAt: Date | null;
  /** Même raison que sur `UserRow` : le schéma le porte, la doublure aussi. */
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

/** Égalité, `null`, `{ in }`, `{ lte }`, `{ gt }`, et le `where` imbriqué `user`/`notification`. */
const matches = (
  row: Record<string, unknown>,
  where: Record<string, unknown> | undefined,
  db: FakePrisma,
): boolean => {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue;

    if (key === 'OR') {
      // Une seule branche suffit, et les autres clauses du même `where`
      // continuent de s'appliquer : c'est la sémantique de Prisma, et c'est
      // celle dont dépend la prise en charge d'une notification « ou bien
      // programmée, ou bien abandonnée en cours d'envoi ».
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
      // Seule la forme employée par le rappel « sans mouvement » est reconnue :
      // `none` sur une date. Une doublure qui accepterait n'importe quel filtre
      // relationnel donnerait une fausse assurance sur des requêtes jamais
      // écrites.
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
  /**
   * Horloge des écritures, remplaçable par un test.
   *
   * `dispatchDue` compare `updatedAt` à l'instant qu'ON LUI PASSE. Si la
   * doublure horodatait toujours sur l'horloge réelle, les deux dates
   * appartiendraient à deux échelles de temps sans rapport, et le bail
   * paraîtrait expiré ou frais au hasard de l'heure à laquelle la suite tourne.
   * Un test qui pilote le temps doit donc pouvoir piloter les deux bouts de la
   * comparaison.
   */
  clock: () => Date = () => new Date();

  /**
   * PANNES INJECTÉES, par délégué et par méthode.
   *
   * ═══ POURQUOI LA DOUBLURE DOIT SAVOIR TOMBER ═══
   *
   * Une doublure qui répond toujours n'exerce qu'une moitié du service : celle
   * où la base tient. L'autre moitié, le `catch` qui rattrape une lecture
   * interrompue, restait donc entièrement non couverte, et un défaut y a vécu
   * jusqu'à la quatrième relecture (voir `sendByEmail`) : un délai d'attente
   * du pool sur la lecture des comptes refermait l'envoi sur SENT sans qu'un
   * seul e-mail soit parti. Un transport qui lève ne le reproduisait pas, il
   * échoue APRÈS la lecture des comptes.
   *
   * La clé est `délégué.méthode`, la valeur l'erreur à rejeter.
   */
  readonly faults = new Map<string, Error>();

  /** Arme une panne sur un appel précis. Elle vaut pour tous les suivants. */
  breakOn(operation: 'user.findMany' | 'notificationDelivery.updateMany', error: Error): void {
    this.faults.set(operation, error);
  }

  /** Rend la panne armée, ou `null`. Les délégués s'en servent en première ligne. */
  private fault(operation: string): Promise<never> | null {
    const armed = this.faults.get(operation);
    return armed ? Promise.reject(armed) : null;
  }

  readonly users: UserRow[] = [ADMIN];
  readonly notifications: NotificationRow[] = [];
  readonly deliveries: DeliveryRow[] = [];
  readonly callTasks: CallTaskRow[] = [];
  /** Même forme que `callTasks` : les campagnes représentants ont leur propre table. */
  readonly repCallTasks: CallTaskRow[] = [];
  readonly bankCases: BankCaseRow[] = [];

  // ── Amorces ───────────────────────────────────────────────────────────────

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

  // ── Délégués ──────────────────────────────────────────────────────────────

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
          // Pas de valeur par défaut « fausse » cachée ici : la doublure
          // écrit CE QUE LE SERVICE LUI DONNE. Un `?? false` masquerait
          // l'omission même que les tests de propagation cherchent.
          isDemo: data.isDemo === true,
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

      // L'expédition résout par clé primaire, sans visibilité : elle sert la
      // notification qu'on lui a désignée.
      findUnique: (args: { where: { id: string } }) =>
        Promise.resolve(this.decorate(this.notifications.find((row) => row.id === args.where.id))),

      // Les LECTURES d'administration passent par `findFirst` : le service y
      // compose la visibilité de démonstration, ce que `findUnique` n'accepte
      // pas. La doublure suit, sans quoi elle rendrait la ligne masquée et le
      // test de cloisonnement ne pourrait pas échouer.
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

      // `@updatedAt` est posé par Prisma sur TOUTE écriture, même quand aucune
      // valeur ne change. C'est ce qui renouvelle le bail d'une notification
      // reprise, et donc ce qui empêche un second repreneur de gagner derrière
      // le premier. La doublure doit le reproduire, sinon la reprise
      // concurrente serait validée sans avoir été exercée.
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

  /** Regroupement par destinataire, commun aux deux tables de tâches. */
  private groupTasksBy(source: CallTaskRow[], where?: Record<string, unknown>) {
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
 * Transport e-mail enregistreur.
 *
 * `configured = false` par DÉFAUT, et c'est délibéré : le dépôt tourne sans
 * clé Brevo, et les tests qui ne parlent pas d'e-mail doivent exercer cet
 * état-là. Un test qui veut la seconde voie l'allume explicitement.
 */
export class FakeBrevoTransport implements BrevoTransport {
  readonly sent: BrevoMessage[] = [];
  configured = false;

  /**
   * `outcomeFor` décide, ADRESSE PAR ADRESSE, du sort de chaque destinataire.
   * C'est ce qui permet de composer un envoi où une seule adresse échoue, et de
   * vérifier que les autres passent quand même.
   */
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

    // ═══ LA MÊME RÈGLE D'ÉTAT QUE LE VRAI TRANSPORT ═══
    //
    // `BrevoHttpTransport` annonce `TRANSPORT_ERROR` dès que rien n'est passé
    // alors qu'un appel a été tenté (`attempted > 0 && delivered === 0`), quelle
    // que soit la NATURE des refus. La doublure rendait `SENT` sans condition :
    // le service ne voyait donc jamais l'état que produit le cas le plus
    // banal du produit, un public de moins de cent adresses refusé en bloc sur
    // une clé invalide. Le défaut correspondant a survécu à toute la suite.
    const delivered = outcomes.filter((outcome) => outcome.ok).length;
    const failed = outcomes.find((outcome) => !outcome.ok);

    return Promise.resolve({
      status: outcomes.length > 0 && delivered === 0 ? 'TRANSPORT_ERROR' : 'SENT',
      outcomes,
      ...(delivered === 0 && failed?.errorCode !== undefined ? { detail: failed.errorCode } : {}),
    });
  }

  /** Toutes les adresses servies, tous messages confondus. */
  get allAddresses(): string[] {
    return this.sent.flatMap((message) => message.recipients.map((recipient) => recipient.email));
  }
}

/**
 * Transport e-mail qui échoue EN BLOC. Il est CONFIGURÉ : c'est la panne du
 * service, pas son absence. Aucune ligne de livraison ne doit être enterrée
 * pour autant.
 */
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

/** Transport e-mail qui LÈVE. La branche e-mail doit l'absorber, pas le propager. */
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
