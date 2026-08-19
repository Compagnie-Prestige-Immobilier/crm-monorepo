import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import {
  fetchRepresentants,
  type RepresentantScriptPatch,
  type ScriptedRepresentant,
  type WhatsappStatus,
} from '@/lib/data/representants';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantRelation } from '@/lib/representant-filters';
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

export const callbackKeys = {
  root: ['callbacks'] as const,
  list: (scope: CallbackScope, assignedToId: string | null) =>
    ['callbacks', scope, assignedToId] as const,
  teleconseillers: ['callbacks', 'teleconseillers'] as const,
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
          // Une file d'appel ne porte QUE des fiches a appeler. Une fiche close
          // y ferait perdre un tour a l'operatrice: les touches d'issue y sont
          // inertes, et rien ne se consigne. Le bandeau lecture seule reste
          // utile pour une fiche ouverte par lien direct.
          phase2Status: 'PENDING',
          pageSize: CONSOLE_QUEUE_SIZE,
          sortBy: 'clientCreatedAt',
          sortOrder: 'asc',
        },
      },
    }),
  );
  return { items: page.items, total: page.meta.total };
}

/** Un téléconseiller ne reçoit que ses campagnes, et `progress` compte SES tâches. */
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

export type Callback = components['schemas']['CallbackDto'];
export type CallbackScope = components['schemas']['CallbackScope'];

export interface CallbackList {
  readonly items: Callback[];
  readonly serverTime: string;
}

/** L'heure promise croissante : le retard étant une heure dépassée, il vient en tête. */
export function sortCallbacks(items: readonly Callback[]): Callback[] {
  return [...items].sort((left, right) => {
    if (left.scheduledAt !== right.scheduledAt)
      return left.scheduledAt < right.scheduledAt ? -1 : 1;
    return left.id < right.id ? -1 : 1;
  });
}

export type CallbackSchedules = ReadonlyMap<string, string>;

const NO_SCHEDULES: CallbackSchedules = new Map();

export function schedulesOf(items: readonly Callback[]): CallbackSchedules {
  const byProspect = new Map<string, string>();
  for (const callback of sortCallbacks(items)) {
    if (!byProspect.has(callback.prospectId))
      byProspect.set(callback.prospectId, callback.scheduledAt);
  }
  return byProspect;
}

export async function fetchCallbacks(
  scope: CallbackScope,
  assignedToId: string | null = null,
  client: ApiClient = getApiClient(),
): Promise<CallbackList> {
  const list = unwrap(
    await client.GET('/api/v1/phase2/callbacks', {
      params: { query: { scope, ...(assignedToId === null ? {} : { assignedToId }) } },
    }),
  );
  return { items: sortCallbacks(list.items), serverTime: list.serverTime };
}

