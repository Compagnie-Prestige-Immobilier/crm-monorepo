import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import {
  CALL_OUTCOME_LABELS,
  PHASE2_STATUS_LABELS,
  type CallOutcome,
  type EnrollmentMethod,
  type FilterOption,
  type ProspectRow,
} from '@/lib/types';

/** `queryKeys` sert tout le panel ; la console garde ses clés chez elle. */
export const consoleKeys = {
  root: ['console'] as const,
  queue: (campaignId: string | null) => ['console', 'queue', campaignId] as const,
  campaigns: ['console', 'campaigns'] as const,
};

export const CONSOLE_QUEUE_SIZE = 200;

export interface ConsolePage {
  readonly items: ProspectRow[];
  readonly total: number;
}

export async function fetchConsoleQueue(
  campaignId: string | null,
  client: ApiClient = getApiClient(),
): Promise<ConsolePage> {
  const page = unwrap(
    await client.GET('/api/v1/prospects', {
      params: {
        query: {
          ...(campaignId === null ? {} : { campaignId }),
          pageSize: CONSOLE_QUEUE_SIZE,
          sortBy: 'clientCreatedAt',
          sortOrder: 'asc',
        },
      },
    }),
  );
  return { items: page.items, total: page.meta.total };
}

/** Réservée à l'ADMIN côté API : un téléconseiller reçoit 403 et travaille sans filtre. */
export async function fetchConsoleCampaigns(
  client: ApiClient = getApiClient(),
): Promise<FilterOption[]> {
  const page = unwrap(
    await client.GET('/api/v1/phase2/campaigns', {
      params: { query: { status: 'ACTIVE', pageSize: 100 } },
    }),
  );
  return page.items.map((campaign) => ({
    value: campaign.id,
    label: campaign.name,
    hint: `${String(campaign.progress.open)} ouvertes`,
  }));
}

export type QueueBucket = 'never' | 'callback' | 'unreachable' | 'other' | 'closed';

export const QUEUE_BUCKET_LABELS: Record<QueueBucket, string> = {
  never: 'Jamais appelées',
  callback: 'À rappeler',
  unreachable: 'Injoignables',
  other: 'Déjà tentées',
  closed: 'Closes',
};

const BUCKET_RANK: Record<QueueBucket, number> = {
  never: 0,
  callback: 1,
  unreachable: 2,
  other: 3,
  closed: 4,
};

export function bucketOf(prospect: ProspectRow): QueueBucket {
  if (prospect.phase2Status !== 'PENDING') return 'closed';
  if (prospect.lastAttemptAt === null) return 'never';
  if (prospect.lastOutcome === 'CALLBACK') return 'callback';
  if (prospect.lastOutcome === 'UNREACHABLE') return 'unreachable';
  return 'other';
}

export function sortQueue(prospects: readonly ProspectRow[]): ProspectRow[] {
  return [...prospects].sort((left, right) => {
    const byBucket = BUCKET_RANK[bucketOf(left)] - BUCKET_RANK[bucketOf(right)];
    if (byBucket !== 0) return byBucket;

    const leftAt = left.lastAttemptAt ?? '';
    const rightAt = right.lastAttemptAt ?? '';
    if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;

    return left.id < right.id ? -1 : 1;
  });
}

export interface ConsoleQueue {
  readonly items: ProspectRow[];
  readonly pendingCount: number;
  readonly counts: Record<QueueBucket, number>;
}

export function buildQueue(prospects: readonly ProspectRow[]): ConsoleQueue {
  const items = sortQueue(prospects);
  const counts: Record<QueueBucket, number> = {
    never: 0,
    callback: 0,
    unreachable: 0,
    other: 0,
    closed: 0,
  };
  for (const prospect of items) counts[bucketOf(prospect)] += 1;

  return { items, pendingCount: items.length - counts.closed, counts };
}

export function nextAfter(items: readonly ProspectRow[], id: string): string | null {
  const at = items.findIndex((prospect) => prospect.id === id);
  if (at === -1) return items[0]?.id ?? null;
  return items[at + 1]?.id ?? items[at - 1]?.id ?? null;
}

