import type { ApiClient, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { CampaignFilters } from '@/lib/campaign-filters';
import type {
  CampaignDetail,
  CampaignScope,
  CampaignSummary,
  CreateCampaignInput,
  Paginated,
} from '@/lib/types';

/**
 * Phase 2 : campagnes d'appels. Réservé à l'ADMIN côté API.
 *
 * Tout passe par `unwrap()` : `openapi-fetch` ne lève jamais, et sans lui un
 * 403 se présenterait comme une réussite dont les données sont `undefined` -
 * l'écran afficherait « aucune campagne » à quelqu'un qui n'a simplement pas le
 * droit d'en voir.
 */

type CampaignQuery = NonNullable<operations['listCallCampaigns']['parameters']['query']>;

/**
 * Bornes de journée explicitées, comme partout ailleurs : sans heure,
 * `dateTo=2026-08-12` serait lu comme minuit pile et exclurait toute la
 * journée du 12. L'heure métier est `Africa/Dakar`, soit UTC+0 toute l'année.
 */
const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

/**
 * Filtre de l'écran → paramètres de requête du contrat.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le type est celui du contrat, SANS intersection d'échappement.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cette fonction portait auparavant un `& Record<string, unknown>`, hérité de
 * l'époque où le client engendré ne connaissait pas encore ces critères. Le
 * contrat les porte maintenant, et l'intersection ne faisait plus qu'une chose :
 * ÉTEINDRE le vérificateur de types. Elle a laissé passer `createdBy` là où le
 * `CampaignQueryDto` déclare `createdById`, et comme l'API tourne en
 * `forbidNonWhitelisted: true`, sélectionner « Créée par » répondait 400 et
 * emportait la liste entière des campagnes.
 *
 * Le type nu est donc le garde-fou : une clé mal orthographiée casse le
 * `typecheck` au lieu de casser l'écran en production.
 *
 * Les critères ne sont écrits que s'ils sont RENSEIGNÉS :
 * `exactOptionalPropertyTypes` interdit une clé posée à `undefined`, que
 * `openapi-fetch` sérialiserait en `scope=undefined`.
 */
export function toCampaignQuery(filters: CampaignFilters): CampaignQuery {
  const query: CampaignQuery = {
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.status !== null) query.status = filters.status;
  if (filters.scope !== null) query.scope = filters.scope;
  if (filters.createdBy !== null) query.createdById = filters.createdBy;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);

  return query;
}

export async function fetchCampaigns(
  filters: CampaignFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<CampaignSummary>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/phase2/campaigns', { params: { query: toCampaignQuery(filters) } }),
    ),
  );
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
 * Clôture. Idempotente côté API : mais l'écran demande quand même confirmation :
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
 * encore ouvertes, toutes campagnes en cours confondues : ces prospects-là sont
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
  /** Journées d'étalement demandées, de 1 à 31. */
  spreadDays: number;
  /**
   * Lignes par journée POUR LE PREMIER commercial, jour 1 en tête.
   *
   * C'est le chiffre qui dit si la journée est tenable : « 267 appels » ne se
   * refuse pas, « 267 appels par jour pendant 7 jours » se discute. Le premier
   * commercial est retenu parce que le tourniquet lui donne la file la plus
   * longue : la borne haute d'une borne haute.
   */
  perDay: number[];
}

// ─── Étalement ───────────────────────────────────────────────────────────────

/** Bornes admises, reprises de `distribution.ts` et de la contrainte CHECK. */
export const MIN_SPREAD_DAYS = 1;
export const MAX_SPREAD_DAYS = 31;

/**
 * Découpage d'une file en journées, reproduit à l'identique de `dayIndexFor` /
 * `dayHistogram` côté API.
 *
 * Recalculé ici et non approché par une division : `10` lignes sur `3` jours
 * donne 4, 3, 3 côté serveur, et un aperçu qui annoncerait « 3 par jour »
 * mentirait sur le premier programme imprimé. Il n'existe pas d'endpoint
 * d'aperçu pour les campagnes prospects (l'API ne compte que l'existant, le
 * découpage est purement arithmétique) : c'est la seule duplication acceptable,
 * et elle est verrouillée par un test.
 */
export function spreadIntoDays(count: number, days: number): number[] {
  if (count <= 0) return [];
  const effective = Math.max(1, Math.min(days, count));
  const buckets = Array.from({ length: effective }, () => 0);
  for (let position = 1; position <= count; position += 1) {
    const index = Math.min(effective - 1, Math.floor(((position - 1) * effective) / count));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

/**
 * Répartition en tourniquet, reproduite à l'identique de
 * `distributeRoundRobin` côté API : les `total % buckets` premiers reçoivent
 * une fiche de plus. Recalculée ici plutôt qu'approchée par une division, sinon
 * l'aperçu annoncerait « 266 chacun » là où le premier téléconseiller en reçoit 267.
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
  spreadDays?: number;
}): CampaignPreview {
  const maximum = Math.max(0, input.pending - input.alreadyAssigned);
  const spreadDays = input.spreadDays ?? MIN_SPREAD_DAYS;
  const perCommercial = roundRobinSplit(maximum, input.commercialCount);
  return {
    scope: input.scope,
    pending: input.pending,
    alreadyAssigned: input.alreadyAssigned,
    maximum,
    commercialCount: input.commercialCount,
    perCommercial,
    spreadDays,
    perDay: spreadIntoDays(perCommercial[0] ?? 0, spreadDays),
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
  spreadDays: number,
  client: ApiClient = getApiClient(),
): Promise<CampaignPreview> {
  const [pending, alreadyAssigned] = await Promise.all([
    countPendingProspects(scope, client),
    countOpenTasks(client),
  ]);
  return buildCampaignPreview({ scope, pending, alreadyAssigned, commercialCount, spreadDays });
}

/**
 * URL du programme PDF d'un téléconseiller.
 *
 * Elle vise le relais `/api/v1/*` de Next et non l'API directement : le jeton
 * vit dans un cookie `httpOnly`, hors de portée de `fetch` côté client, et un
 * `<a href>` vers NestJS partirait anonyme.
 */
export function programmePdfUrl(campaignId: string, userId: string, day?: number): string {
  const base = `/api/v1/phase2/campaigns/${encodeURIComponent(campaignId)}/commerciaux/${encodeURIComponent(userId)}/programme.pdf`;
  // Sans `jour`, l'API rend TOUT le programme : c'est le comportement d'avant
  // l'\u00e9talement, et il reste le bon quand la campagne tient sur une journ\u00e9e.
  return day === undefined ? base : `${base}?jour=${String(day)}`;
}

export function slugForFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
    .slice(0, 40);
}

/**
 * Le jour figure dans le NOM du fichier, pas seulement dans le document.
 *
 * Un commercial re\u00e7oit sept liasses le m\u00eame matin : sept fichiers
 * `programme-\u2026-aminata-diallo.pdf` dans le m\u00eame dossier de t\u00e9l\u00e9chargements,
 * num\u00e9rot\u00e9s par le navigateur (\u00ab (1) \u00bb, \u00ab (2) \u00bb), ne se distinguent plus une
 * fois imprim\u00e9s et pos\u00e9s sur un bureau.
 */
export function programmePdfFileName(
  campaignName: string,
  commercialName: string,
  day?: number,
): string {
  const suffix = day === undefined ? '' : `-jour-${String(day)}`;
  return `programme-${slugForFileName(campaignName)}-${slugForFileName(commercialName)}${suffix}.pdf`;
}
