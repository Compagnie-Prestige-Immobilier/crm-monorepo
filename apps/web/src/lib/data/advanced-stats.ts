import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import type { NamedCount, ProspectFilters } from '@/lib/types';

/**
 * Les statistiques ajoutées : pilotage de campagne, délais, vieillissement du
 * portefeuille, cohortes, productivité, qualité de base, rendement, provenance.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Rien n'est recalculé ici. Tout vient du SQL.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les huit routes prennent le MÊME `ProspectFilterDto` que la liste, l'export
 * et l'entonnoir : `toFilterQuery` les sert donc toutes sans traduction propre.
 * C'est ce qui garantit qu'un chiffre lu ici décrit exactement la population du
 * tableau, et c'est aussi ce que vérifie `filter-consistency.test.ts` côté API.
 *
 * Chaque tuile a sa PROPRE requête plutôt qu'un `Promise.all` unique : ces
 * calculs sont lourds (médianes, cohortes hebdomadaires, ancienneté par étape)
 * et n'ont pas la même fraîcheur utile. Les fondre en un appel ferait attendre
 * la tuile la plus rapide derrière la plus lente, à chaque changement de
 * filtre.
 */

type Schemas = components['schemas'];

export type CampaignPilotage = Schemas['CampaignPilotageDto'];
export type AnalyticsDelays = Schemas['AnalyticsDelaysDto'];
export type BankAging = Schemas['BankAgingDto'];
export type WeeklyCohortList = Schemas['WeeklyCohortListDto'];
export type RepresentantProductivityList = Schemas['RepresentantProductivityListDto'];
export type DataQuality = Schemas['DataQualityDto'];
export type DepartementYieldList = Schemas['DepartementYieldListDto'];
export type OriginBreakdown = Schemas['OriginBreakdownDto'];

export async function fetchCampaignPilotage(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<CampaignPilotage> {
  return unwrap(
    await client.GET('/api/v1/analytics/campaign-pilotage', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchAnalyticsDelays(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<AnalyticsDelays> {
  return unwrap(
    await client.GET('/api/v1/analytics/delays', { params: { query: toFilterQuery(filters) } }),
  );
}

export async function fetchBankAging(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<BankAging> {
  return unwrap(
    await client.GET('/api/v1/analytics/bank-aging', { params: { query: toFilterQuery(filters) } }),
  );
}

export async function fetchWeeklyCohorts(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<WeeklyCohortList> {
  return unwrap(
    await client.GET('/api/v1/analytics/weekly-cohorts', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchRepresentantProductivity(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<RepresentantProductivityList> {
  return unwrap(
    await client.GET('/api/v1/analytics/representant-productivity', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchDataQuality(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<DataQuality> {
  return unwrap(
    await client.GET('/api/v1/analytics/data-quality', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchDepartementYield(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<DepartementYieldList> {
  return unwrap(
    await client.GET('/api/v1/analytics/departement-yield', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchOriginBreakdown(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<OriginBreakdown> {
  return unwrap(
    await client.GET('/api/v1/analytics/origin-breakdown', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

// ─── Dérivations d'affichage ────────────────────────────────────────────────

/**
 * Tâches clôturées par JOUR, tous commerciaux confondus.
 *
 * L'API rend une ligne par (jour, commercial) : c'est la bonne granularité pour
 * répondre à « qui avance », mais le graphique de cadence répond à « est-ce que
 * ça avance ». Le repli est fait ici parce qu'il dépend du graphique affiché,
 * pas de la donnée : servir les deux formes obligerait l'API à connaître la
 * mise en page.
 */
export function closedPerDayTotals(
  rows: readonly { day: string; done: number }[],
): { day: string; done: number }[] {
  const byDay = new Map<string, number>();
  for (const row of rows) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.done);
  return [...byDay.entries()]
    .map(([day, done]) => ({ day, done }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Les commerciaux les plus actifs sur la campagne, du plus au moins avancé.
 *
 * Le classement est calculé sur les tâches CLÔTURÉES et non sur les tentatives :
 * passer trente appels sans issue n'est pas de l'avancement, et un classement
 * qui le compterait récompenserait exactement le mauvais geste.
 */
export function closedPerCommercial(
  rows: readonly { commercialId: string; commercialName: string; done: number }[],
): NamedCount[] {
  const byCommercial = new Map<string, { label: string; value: number }>();
  for (const row of rows) {
    const current = byCommercial.get(row.commercialId);
    byCommercial.set(row.commercialId, {
      label: row.commercialName,
      value: (current?.value ?? 0) + row.done,
    });
  }
  return [...byCommercial.entries()]
    .map(([id, entry]) => ({ id, label: entry.label, value: entry.value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Durée en jours, prête à afficher.
 *
 * `null` reste `null` et ne devient JAMAIS `0` : « aucun couple d'horodatages
 * exploitable » n'est pas « instantané ». Les confondre afficherait un délai
 * parfait sur une chaîne qui n'a rien traité du tout.
 */
export function formatDelayDays(days: number | null): string {
  if (days === null) return 'Aucune mesure';
  if (days < 1) return 'Moins d’un jour';
  return `${String(Math.round(days * 10) / 10)} j`;
}

/**
 * Reste-t-il de quoi projeter une date de fin ?
 *
 * L'API rend `null` quand la cadence observée est nulle, et c'est le bon
 * comportement : une campagne à l'arrêt n'a pas de date de fin, et en annoncer
 * une serait une division par zéro déguisée en prévision. L'écran doit le dire
 * avec des mots, pas afficher un tiret.
 */
export function estimatedEndLabel(estimatedEndDate: string | null, remaining: number): string {
  if (remaining <= 0) return 'Tout est traité';
  if (estimatedEndDate === null) return 'Aucune cadence observée';
  return estimatedEndDate;
}