export function daysSince(iso: string | null, now: number): number | null {
  if (iso === null) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

export function queueLabel(prospect: ProspectRow, now: number): string {
  const bucket = bucketOf(prospect);
  if (bucket === 'closed') return PHASE2_STATUS_LABELS[prospect.phase2Status].toLowerCase();
  if (bucket === 'never') return 'jamais appelé';

  const days = daysSince(prospect.lastAttemptAt, now);
  const age = days === null ? '' : ` · ${String(days)} j`;
  if (bucket === 'callback') return `rappel${age}`;
  if (bucket === 'unreachable') return `injoignable${age}`;

  const outcome = prospect.lastOutcome;
  return `${outcome === null ? 'appelé' : CALL_OUTCOME_LABELS[outcome].toLowerCase()}${age}`;
}

export const COMMENT_MAX_LENGTH = 2_000;

export interface AttemptDraft {
  readonly outcome: CallOutcome;
  readonly method: EnrollmentMethod | null;
  readonly comment: string;
}

/** Miroir de `apps/api/src/modules/phase2/attempt-rules.ts` : un écart sort en 400 sec. */
export function validateAttempt(draft: AttemptDraft): string | null {
  const comment = draft.comment.trim();

  if (draft.outcome === 'METHOD_OBTAINED' && draft.method === null) {
    return 'Choisissez la méthode obtenue.';
  }
  if (draft.outcome !== 'METHOD_OBTAINED' && draft.method !== null) {
    return 'Une méthode ne s’enregistre que sur « Méthode obtenue ».';
  }
  if (draft.outcome === 'OTHER' && comment === '') {
    return 'L’issue « Autre » exige un commentaire.';
  }
  if (comment.length > COMMENT_MAX_LENGTH) {
    return `Le commentaire dépasse ${String(COMMENT_MAX_LENGTH)} caractères.`;
  }
  return null;
}

/**
 * UUID v7 : les 48 bits de tête portent l'horodatage, ce qui garde les clés
 * ordonnées en base. `crypto.randomUUID` produirait un v4, non ordonné.
 */
export function uuidV7(now: number = Date.now(), random: () => number = Math.random): string {
  const timestamp = Math.floor(now).toString(16).padStart(12, '0').slice(-12);
  const hex = (bits: number): string =>
    Math.floor(random() * 2 ** bits)
      .toString(16)
      .padStart(bits / 4, '0');
  const variant = (8 + Math.floor(random() * 4)).toString(16);

  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${hex(12)}-${variant}${hex(12)}-${hex(48)}`;
}

type SyncPushBody = components['schemas']['SyncPushDto'];

export interface AttemptInput {
  readonly prospectId: string;
  readonly draft: AttemptDraft;
  readonly attemptId: string;
  readonly batchId: string;
  readonly at: string;
}

export function buildAttemptBatch(input: AttemptInput): SyncPushBody {
  const comment = input.draft.comment.trim();

  return {
    clientBatchId: input.batchId,
    payloadVersion: 1,
    operations: [
      {
        opId: input.attemptId,
        seq: 0,
        entity: 'call_attempt',
        op: 'create',
        entityId: input.attemptId,
        clientUpdatedAt: input.at,
        data: {
          prospectId: input.prospectId,
          outcome: input.draft.outcome,
          ...(input.draft.method === null ? {} : { method: input.draft.method }),
          ...(comment === '' ? {} : { comment }),
          clientCreatedAt: input.at,
        },
      },
    ],
  };
}

export function newAttemptInput(
  prospectId: string,
  draft: AttemptDraft,
  now: number = Date.now(),
): AttemptInput {
  return {
    prospectId,
    draft,
    attemptId: uuidV7(now),
    batchId: uuidV7(now),
    at: new Date(now).toISOString(),
  };
}

export const ALREADY_COMPLETED = 'PHASE2_ALREADY_COMPLETED';

export class AttemptRefused extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AttemptRefused';
    this.code = code;
  }
}

/**
 * Aucune route HTTP ne consigne un appel de phase 2 : le lot de synchronisation
 * est le seul chemin d'écriture, et il répond 200 même quand l'opération est
 * refusée, le verdict étant dans le corps.
 */
export async function pushCallAttempt(
  input: AttemptInput,
  client: ApiClient = getApiClient(),
): Promise<void> {
  const response = unwrap(
    await client.POST('/api/v1/sync/push', {
      params: { header: { 'Idempotency-Key': input.batchId } },
      body: buildAttemptBatch(input),
    }),
  );

  const result = response.results[0];
  if (result === undefined) {
    throw new AttemptRefused('NO_RESULT', 'Le serveur n’a rien répondu sur cet appel. Réessayez.');
  }
  if (result.status === 'applied' || result.status === 'duplicate') return;

  throw new AttemptRefused(
    result.errorCode ?? 'CALL_ATTEMPT_INVALID',
    result.error ?? 'L’appel n’a pas été enregistré.',
  );
}
