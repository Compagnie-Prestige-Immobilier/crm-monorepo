import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import { MAX_CHART_SERIES, groupTail } from '@/lib/data/series';
import type {
  BddSegment,
  EnrollmentMethod,
  NamedCount,
  Phase2Status,
  ProspectFilters,
} from '@/lib/types';

/**
 * Écran « Statistiques » : volet téléconseil.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce module NE RECALCULE PAS ce que l'API sait déjà.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les totaux, les répartitions et les parts viennent du serveur, qui les
 * calcule en SQL sur la population filtrée. Un panel qui referait ces sommes à
 * partir d'une page de résultats afficherait, tôt ou tard, un chiffre différent
 * de celui du tableau d'à côté : et c'est l'écart qu'un directeur remarque en
 * premier.
 *
 * Ne sont dérivés ici que les RAPPORTS entre deux chiffres déjà servis : ils
 * dépendent de la fenêtre affichée, pas de la donnée, et les faire calculer par
 * le serveur obligerait à lui repasser les mêmes bornes une seconde fois. Ces
 * dérivations sont des fonctions pures, testées à part.
 */

export interface StatusCount {
  status: Phase2Status;
  label: string;
  prospects: number;
  share: number;
}

export interface MethodCount {
  method: EnrollmentMethod;
  label: string;
  prospects: number;
  share: number;
}

export interface SegmentCount {
  segment: BddSegment;
  label: string;
  prospects: number;
  share: number;
  methodObtained: number;
}

export interface TeleconseilStats {
  totals: {
    prospects: number;
    representants: number;
    teleconseillersActifs: number;
    departementsCouverts: number;
    prospects7Jours: number;
    prospects30Jours: number;
    converti: number;
    contacte: number;
    nouveau: number;
    perdu: number;
  };
  overTime: { date: string; count: number; cumulative: number }[];
  topTeleconseillers: NamedCount[];
  parStatutPhase2: StatusCount[];
  parMethode: MethodCount[];
  parSegment: SegmentCount[];
  /** Prospects porteurs d'une méthode. Sous-population, pas le total filtré. */
  methodTotal: number;
}

// ─── Dérivations ─────────────────────────────────────────────────────────────

/**
 * Ratio en pourcentage, arrondi au dixième.
 *
 * Le dénominateur nul rend `0` et non `NaN` : un écran qui affiche « NaN % »
 * fait douter de TOUS les autres chiffres de la page, y compris les justes.
 */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Taux de conversion : prospects convertis rapportés au total filtré.
 *
 * Le dénominateur est bien le TOTAL, et non la somme des quatre statuts : les
 * deux coïncident aujourd'hui, mais un statut ajouté demain les ferait diverger
 * en silence, et le taux dépasserait discrètement 100 %.
 */
export function conversionRate(totals: { converti: number; prospects: number }): number {
  return percentOf(totals.converti, totals.prospects);
}

/** Part des prospects ayant livré une méthode d'enrôlement. */
export function methodRate(input: { methodTotal: number; prospects: number }): number {
  return percentOf(input.methodTotal, input.prospects);
}

/**
 * Moyenne de saisies par jour sur les 30 derniers jours.
 *
 * Une moyenne journalière et non un total : « 1 240 sur 30 jours » ne se
 * compare à rien, « 41 par jour » se compare au jour d'hier.
 */
export function dailyAverage(prospects30Jours: number): number {
  return Math.round((prospects30Jours / 30) * 10) / 10;
}

/**
 * Variation entre les 7 derniers jours et les 7 précédents, en pourcentage.
 *
 * Les 7 précédents s'obtiennent par différence : `30 jours` couvre les 7
 * derniers. C'est une approximation ASSUMÉE : la fenêtre de comparaison fait 23
 * jours ramenés à 7 : et c'est pourquoi l'écran ne l'affiche pas comme une
 * tendance mais comme un rythme. Rien ne justifierait un septième appel d'API
 * pour un chiffre indicatif.
 */
export function weeklyPace(input: { prospects7Jours: number; prospects30Jours: number }): number {
  const earlier = Math.max(0, input.prospects30Jours - input.prospects7Jours);
  const perWeekEarlier = (earlier / 23) * 7;
  if (perWeekEarlier <= 0) return 0;
  return Math.round(((input.prospects7Jours - perWeekEarlier) / perWeekEarlier) * 1000) / 10;
}

