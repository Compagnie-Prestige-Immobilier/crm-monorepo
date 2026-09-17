import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { csvRows } from '@/lib/csv';
import type { Projet } from '@/lib/types';

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

export type SupervisedUser = Schemas['CompteSupervise'];
export type PresenceState = SupervisedUser['presence'];
export type PerformanceScore = Schemas['NoteDeRendement'];
export type SupervisionScore = Schemas['RendementDunTeleconseiller'];
export type Supervision = Schemas['SupervisionOutputBody'];
export type WorkShifts = Schemas['CreneauxDeTravail'];
export type UpdateWorkShifts = Schemas['MajCreneauxInputBody'];

export async function fetchSupervision(client: ApiClient = getApiClient()): Promise<Supervision> {
  return unwrap(await client.GET('/api/v1/admin/supervision'));
}

export async function fetchWorkShifts(client: ApiClient = getApiClient()): Promise<WorkShifts> {
  return unwrap(await client.GET('/api/v1/supervision/creneaux'));
}

export async function updateWorkShifts(
  body: UpdateWorkShifts,
  client: ApiClient = getApiClient(),
): Promise<WorkShifts> {
  return unwrap(await client.PUT('/api/v1/supervision/creneaux', { body }));
}

const PRESENCE_STATES = ['ONLINE', 'RECENT', 'AWAY'] as const satisfies readonly PresenceState[];

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

export function formatClock(iso: string | null): string {
  if (iso === null) return 'Sans objet';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'Sans objet';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}

/** Un retard négatif ne vient pas du réseau : l'horloge du téléphone avance. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'Sans objet';
  if (seconds < 0) return 'Horloge en avance';
  if (seconds < 60) return `${String(seconds)} s`;
  return `${String(Math.round(seconds / 60))} min`;
}

export function formatActiveDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0
    ? `${String(minutes)} min`
    : `${String(hours)} h ${String(rest).padStart(2, '0')}`;
}

export type SupervisionGranularity = Exclude<
  NonNullable<operations['getSupervisionActivite']['parameters']['query']>['granularity'],
  undefined
>;
export type ActivityRow = Schemas['LigneDActivite'];
export type SupervisionActivity = Schemas['ActiviteDesTeleconseillers'];

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

function shiftDays(isoDate: string, days: number): string {
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
  projet: Projet | null,
  shift?: { start: string; end: string },
): readonly unknown[] {
  return ['supervision', 'activite', range.from, range.to, granularity, projet, shift];
}

/** `projet` est obligatoire : omis, l'API compte les deux projets dans les mêmes chiffres. */
export async function fetchSupervisionActivite(
  input: {
    range: ActivityRange;
    granularity: SupervisionGranularity;
    projet: Projet | null;
    shift?: { start: string; end: string };
  },
  client: ApiClient = getApiClient(),
): Promise<SupervisionActivity> {
  return unwrap(
    await client.GET('/api/v1/supervision/activite', {
      params: {
        query: {
          actFrom: `${input.range.from}T00:00:00.000Z`,
          actTo: `${input.range.to}T23:59:59.999Z`,
          granularity: input.granularity,
          ...(input.projet === null ? {} : { projet: input.projet }),
          ...(input.shift === undefined
            ? {}
            : { timeFrom: input.shift.start, timeTo: input.shift.end }),
        },
      },
    }),
  );
}

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
  'refused',
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
export type ActivityTotals = ActivityCounts & { people: number };
export type BucketTotals = ActivityCounts & { bucket: string };

export interface ActivityColumn {
  key: ActivityKey;
  label: string;
  taux?: boolean;
  /** Une durée en secondes, affichée en minutes et secondes. */
  duree?: boolean;
}

/**
 * Deux familles d'appels, jamais dans le même tableau : le plateau CHUES appelle
 * des représentants et, en conversion, des prospects ; le Grand Public n'appelle
 * que des prospects.
 */
export type ActivityFamille = 'representants' | 'prospects';

export const FAMILLE_LABELS: Record<ActivityFamille, string> = {
  representants: 'Appels représentants',
  prospects: 'Appels prospects',
};

