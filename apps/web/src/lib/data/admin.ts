import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { Role } from '@/lib/types';

type Schemas = components['schemas'];

export type PurgeDomainKey = Schemas['PurgeDomainKey'];
export type PurgeDomain = Schemas['PurgeDomainDto'];
export type PurgeCatalog = Schemas['PurgeCatalogDto'];
export type PurgeResult = Schemas['PurgeResultDto'];

export async function fetchPurgeCatalog(client: ApiClient = getApiClient()): Promise<PurgeCatalog> {
  return unwrap(await client.GET('/api/v1/admin/purge'));
}

export async function runPurge(
  input: Schemas['PurgeRequestDto'],
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

export function matchesHint(typed: string, hint: string): boolean {
  const normalized = typed.trim().toLocaleLowerCase();
  if (normalized === '') return false;
  return normalized === hint.trim().toLocaleLowerCase();
}

export type PresenceState = Schemas['PresenceState'];
export type SupervisedUser = Schemas['SupervisedUserDto'];
export type Supervision = Schemas['SupervisionDto'];

export async function fetchSupervision(client: ApiClient = getApiClient()): Promise<Supervision> {
  return unwrap(await client.GET('/api/v1/admin/supervision'));
}

const PRESENCE_STATES = ['ONLINE', 'RECENT', 'AWAY'] as const satisfies readonly PresenceState[];

const ROLES = [
  'ADMIN',
  'COMMERCIAL',
  'BANQUE_FINANCE',
  'SUPERVISEUR',
] as const satisfies readonly Role[];

export function knownRole(value: string): Role {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : 'COMMERCIAL';
}

export function knownPresence(value: string): PresenceState {
  return (PRESENCE_STATES as readonly string[]).includes(value) ? (value as PresenceState) : 'AWAY';
}

export const PRESENCE_LABELS: Record<PresenceState, string> = {
  ONLINE: 'Connecté',
  RECENT: 'Récent',
  AWAY: 'Inactif',
};

export function minutesSince(iso: string | null, observedAt: string): number | null {
  if (iso === null) return null;
  const seen = Date.parse(iso);
  const now = Date.parse(observedAt);
  if (Number.isNaN(seen) || Number.isNaN(now)) return null;
  return Math.max(0, Math.round((now - seen) / 60_000));
}

export function formatElapsed(minutes: number | null): string {
  if (minutes === null) return 'Jamais';
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h`;
  const days = Math.floor(hours / 24);
  return `${String(days)} j`;
}

export type SupervisionGranularity = Schemas['SupervisionGranularity'];
export type ActivityRow = Schemas['SupervisionActivityRowDto'];
export type ActivityTeleconseiller = Schemas['SupervisionTeleconseillerDto'];
export type SupervisionActivity = Schemas['SupervisionActivityDto'];

/** Bornes en AAAA-MM-JJ, incluses, journée d'Africa/Dakar. */
export type ActivityRange = { from: string; to: string };

export type PeriodPreset = 'today' | 'week' | 'last7' | 'custom';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  last7: '7 derniers jours',
  custom: 'Période libre',
};

// Africa/Dakar est à UTC+0 toute l'année: la date UTC EST la date de Dakar.
export function dakarToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function shiftDays(isoDate: string, days: number): string {
  const at = new Date(`${isoDate}T00:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

export function presetRange(
  preset: Exclude<PeriodPreset, 'custom'>,
  today: string = dakarToday(),
): ActivityRange {
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'last7') return { from: shiftDays(today, -6), to: today };
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  return { from: shiftDays(today, -((weekday + 6) % 7)), to: today };
}

export function supervisionActivityKey(
  range: ActivityRange,
  granularity: SupervisionGranularity,
): readonly unknown[] {
  return ['supervision', 'activite', range.from, range.to, granularity];
}

export async function fetchSupervisionActivite(
  input: { range: ActivityRange; granularity: SupervisionGranularity },
  client: ApiClient = getApiClient(),
): Promise<SupervisionActivity> {
  return unwrap(
    await client.GET('/api/v1/supervision/activite', {
      params: {
        query: {
          actFrom: `${input.range.from}T00:00:00.000Z`,
          actTo: `${input.range.to}T23:59:59.999Z`,
          granularity: input.granularity,
        },
      },
    }),
  );
}

export type ActivityLine = {
  id: string;
  name: string;
  isActive: boolean;
  openTasks: number;
  calls: number;
  methodObtained: number;
  unreachable: number;
  wrongNumber: number;
  refused: number;
  callback: number;
  reachRate: number | null;
  prospectsCreated: number;
  representantsContacted: number;
  tasksClosed: number;
  hasActivity: boolean;
};

export function reachRateOf(counts: {
  calls: number;
  unreachable: number;
  wrongNumber: number;
}): number | null {
  if (counts.calls === 0) return null;
  const reached = counts.calls - counts.unreachable - counts.wrongNumber;
  return Math.round((reached / counts.calls) * 1000) / 10;
}

/**
 * `items` n'a de ligne que là où il s'est passé quelque chose: le croisement
 * avec `teleconseillers` est ce qui fait apparaître les agents à zéro acte.
 */
export function activityLines(data: SupervisionActivity): ActivityLine[] {
  const lines = new Map<string, ActivityLine>();

  for (const person of data.teleconseillers) {
    lines.set(person.id, {
      id: person.id,
      name: person.fullName,
      isActive: person.isActive,
      openTasks: person.openTasks,
      calls: 0,
      methodObtained: 0,
      unreachable: 0,
      wrongNumber: 0,
      refused: 0,
      callback: 0,
      reachRate: null,
      prospectsCreated: 0,
      representantsContacted: 0,
      tasksClosed: 0,
      hasActivity: false,
    });
  }

  for (const row of data.items) {
    let line = lines.get(row.teleconseillerId);
    if (line === undefined) {
      line = {
        id: row.teleconseillerId,
        name: row.teleconseillerName,
        isActive: true,
        openTasks: 0,
        calls: 0,
        methodObtained: 0,
        unreachable: 0,
        wrongNumber: 0,
        refused: 0,
        callback: 0,
        reachRate: null,
        prospectsCreated: 0,
        representantsContacted: 0,
        tasksClosed: 0,
        hasActivity: false,
      };
      lines.set(line.id, line);
    }
    line.calls += row.calls;
    line.methodObtained += row.methodObtained;
    line.unreachable += row.unreachable;
    line.wrongNumber += row.wrongNumber;
    line.refused += row.refused;
    line.callback += row.callback;
    line.prospectsCreated += row.prospectsCreated;
    // Distinct DANS une période: le cumul recompte un représentant rappelé une autre période.
    line.representantsContacted += row.representantsContacted;
    line.tasksClosed += row.tasksClosed;
    line.hasActivity = true;
  }

  const result = [...lines.values()];
  for (const line of result) line.reachRate = reachRateOf(line);
  return result;
}

export type ActivityTotals = {
  people: number;
  calls: number;
  methodObtained: number;
  unreachable: number;
  wrongNumber: number;
  refused: number;
  callback: number;
  reachRate: number | null;
  prospectsCreated: number;
  representantsContacted: number;
  tasksClosed: number;
  openTasks: number;
};

export function activityTotals(lines: readonly ActivityLine[]): ActivityTotals {
  const totals: ActivityTotals = {
    people: lines.length,
    calls: 0,
    methodObtained: 0,
    unreachable: 0,
    wrongNumber: 0,
    refused: 0,
    callback: 0,
    reachRate: null,
    prospectsCreated: 0,
    representantsContacted: 0,
    tasksClosed: 0,
    openTasks: 0,
  };

  for (const line of lines) {
    totals.calls += line.calls;
    totals.methodObtained += line.methodObtained;
    totals.unreachable += line.unreachable;
    totals.wrongNumber += line.wrongNumber;
    totals.refused += line.refused;
    totals.callback += line.callback;
    totals.prospectsCreated += line.prospectsCreated;
    totals.representantsContacted += line.representantsContacted;
    totals.tasksClosed += line.tasksClosed;
    totals.openTasks += line.openTasks;
  }

  totals.reachRate = reachRateOf(totals);
  return totals;
}

export function activityAverages(totals: ActivityTotals): Omit<ActivityTotals, 'people'> {
  const divisor = totals.people === 0 ? 1 : totals.people;
  const mean = (value: number): number => Math.round((value / divisor) * 10) / 10;
  return {
    calls: mean(totals.calls),
    methodObtained: mean(totals.methodObtained),
    unreachable: mean(totals.unreachable),
    wrongNumber: mean(totals.wrongNumber),
    refused: mean(totals.refused),
    callback: mean(totals.callback),
    reachRate: totals.reachRate,
    prospectsCreated: mean(totals.prospectsCreated),
    representantsContacted: mean(totals.representantsContacted),
    tasksClosed: mean(totals.tasksClosed),
    openTasks: mean(totals.openTasks),
  };
}

export type BucketTotals = {
  bucket: string;
  calls: number;
  methodObtained: number;
  unreachable: number;
  wrongNumber: number;
  refused: number;
  callback: number;
  reachRate: number | null;
};

export function bucketTotals(rows: readonly ActivityRow[]): BucketTotals[] {
  const buckets = new Map<string, BucketTotals>();

  for (const row of rows) {
    const bucket = buckets.get(row.bucket) ?? {
      bucket: row.bucket,
      calls: 0,
      methodObtained: 0,
      unreachable: 0,
      wrongNumber: 0,
      refused: 0,
      callback: 0,
      reachRate: null,
    };
    bucket.calls += row.calls;
    bucket.methodObtained += row.methodObtained;
    bucket.unreachable += row.unreachable;
    bucket.wrongNumber += row.wrongNumber;
    bucket.refused += row.refused;
    bucket.callback += row.callback;
    buckets.set(bucket.bucket, bucket);
  }

  const result = [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  for (const bucket of result) bucket.reachRate = reachRateOf(bucket);
  return result;
}

export type ActivitySortKey = 'name' | Exclude<keyof ActivityTotals, 'people'>;
export type SortDirection = 'asc' | 'desc';

export function sortActivityLines(
  lines: readonly ActivityLine[],
  key: ActivitySortKey,
  direction: SortDirection,
): ActivityLine[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...lines].sort((a, b) => {
    if (key === 'name') return sign * a.name.localeCompare(b.name, 'fr');
    const left = a[key];
    const right = b[key];
    if (left === null || right === null) {
      if (left === right) return a.name.localeCompare(b.name, 'fr');
      return left === null ? 1 : -1;
    }
    if (left === right) return a.name.localeCompare(b.name, 'fr');
    return sign * (left - right);
  });
}

const CSV_HEADERS = [
  'Téléconseiller',
  'Appels',
  'Méthodes obtenues',
  'NRP / injoignables',
  'Faux numéros',
  'Refus',
  'À rappeler',
  'Taux de joignabilité (%)',
  'Prospects saisis',
  'Représentants contactés',
  'Tâches closes',
  'Reste à faire',
];

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value;
  return /[";\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

export function activityCsv(input: {
  lines: readonly ActivityLine[];
  totals: ActivityTotals;
  range: ActivityRange;
  granularity: SupervisionGranularity;
}): string {
  const rows: (string | number | null)[][] = [
    [
      `Activité des téléconseillers du ${input.range.from} au ${input.range.to}`,
      input.granularity === 'week' ? 'Par semaine' : 'Par jour',
    ],
    [],
    CSV_HEADERS,
  ];

  for (const line of input.lines) {
    rows.push([
      line.isActive ? line.name : `${line.name} (désactivé)`,
      line.calls,
      line.methodObtained,
      line.unreachable,
      line.wrongNumber,
      line.refused,
      line.callback,
      line.reachRate,
      line.prospectsCreated,
      line.representantsContacted,
      line.tasksClosed,
      line.openTasks,
    ]);
  }

  const totals = input.totals;
  const averages = activityAverages(totals);
  rows.push([
    'Total équipe',
    totals.calls,
    totals.methodObtained,
    totals.unreachable,
    totals.wrongNumber,
    totals.refused,
    totals.callback,
    totals.reachRate,
    totals.prospectsCreated,
    totals.representantsContacted,
    totals.tasksClosed,
    totals.openTasks,
  ]);
  rows.push([
    'Moyenne par téléconseiller',
    averages.calls,
    averages.methodObtained,
    averages.unreachable,
    averages.wrongNumber,
    averages.refused,
    averages.callback,
    averages.reachRate,
    averages.prospectsCreated,
    averages.representantsContacted,
    averages.tasksClosed,
    averages.openTasks,
  ]);
  rows.push([]);
  rows.push(['Reste à faire : tâches d’appel ouvertes à l’instant, hors période.']);

  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function activityCsvFileName(range: ActivityRange): string {
  return range.from === range.to
    ? `cpi-supervision-activite-${range.from}.csv`
    : `cpi-supervision-activite-${range.from}_${range.to}.csv`;
}