/**
 * Segment le plus productif, à la part de méthodes obtenues.
 *
 * `null` quand aucun segment ne porte de prospect : afficher « BDD1 » sur une
 * base vide laisserait croire à une donnée, alors qu'il n'y en a aucune.
 */
export function bestSegment(segments: readonly SegmentCount[]): SegmentCount | null {
  const populated = segments.filter((segment) => segment.prospects > 0);
  if (populated.length === 0) return null;
  return populated.reduce((best, segment) =>
    percentOf(segment.methodObtained, segment.prospects) >
    percentOf(best.methodObtained, best.prospects)
      ? segment
      : best,
  );
}

/** Série cumulée, calculée sur la fenêtre affichée. */
function toTimeSeries(
  buckets: readonly { bucket: string; prospects: number }[],
): { date: string; count: number; cumulative: number }[] {
  let cumulative = 0;
  return buckets.map((point) => {
    cumulative += point.prospects;
    return { date: point.bucket, count: point.prospects, cumulative };
  });
}

/**
 * Heures en jours, arrondi au dixième.
 *
 * `null` reste `null` : « aucun dossier clos » n'est pas « zéro jour ». Les
 * confondre ferait afficher un délai de traitement parfait sur une banque qui
 * n'a rien traité du tout.
 */
export function hoursToDays(hours: number | null): number | null {
  if (hours === null) return null;
  return Math.round((hours / 24) * 10) / 10;
}

/**
 * Au-delà de 5 séries on regroupe : docs/design.md §2.6.
 *
 * La fonction et son seuil vivent dans `lib/data/series.ts`, partagés avec le
 * tableau de bord. Ils étaient dupliqués mot pour mot entre les deux modules :
 * deux copies d'une règle de rendu divergent tôt ou tard, et deux écrans
 * afficheraient alors la même distribution autrement.
 */
export { MAX_CHART_SERIES as MAX_SERIES, groupTail };

// ─── Chargement ──────────────────────────────────────────────────────────────

export async function fetchTeleconseilStats(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<TeleconseilStats> {
  const query = toFilterQuery(filters);

  const [totals, overTime, top, phase2, methods, segments] = await Promise.all([
    client.GET('/api/v1/analytics/totals', { params: { query } }),
    client.GET('/api/v1/analytics/prospects-over-time', {
      params: { query: { ...query, granularity: 'day' } },
    }),
    client.GET('/api/v1/analytics/top-commercials', { params: { query } }),
    client.GET('/api/v1/analytics/by-phase2-status', { params: { query } }),
    client.GET('/api/v1/analytics/by-enrollment-method', { params: { query } }),
    client.GET('/api/v1/analytics/by-segment', { params: { query } }),
  ]);

  const kpis = unwrap(totals);
  const methodList = unwrap(methods);

  return {
    totals: {
      prospects: kpis.prospects,
      representants: kpis.representants,
      teleconseillersActifs: kpis.commerciauxActifs,
      departementsCouverts: kpis.departementsCouverts,
      prospects7Jours: kpis.prospects7Jours,
      prospects30Jours: kpis.prospects30Jours,
      converti: kpis.converti,
      contacte: kpis.contacte,
      nouveau: kpis.nouveau,
      perdu: kpis.perdu,
    },
    overTime: toTimeSeries(unwrap(overTime).buckets),
    topTeleconseillers: groupTail(
      unwrap(top).items.map((item) => ({
        id: item.id,
        label: item.label,
        value: item.prospects,
      })),
    ),
    parStatutPhase2: unwrap(phase2).items.map((item) => ({
      status: item.status,
      label: item.label,
      prospects: item.prospects,
      share: item.share,
    })),
    parMethode: methodList.items.map((item) => ({
      method: item.method,
      label: item.label,
      prospects: item.prospects,
      share: item.share,
    })),
    parSegment: unwrap(segments).items.map((item) => ({
      segment: item.segment,
      label: item.label,
      prospects: item.prospects,
      share: item.share,
      methodObtained: item.methodObtained,
    })),
    methodTotal: methodList.total,
  };
}