export async function cancelCallback(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<Callback> {
  return unwrap(
    await client.POST('/api/v1/phase2/callbacks/{id}/cancel', { params: { path: { id } } }),
  );
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Dakar est à UTC+0 toute l'année : les accesseurs UTC SONT l'horloge métier. */
function dakarAt(now: number, plusDays: number, hour: number): number {
  const day = new Date(now);
  day.setUTCDate(day.getUTCDate() + plusDays);
  day.setUTCHours(hour, 0, 0, 0);
  return day.getTime();
}

function daysToMonday(now: number): number {
  const weekday = new Date(now).getUTCDay();
  return weekday === 1 ? 7 : (8 - weekday) % 7;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function formatCallbackAt(iso: string, now: number): string {
  const at = new Date(iso);
  const clock = `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
  const days = Math.floor((at.getTime() - dakarAt(now, 0, 0)) / DAY_MS);

  if (days === 0) return `aujourd’hui à ${clock}`;
  if (days === 1) return `demain à ${clock}`;
  return `le ${pad(at.getUTCDate())}/${pad(at.getUTCMonth() + 1)} à ${clock}`;
}

export function formatDelay(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h`;
  return `${String(Math.floor(hours / 24))} j`;
}

export interface CallbackSlot {
  readonly key: string;
  readonly label: string;
  readonly at: string;
}

/**
 * Zéro saisie : l'échéance se prend au chiffre. Une proposition déjà passée, ou
 * qui tombe à la même heure qu'une précédente, ne s'affiche pas.
 */
export function callbackSlots(now: number): CallbackSlot[] {
  const proposals: readonly (readonly [string, number])[] = [
    ['Dans 1 h', now + HOUR_MS],
    ['Cet après-midi (15 h)', dakarAt(now, 0, 15)],
    ['Demain 9 h', dakarAt(now, 1, 9)],
    ['Demain 15 h', dakarAt(now, 1, 15)],
    ['Lundi 9 h', dakarAt(now, daysToMonday(now), 9)],
    ['Dans 3 jours', dakarAt(now, 3, 9)],
  ];

  const slots: CallbackSlot[] = [];
  for (const [label, at] of proposals) {
    if (at <= now) continue;
    if (slots.some((slot) => Date.parse(slot.at) === at)) continue;
    slots.push({ key: String(slots.length + 1), label, at: new Date(at).toISOString() });
  }
  return slots;
}

export type QueueBucket = 'due' | 'never' | 'callback' | 'unreachable' | 'other' | 'closed';

export const QUEUE_BUCKET_LABELS: Record<QueueBucket, string> = {
  due: 'Rappels dus',
  never: 'Jamais appelées',
  callback: 'À rappeler',
  unreachable: 'Injoignables',
  other: 'Déjà tentées',
  closed: 'Closes',
};

const BUCKET_RANK: Record<QueueBucket, number> = {
  due: 0,
  never: 1,
  callback: 2,
  unreachable: 3,
  other: 4,
  closed: 5,
};

/** Un rappel promis dans moins d'une heure se prépare déjà : il remonte avec les retards. */
export const DUE_SOON_MS = 3_600_000;

export function bucketOf(
  prospect: ProspectRow,
  schedules: CallbackSchedules = NO_SCHEDULES,
  now: number = Date.now(),
): QueueBucket {
  if (prospect.phase2Status !== 'PENDING') return 'closed';

  const scheduledAt = schedules.get(prospect.id);
  if (scheduledAt !== undefined && Date.parse(scheduledAt) <= now + DUE_SOON_MS) return 'due';

  if (prospect.lastAttemptAt === null) return 'never';
  if (prospect.lastOutcome === 'CALLBACK') return 'callback';
  if (prospect.lastOutcome === 'UNREACHABLE') return 'unreachable';
  return 'other';
}

/**
 * Une échéance à venir passe DERRIÈRE les fiches de son groupe : rappeler avant
 * l'heure promise, c'est rappeler trop tôt.
 */
function orderKey(
  prospect: ProspectRow,
  schedules: CallbackSchedules,
  now: number,
): { rank: number; when: string } {
  const bucket = bucketOf(prospect, schedules, now);
  const scheduledAt = schedules.get(prospect.id);
  const later = bucket !== 'due' && bucket !== 'closed' && scheduledAt !== undefined;

  if (bucket === 'due' || later) {
    return { rank: BUCKET_RANK[bucket] * 2 + (later ? 1 : 0), when: scheduledAt ?? '' };
  }
  return { rank: BUCKET_RANK[bucket] * 2, when: prospect.lastAttemptAt ?? '' };
}

export function sortQueue(
  prospects: readonly ProspectRow[],
  schedules: CallbackSchedules = NO_SCHEDULES,
  now: number = Date.now(),
): ProspectRow[] {
  return [...prospects].sort((left, right) => {
    const leftKey = orderKey(left, schedules, now);
    const rightKey = orderKey(right, schedules, now);

    if (leftKey.rank !== rightKey.rank) return leftKey.rank - rightKey.rank;
    if (leftKey.when !== rightKey.when) return leftKey.when < rightKey.when ? -1 : 1;

    return left.id < right.id ? -1 : 1;
  });
}

export interface ConsoleQueue {
  readonly items: ProspectRow[];
  readonly pendingCount: number;
  readonly counts: Record<QueueBucket, number>;
}

export function buildQueue(
  prospects: readonly ProspectRow[],
  schedules: CallbackSchedules = NO_SCHEDULES,
  now: number = Date.now(),
): ConsoleQueue {
  const items = sortQueue(prospects, schedules, now);
  const counts: Record<QueueBucket, number> = {
    due: 0,
    never: 0,
    callback: 0,
    unreachable: 0,
    other: 0,
    closed: 0,
  };
  for (const prospect of items) counts[bucketOf(prospect, schedules, now)] += 1;

  return { items, pendingCount: items.length - counts.closed, counts };
}

/** Fiches « À rappeler » saisies avant que l'échéance existe : elles n'en ont aucune. */
export function undatedCallbacks(
  prospects: readonly ProspectRow[],
  schedules: CallbackSchedules,
): number {
  return prospects.filter(
    (prospect) =>
      prospect.phase2Status === 'PENDING' &&
      prospect.lastOutcome === 'CALLBACK' &&
      !schedules.has(prospect.id),
  ).length;
}

export function nextAfter(items: readonly { id: string }[], id: string): string | null {
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

export function queueLabel(
  prospect: ProspectRow,
  now: number,
  schedules: CallbackSchedules = NO_SCHEDULES,
): string {
  const bucket = bucketOf(prospect, schedules, now);
  if (bucket === 'closed') return PHASE2_STATUS_LABELS[prospect.phase2Status].toLowerCase();

  const scheduledAt = schedules.get(prospect.id);
  if (scheduledAt !== undefined) {
    const at = Date.parse(scheduledAt);
    return at < now
      ? `rappel en retard de ${formatDelay(now - at)}`
      : `rappel ${formatCallbackAt(scheduledAt, now)}`;
  }

  if (bucket === 'never') return 'jamais appelé';

  const days = daysSince(prospect.lastAttemptAt, now);
  const age = days === null ? '' : ` · ${String(days)} j`;
  if (bucket === 'callback') return `rappel sans échéance${age}`;
  if (bucket === 'unreachable') return `injoignable${age}`;

  const outcome = prospect.lastOutcome;
  return `${outcome === null ? 'appelé' : CALL_OUTCOME_LABELS[outcome].toLowerCase()}${age}`;
}

export const COMMENT_MAX_LENGTH = 2_000;

export interface AttemptDraft {
  readonly outcome: CallOutcome;
  readonly method: EnrollmentMethod | null;
  readonly comment: string;
  readonly callbackAt?: string | null;
}

/** Miroir de `apps/api/src/modules/phase2/attempt-rules.ts` : un écart sort en 400 sec. */
export function validateAttempt(draft: AttemptDraft, now: number = Date.now()): string | null {
  const comment = draft.comment.trim();
  const callbackAt = draft.callbackAt ?? null;

  if (draft.outcome === 'METHOD_OBTAINED' && draft.method === null) {
    return 'Choisissez la méthode obtenue.';
  }
  if (draft.outcome !== 'METHOD_OBTAINED' && draft.method !== null) {
    return 'Une méthode ne s’enregistre que sur « Méthode obtenue ».';
  }
  if (callbackAt !== null && draft.outcome !== 'CALLBACK') {
    return 'Une échéance ne s’enregistre que sur « À rappeler ».';
  }
  if (callbackAt !== null && !(Date.parse(callbackAt) > now)) {
    return 'Choisissez une échéance à venir.';
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
  const callbackAt = input.draft.callbackAt ?? null;

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
          ...(callbackAt === null ? {} : { callbackAt }),
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

export const REP_QUEUE_SIZE = 200;

export const repScriptKeys = {
  root: ['console', 'representants'] as const,
  queue: ['console', 'representants', 'queue'] as const,
};

export interface RepScriptPage {
  readonly items: ScriptedRepresentant[];
  readonly total: number;
}

export async function fetchRepScriptQueue(
  client: ApiClient = getApiClient(),
): Promise<RepScriptPage> {
  const page = await fetchRepresentants(
    { ...EMPTY_REPRESENTANT_FILTERS, pageSize: REP_QUEUE_SIZE, sortDir: 'asc' },
    client,
  );
  return { items: page.items, total: page.total };
}

/** Une relation tranchée n'a plus rien à donner au script : elle passe en queue de file. */
const REP_RELATION_RANK: Record<RepresentantRelation, number> = {
  INCONNU: 0,
  CONTACTE: 1,
  AMBASSADEUR: 2,
  REFUS: 2,
};

export function repRelationSettled(representant: ScriptedRepresentant): boolean {
  return REP_RELATION_RANK[representant.relationStatus] === 2;
}

export function buildRepQueue(items: readonly ScriptedRepresentant[]): ScriptedRepresentant[] {
  return [...items].sort((left, right) => {
    const gap = REP_RELATION_RANK[left.relationStatus] - REP_RELATION_RANK[right.relationStatus];
    if (gap !== 0) return gap;
    if (left.clientCreatedAt !== right.clientCreatedAt) {
      return left.clientCreatedAt < right.clientCreatedAt ? -1 : 1;
    }
    return left.id < right.id ? -1 : 1;
  });
}

export type RepCallOutcome = components['schemas']['RepCallOutcome'];

type RepAttemptBody = components['schemas']['CreateRepCallAttemptDto'];

export type RepCallAttemptResult = components['schemas']['RepCallAttemptResultDto'];

/**
 * Une réponse, et une seule. Chaque champ voyage seul pour qu'un appel coupé
 * après « non » laisse quand même le refus en base.
 */
export interface RepAnswer {
  readonly outcome: RepCallOutcome;
  readonly relationStatus?: RepresentantRelation;
  readonly whatsappStatus?: WhatsappStatus;
  readonly whatsappE164?: string;
  readonly profession?: string;
  readonly suggestedName?: string;
  readonly suggestedPhone?: string;
  readonly suggestedNote?: string;
  readonly comment?: string;
}

export function buildRepAttempt(
  representantId: string,
  answer: RepAnswer,
  now: number = Date.now(),
): RepAttemptBody & RepresentantScriptPatch {
  return {
    ...answer,
    id: uuidV7(now),
    representantId,
    clientCreatedAt: new Date(now).toISOString(),
  };
}

export async function pushRepCallAttempt(
  body: RepAttemptBody & RepresentantScriptPatch,
  client: ApiClient = getApiClient(),
): Promise<RepCallAttemptResult> {
  return unwrap(await client.POST('/api/v1/rep-campaigns/attempts', { body }));
}
