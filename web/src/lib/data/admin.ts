import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type PurgeDomainKey = Schemas['DomainePurge']['key'];
export type PurgeDomain = Schemas['DomainePurge'];
export type PurgeCatalog = Schemas['CataloguePurgeOutputBody'];
export type PurgeResult = Schemas['PurgerOutputBody'];

export async function fetchPurgeCatalog(client: ApiClient = getApiClient()): Promise<PurgeCatalog> {
  return unwrap(await client.GET('/api/v1/admin/purge'));
}

export async function runPurge(
  input: Schemas['PurgerInputBody'],
  client: ApiClient = getApiClient(),
): Promise<PurgeResult> {
  return unwrap(await client.POST('/api/v1/admin/purge', { body: input }));
}

export function expandSelection(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): PurgeDomainKey[] {
  const byKey = new Map<string, PurgeDomain>(domains.map((domain) => [domain.key, domain]));
  const resolved = new Set<string>();
  const pending: string[] = [...selected];

  while (pending.length > 0) {
    const key = pending.pop();
    if (key === undefined || resolved.has(key)) continue;
    resolved.add(key);
    pending.push(...(byKey.get(key)?.requires ?? []));
  }

  return domains.map((domain) => domain.key).filter((key) => resolved.has(key));
}

export function impliedDomains(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): PurgeDomainKey[] {
  const chosen = new Set<string>(selected);
  return expandSelection(selected, domains).filter((key) => !chosen.has(key));
}

export function selectionRows(
  selected: readonly PurgeDomainKey[],
  domains: readonly PurgeDomain[],
): number {
  const expanded = new Set<string>(expandSelection(selected, domains));
  return domains
    .filter((domain) => expanded.has(domain.key))
    .reduce((sum, domain) => sum + domain.rows, 0);
}

export function canSubmitPurge(input: {
  catalog: PurgeCatalog;
  selected: readonly PurgeDomainKey[];
  confirmation: string;
  pending: boolean;
}): boolean {
  if (input.pending) return false;
  if (!input.catalog.allowed) return false;
  if (input.selected.length === 0) return false;
  return matchesHint(input.confirmation, input.catalog.confirmationHint);
}

function matchesHint(typed: string, hint: string): boolean {
  const normalized = typed.trim().toLocaleLowerCase();
  if (normalized === '') return false;
  return normalized === hint.trim().toLocaleLowerCase();
}

export type WorkShifts = Schemas['CreneauxDeTravail'];

export async function fetchWorkShifts(client: ApiClient = getApiClient()): Promise<WorkShifts> {
  return unwrap(await client.GET('/api/v1/supervision/creneaux'));
}

/** Un retard négatif ne vient pas du réseau : l'horloge du téléphone avance. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'Sans objet';
  if (seconds < 0) return 'Horloge en avance';
  if (seconds < 60) return `${String(seconds)} s`;
  return `${String(Math.round(seconds / 60))} min`;
}

export type ActivityRow = Schemas['LigneDActivite'];
export type SupervisionActivity = Schemas['ActiviteDesTeleconseillers'];

/** Bornes en AAAA-MM-JJ, incluses, journée d'Africa/Dakar. */
export type ActivityRange = { from: string; to: string };

const COUNT_KEYS = [
  'repCalls',
  'repConfirmedCalls',
  'repDetectedCalls',
  'repUnloggedCalls',
  'repReached',
  'repCallback',
  'repUnreachable',
  'repCallbacksHonored',
  'repCallbacksLate',
  'repCallbacksUpcoming',
  'repQuestioned',
  'repQualified',
  'repFiches',
  'repFichesJointes',
  'repFichesNonJointes',
  'repFichesAcceptees',
  'repFichesARappeler',
  'repFichesEligibles',
  'representantsContacted',
  'fiches',
  'fichesJointes',
  'calls',
  'confirmedCalls',
  'detectedCalls',
  'unloggedCalls',
  'methodObtained',
  'unreachable',
  'wrongNumber',
  'callback',
  'callbacksHonored',
  'callbacksLate',
  'callbacksUpcoming',
  'prospectsCreated',
] as const;

