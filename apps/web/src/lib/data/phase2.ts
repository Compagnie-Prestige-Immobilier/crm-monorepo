import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type {
  CampaignDetail,
  CampaignScope,
  CampaignStatus,
  CampaignSummary,
  CreateCampaignInput,
  Paginated,
} from '@/lib/types';

/**
 * Phase 2 — campagnes d'appels. Réservé à l'ADMIN côté API.
 *
 * Tout passe par `unwrap()` : `openapi-fetch` ne lève jamais, et sans lui un
 * 403 se présenterait comme une réussite dont les données sont `undefined` —
 * l'écran afficherait « aucune campagne » à quelqu'un qui n'a simplement pas le
 * droit d'en voir.
 */

export interface CampaignFilters {
  status: CampaignStatus | null;
  page: number;
  pageSize: number;
}

export const DEFAULT_CAMPAIGN_FILTERS: CampaignFilters = {
  status: null,
  page: 1,
  pageSize: 25,
};

export async function fetchCampaigns(
  filters: CampaignFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<CampaignSummary>> {
  const query: { status?: CampaignStatus; page?: number; pageSize?: number } = {
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (filters.status !== null) query.status = filters.status;

  return flattenPage(unwrap(await client.GET('/api/v1/phase2/campaigns', { params: { query } })));
}

export async function fetchCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(await client.GET('/api/v1/phase2/campaigns/{id}', { params: { path: { id } } }));
}

export async function createCampaign(
  input: CreateCampaignInput,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(await client.POST('/api/v1/phase2/campaigns', { body: input }));
}

/**
 * Clôture. Idempotente côté API — mais l'écran demande quand même confirmation :
 * la clôture ANNULE toutes les tâches encore ouvertes, et un commercial qui
 * avait vingt appels à passer les voit disparaître de son téléphone.
 */
export async function closeCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(
    await client.POST('/api/v1/phase2/campaigns/{id}/close', { params: { path: { id } } }),
  );
}

// ─── Aperçu du tirage ───────────────────────────────────────────────────────

/**
 * Ce que l'administrateur voit AVANT de confirmer une campagne.
 *
 * `pending` est un chiffre exact renvoyé par l'API : les prospects du périmètre
 * encore en attente de phase 2. `alreadyAssigned` est le nombre de tâches
 * encore ouvertes, toutes campagnes en cours confondues — ces prospects-là sont
 * exclus du tirage par `eligibleForCampaignWhere` côté API.
 *
 * `maximum` est donc une BORNE HAUTE, pas une promesse, et l'écran le dit avec
 * ce mot. Le point n'est pas d'être exact au prospect près : c'est qu'un
 * administrateur sur le point de distribuer huit cents fiches entre trois
 * personnes voie l'ordre de grandeur avant de cliquer, et non après.
 */
export interface CampaignPreview {
  scope: CampaignScope;
  /** Prospects du périmètre dont la phase 2 est encore en attente. */
  pending: number;
  /** Tâches encore ouvertes sur les campagnes en cours. */
  alreadyAssigned: number;
  /** Borne haute du tirage : `pending - alreadyAssigned`, jamais négative. */
  maximum: number;
  /** Nombre de commerciaux destinataires retenus. */
  commercialCount: number;
  /** Répartition en tourniquet : ce que chacun recevra, au plus. */
  perCommercial: number[];
}

/**
 * Répartition en tourniquet, reproduite à l'identique de
 * `distributeRoundRobin` côté API : les `total % buckets` premiers reçoivent
 * une fiche de plus. Recalculée ici plutôt qu'approchée par une division, sinon
 * l'aperçu annoncerait « 266 chacun » là où le premier commercial en reçoit 267.
 */
export function roundRobinSplit(total: number, buckets: number): number[] {
  if (buckets <= 0 || total <= 0) return [];
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Assemble l'aperçu à partir des deux chiffres bruts. Pure : testée seule. */
export function buildCampaignPreview(input: {
  scope: CampaignScope;
  pending: number;
  alreadyAssigned: number;
  commercialCount: number;
}): CampaignPreview {
  const maximum = Math.max(0, input.pending - input.alreadyAssigned);
  return {
    scope: input.scope,
    pending: input.pending,
    alreadyAssigned: input.alreadyAssigned,
    maximum,
    commercialCount: input.commercialCount,
    perCommercial: roundRobinSplit(maximum, input.commercialCount),
  };
}

/**
 * Compte les prospects en attente sur un périmètre.
 *
 * `pageSize: 1` : on ne veut que `meta.total`. Demander une page complète
 * transporterait vingt-cinq fiches nominatives pour afficher un nombre.
 */
export async function countPendingProspects(
  scope: CampaignScope,
  client: ApiClient = getApiClient(),
): Promise<number> {
  // `exactOptionalPropertyTypes` : une clé `segment: undefined` n'est pas une
  // clé absente, et `openapi-fetch` la sérialiserait en `segment=undefined`.
  const query =
    scope === 'ALL'
      ? ({ phase2Status: 'PENDING', pageSize: 1 } as const)
      : ({ phase2Status: 'PENDING', pageSize: 1, segment: scope } as const);

  return unwrap(await client.GET('/api/v1/prospects', { params: { query } })).meta.total;
}

/** Tâches encore ouvertes, toutes campagnes ACTIVE confondues. */
export async function countOpenTasks(client: ApiClient = getApiClient()): Promise<number> {
  const page = unwrap(
    await client.GET('/api/v1/phase2/campaigns', {
      params: { query: { status: 'ACTIVE', pageSize: 100 } },
    }),
  );
  return page.items.reduce((sum, campaign) => sum + campaign.progress.open, 0);
}

export async function fetchCampaignPreview(
  scope: CampaignScope,
  commercialCount: number,
  client: ApiClient = getApiClient(),
): Promise<CampaignPreview> {
  const [pending, alreadyAssigned] = await Promise.all([
    countPendingProspects(scope, client),
    countOpenTasks(client),
  ]);
  return buildCampaignPreview({ scope, pending, alreadyAssigned, commercialCount });
}

/**
 * URL du programme PDF d'un commercial.
 *
 * Elle vise le relais `/api/v1/*` de Next et non l'API directement : le jeton
 * vit dans un cookie `httpOnly`, hors de portée de `fetch` côté client, et un
 * `<a href>` vers NestJS partirait anonyme.
 */
export function programmePdfUrl(campaignId: string, userId: string): string {
  return `/api/v1/phase2/campaigns/${encodeURIComponent(campaignId)}/commerciaux/${encodeURIComponent(userId)}/programme.pdf`;
}

export function programmePdfFileName(campaignName: string, commercialName: string): string {
  const slug = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/[^a-zA-Z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .toLowerCase()
      .slice(0, 40);
  return `programme-${slug(campaignName)}-${slug(commercialName)}.pdf`;
}