export const ACTIVITY_COLUMNS: Record<ActivityFamille, ActivityColumn[]> = {
  representants: [
    { key: 'repCalls', label: 'Appels' },
    { key: 'repConfirmedCalls', label: 'Confirmés' },
    { key: 'repDetectedCalls', label: 'Détectés' },
    { key: 'repUnloggedCalls', label: 'Non consignés' },
    { key: 'repConfirmRate', label: 'Confirmation', taux: true },
    { key: 'repAvgCallSeconds', label: 'Durée moy.', duree: true },
    // « Joints » est la famille : les acceptés en sont un détail, pas un voisin.
    { key: 'repReached', label: 'Joints' },
    { key: 'repFichesAcceptees', label: 'Acceptés' },
    { key: 'repFichesARappeler', label: 'À rappeler' },
    { key: 'repUnreachable', label: 'Injoignables' },
    { key: 'repCallbacksHonored', label: 'Rappels tenus' },
    { key: 'repCallbacksLate', label: 'Rappels en retard' },
    { key: 'repCallbacksUpcoming', label: 'Rappels à venir' },
    { key: 'repReachabilityRate', label: 'Joignabilité', taux: true },
    { key: 'repAcceptanceRate', label: 'Acceptation', taux: true },
    { key: 'representantsContacted', label: 'Représentants contactés' },
    { key: 'prospectsCreated', label: 'Prospects saisis' },
  ],
  prospects: [
    { key: 'calls', label: 'Appels' },
    { key: 'confirmedCalls', label: 'Confirmés' },
    { key: 'detectedCalls', label: 'Détectés' },
    { key: 'unloggedCalls', label: 'Non consignés' },
    { key: 'confirmRate', label: 'Confirmation', taux: true },
    { key: 'avgCallSeconds', label: 'Durée moy.', duree: true },
    { key: 'methodObtained', label: 'Méthodes' },
    { key: 'unreachable', label: 'Injoignables' },
    { key: 'wrongNumber', label: 'Faux numéros' },
    { key: 'refused', label: 'Refus' },
    { key: 'callback', label: 'À rappeler' },
    { key: 'callbacksHonored', label: 'Rappels tenus' },
    { key: 'callbacksLate', label: 'Rappels en retard' },
    { key: 'callbacksUpcoming', label: 'Rappels à venir' },
    { key: 'ficheReachRate', label: 'Joignabilité', taux: true },
    { key: 'prospectsCreated', label: 'Prospects saisis' },
  ],
};

export function famillesDuProjet(projet: Projet | null): ActivityFamille[] {
  return projet === 'GRAND_PUBLIC' ? ['prospects'] : ['representants', 'prospects'];
}

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

export function activityTotals(lines: readonly ActivityLine[]): ActivityTotals {
  const totals: ActivityTotals = { ...compteursVides(), people: lines.length };
  for (const line of lines) {
    for (const key of COUNT_KEYS) totals[key] += line[key];
    totals.callSeconds += line.callSeconds;
    totals.repCallSeconds += line.repCallSeconds;
  }
  return calculerTaux(totals);
}

export function activityAverages(totals: ActivityTotals): ActivityCounts {
  const divisor = totals.people === 0 ? 1 : totals.people;
  const averages = { ...totals };
  for (const key of COUNT_KEYS) averages[key] = Math.round((totals[key] / divisor) * 10) / 10;
  return averages;
}

export function bucketTotals(rows: readonly ActivityRow[]): BucketTotals[] {
  const buckets = new Map<string, BucketTotals>();
  for (const row of rows) {
    const bucket = buckets.get(row.bucket) ?? { ...compteursVides(), bucket: row.bucket };
    cumuler(bucket, row);
    buckets.set(bucket.bucket, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).map(calculerTaux);
}

export type ActivitySortKey = 'name' | ActivityKey;
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

const PROJET_LABELS: Record<Projet | 'TOUS', string> = {
  CHUES: 'CHUES',
  GRAND_PUBLIC: 'Grand Public',
  TOUS: 'tous les projets',
};

export function activityCsv(input: {
  lines: readonly ActivityLine[];
  totals: ActivityTotals;
  range: ActivityRange;
  granularity: SupervisionGranularity;
  projet: Projet | null;
  famille: ActivityFamille;
}): string {
  const colonnes = ACTIVITY_COLUMNS[input.famille];
  const ligne = (nom: string, valeurs: ActivityCounts): (string | number | null)[] => [
    nom,
    ...colonnes.map((colonne) => valeurs[colonne.key]),
  ];

  const rows: (string | number | null)[][] = [
    [
      `Activité des téléconseillers ${PROJET_LABELS[input.projet ?? 'TOUS']} du ${input.range.from} au ${input.range.to}`,
      FAMILLE_LABELS[input.famille],
      input.granularity === 'week' ? 'Par semaine' : 'Par jour',
    ],
    [],
    [
      'Téléconseiller',
      ...colonnes.map((colonne) =>
        colonne.taux === true ? `${colonne.label} (%)` : colonne.label,
      ),
    ],
  ];

  for (const line of input.lines) {
    rows.push(ligne(line.isActive ? line.name : `${line.name} (désactivé)`, line));
  }

  rows.push(ligne('Total équipe', input.totals));
  rows.push(ligne('Moyenne par téléconseiller', activityAverages(input.totals)));
  return csvRows(rows);
}

/** Le projet est dans le nom : les deux coques exportent la même période sur des chiffres différents. */
export function activityCsvFileName(
  range: ActivityRange,
  projet: Projet | null,
  famille: ActivityFamille,
): string {
  let suffixe = 'chues';
  if (projet === null) suffixe = 'tous';
  if (projet === 'GRAND_PUBLIC') suffixe = 'grand-public';
  const periode = range.from === range.to ? range.from : `${range.from}_${range.to}`;
  return `cpi-supervision-activite-${suffixe}-${famille}-${periode}.csv`;
}