type ActivityCountKey = (typeof COUNT_KEYS)[number];
type ActivityRateKey =
  | 'repContactRate'
  | 'repQualificationRate'
  | 'repReachabilityRate'
  | 'repAcceptanceRate'
  | 'ficheReachRate'
  | 'reachRate'
  | 'confirmRate'
  | 'repConfirmRate'
  | 'avgCallSeconds'
  | 'repAvgCallSeconds';
export type ActivityKey = ActivityCountKey | ActivityRateKey;

/**
 * `callSeconds` ne vient pas de l'API : c'est le numérateur reconstitué de la
 * durée moyenne. Sans lui, agréger plusieurs lignes reviendrait à moyenner des
 * moyennes, ce qui donne le mauvais chiffre dès que les volumes diffèrent.
 */
export type ActivityCounts = Record<ActivityCountKey, number> &
  Record<ActivityRateKey, number | null> & { callSeconds: number; repCallSeconds: number };
export type ActivityLine = ActivityCounts & {
  id: string;
  name: string;
  isActive: boolean;
  hasActivity: boolean;
};

function rate(part: number, whole: number): number | null {
  if (whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function compteursVides(): ActivityCounts {
  const zeros = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0])) as Record<
    ActivityCountKey,
    number
  >;
  return {
    ...zeros,
    repContactRate: null,
    repQualificationRate: null,
    repReachabilityRate: null,
    repAcceptanceRate: null,
    ficheReachRate: null,
    reachRate: null,
    confirmRate: null,
    repConfirmRate: null,
    avgCallSeconds: null,
    repAvgCallSeconds: null,
    callSeconds: 0,
    repCallSeconds: 0,
  };
}

// Distincts DANS une période, `representantsContacted` et `repQuestioned`
// recomptent un représentant rappelé une autre période.
function cumuler(into: ActivityCounts, row: ActivityRow): void {
  for (const key of COUNT_KEYS) into[key] += row[key];
  into.callSeconds += (row.avgCallSeconds ?? 0) * row.confirmedCalls;
  into.repCallSeconds += (row.repAvgCallSeconds ?? 0) * row.repConfirmedCalls;
}

function moyenne(total: number, nombre: number): number | null {
  if (nombre === 0) return null;
  return Math.round(total / nombre);
}

function calculerTaux<T extends ActivityCounts>(counts: T): T {
  counts.reachRate = rate(counts.calls - counts.unreachable, counts.calls);
  counts.repContactRate = rate(counts.repReached, counts.repCalls);
  counts.repQualificationRate = rate(counts.repQualified, counts.repQuestioned);
  counts.repReachabilityRate = rate(counts.repFichesJointes, counts.repFiches);
  counts.repAcceptanceRate = rate(counts.repFichesAcceptees, counts.repFichesEligibles);
  counts.ficheReachRate = rate(counts.fichesJointes, counts.fiches);
  counts.confirmRate = rate(counts.confirmedCalls, counts.calls);
  counts.repConfirmRate = rate(counts.repConfirmedCalls, counts.repCalls);
  counts.avgCallSeconds = moyenne(counts.callSeconds, counts.confirmedCalls);
  counts.repAvgCallSeconds = moyenne(counts.repCallSeconds, counts.repConfirmedCalls);
  return counts;
}

/**
 * `items` n'a de ligne que là où il s'est passé quelque chose: le croisement
 * avec `teleconseillers` est ce qui fait apparaître les agents à zéro acte.
 */
export function activityLines(data: SupervisionActivity): ActivityLine[] {
  const lines = new Map<string, ActivityLine>();
  const ligne = (id: string, name: string, isActive: boolean): ActivityLine => {
    const line = lines.get(id) ?? { ...compteursVides(), id, name, isActive, hasActivity: false };
    lines.set(id, line);
    return line;
  };

  for (const person of data.teleconseillers) ligne(person.id, person.fullName, person.isActive);
  for (const row of data.items) {
    const line = ligne(row.teleconseillerId, row.teleconseillerName, true);
    cumuler(line, row);
    line.hasActivity = true;
  }

  return [...lines.values()].map(calculerTaux);
}
