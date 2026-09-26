import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import {
  EMPTY_REPRESENTANT_FILTERS,
  type RepresentantFilters,
  type RepresentantRelation,
} from '@/lib/representant-filters';
import type {
  DeviceCallDetection,
  Paginated,
  RepresentantRow,
  UpdateRepresentantInput,
} from '@/lib/types';

export type { DeviceCallDetection };

type RepresentantQuery = NonNullable<operations['listRepresentants']['parameters']['query']>;

export type CreateRepresentantInput = components['schemas']['RepresentantCreateInputBody'];
export type RepresentantLookup = components['schemas']['RepresentantLookupOutputBody'];
export type RepresentantRelationChange = components['schemas']['RepresentantRelationChangeDto'];

export const WHATSAPP_STATUSES = ['NON_DEMANDE', 'MEME_NUMERO', 'AUTRE_NUMERO', 'AUCUN'] as const;

export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

export const WHATSAPP_STATUS_LABELS: Record<WhatsappStatus, string> = {
  NON_DEMANDE: 'Non demandé',
  MEME_NUMERO: 'Le même que son téléphone',
  AUTRE_NUMERO: 'Un autre numéro',
  AUCUN: 'Pas de WhatsApp',
};

export const PROFESSIONS = [
  'Instituteur',
  'Professeur',
  'Directeur d’école',
  'Principal',
  'Proviseur',
  'Inspecteur',
  'Personnel administratif',
] as const;

export interface RepresentantScript {
  whatsappStatus: WhatsappStatus;
  /** Renseigné UNIQUEMENT sur `AUTRE_NUMERO` : `MEME_NUMERO` ne duplique rien. */
  whatsappE164: string | null;
  whatsappNumber: string | null;
  profession: string | null;
}

/**
 * Le contrat porte desormais les quatre champs. L'alias reste, il nomme
 * l'intention a l'appel et evite de propager `RepresentantRow` partout.
 */
export type ScriptedRepresentant = RepresentantRow;

export function scriptOf(representant: ScriptedRepresentant): RepresentantScript {
  return {
    whatsappStatus: representant.whatsappStatus,
    whatsappE164: representant.whatsappE164,
    // Calcule par le SERVEUR: ne pas le recalculer ici, les deux definitions
    // divergeraient au premier changement de regle.
    whatsappNumber: representant.whatsappNumber,
    profession: representant.profession,
  };
}

export interface RepresentantScriptPatch {
  whatsappStatus?: WhatsappStatus;
  whatsappE164?: string;
  profession?: string;
}

export type UpdateRepresentantPatch = UpdateRepresentantInput & RepresentantScriptPatch;

export function whatsappLabel(script: RepresentantScript): string {
  if (script.whatsappStatus === 'AUTRE_NUMERO' && script.whatsappNumber !== null) {
    return script.whatsappNumber;
  }
  return WHATSAPP_STATUS_LABELS[script.whatsappStatus];
}

const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

function localisationQuery(filters: RepresentantFilters): Partial<RepresentantQuery> {
  const query: Partial<RepresentantQuery> = {};
  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.departementId !== null) query.departementId = filters.departementId;
  if (filters.iefId !== null) query.iefId = filters.iefId;
  if (filters.commercialId !== null) query.commercialId = filters.commercialId;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  return query;
}

function critereQuery(filters: RepresentantFilters): Partial<RepresentantQuery> {
  const query: Partial<RepresentantQuery> = {};
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);
  if (filters.hasProspects !== null) query.hasProspects = filters.hasProspects ? 'true' : 'false';
  if (filters.relationStatus !== null) query.relationStatus = [filters.relationStatus];
  if (filters.statutQualificationId !== null) {
    query.statutQualificationId = filters.statutQualificationId;
  }
  if (filters.sortBy !== EMPTY_REPRESENTANT_FILTERS.sortBy) query.sortBy = filters.sortBy;
  if (filters.sortDir !== EMPTY_REPRESENTANT_FILTERS.sortDir) query.sortOrder = filters.sortDir;
  return query;
}

export function toRepresentantQuery(filters: RepresentantFilters): RepresentantQuery {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    ...localisationQuery(filters),
    ...critereQuery(filters),
  };
}

export async function fetchRepresentants(
  filters: RepresentantFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/representants', {
        params: { query: toRepresentantQuery(filters) },
      }),
    ),
  );
}

export type RepresentantSuivi = Exclude<RepresentantQuery['suivi'], undefined>;

export const SUIVI_PAGE_SIZE = 100;

/**
 * Le suivi d'appels ne passe pas par `RepresentantFilters` : il n'a ni URL, ni
 * tri choisi, le serveur trie déjà chaque suivi par son échéance.
 */
export async function fetchRepresentantsSuivi(
  suivi: RepresentantSuivi,
  lastCallById: string | null,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  const query: RepresentantQuery = { suivi, page: 1, pageSize: SUIVI_PAGE_SIZE };
  if (lastCallById !== null) query.lastCallById = lastCallById;
  return flattenPage(unwrap(await client.GET('/api/v1/representants', { params: { query } })));
}

/**
 * Ce que l'écran d'appel a le droit d'appeler : ses propres fiches et celles
 * qu'une campagne lui a confiées. Ne passe pas par `RepresentantFilters` : ce
 * n'est pas un critère que l'utilisateur pose, c'est la portée de l'écran, et
 * elle vaut pour tous les rôles, encadrement compris.
 */
const A_QUALIFIER_PAGE_SIZE = 10;

export async function fetchRepresentantsAQualifier(
  criteres: { search: string; relationStatus: RepresentantRelation[] | null; page: number },
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  const query: RepresentantQuery = {
    mesFiches: true,
    search: criteres.search,
    ...(criteres.relationStatus === null ? {} : { relationStatus: criteres.relationStatus }),
    sortBy: 'fullName',
    sortOrder: 'asc',
    page: criteres.page,
    pageSize: A_QUALIFIER_PAGE_SIZE,
  };
  return flattenPage(unwrap(await client.GET('/api/v1/representants', { params: { query } })));
}

/** Les représentants dont ce téléconseiller a passé le DERNIER appel, du plus récent au plus ancien. */
export async function fetchRepresentantsAppeles(
  appelePar: string,
  page = 1,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  const query: RepresentantQuery = {
    appelePar,
    sortBy: 'lastCallAt',
    sortOrder: 'desc',
    page,
    pageSize: SUIVI_PAGE_SIZE,
  };
  return flattenPage(unwrap(await client.GET('/api/v1/representants', { params: { query } })));
}

export async function fetchRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.GET('/api/v1/representants/{id}', { params: { path: { id } } }));
}

export type RepresentantCallAttempt = components['schemas']['RepresentantCallAttemptDto'];

export async function fetchRepresentantCallAttempts(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantCallAttempt[]> {
  const payload = unwrap(
    await client.GET('/api/v1/representants/{id}/call-attempts', { params: { path: { id } } }),
  );
  return payload.items;
}

/** Les relevés du téléphone venaient de l'application mobile, abandonnée : la liste reste vide. */
export async function fetchRepresentantDeviceCalls(_id: string): Promise<DeviceCallDetection[]> {
  return [];
}

export async function fetchRepresentantRelationHistory(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRelationChange[]> {
  const payload = unwrap(
    await client.GET('/api/v1/representants/{id}/relation-history', {
      params: { path: { id } },
    }),
  );
  return payload.items;
}

export type RepresentantFicheChange = components['schemas']['RepresentantFicheChangeDto'];

export async function fetchRepresentantFicheHistory(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantFicheChange[]> {
  const payload = unwrap(
    await client.GET('/api/v1/representants/{id}/fiche-history', { params: { path: { id } } }),
  );
  return payload.items;
}

export async function createRepresentant(
  input: CreateRepresentantInput,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.POST('/api/v1/representants', { body: input }));
}

export async function lookupRepresentantByPhone(
  phone: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantLookup> {
  return unwrap(await client.GET('/api/v1/representants/lookup', { params: { query: { phone } } }));
}

/** L'encadrement confie la fiche à un téléconseiller ; les campagnes en cours suivent. */
export async function affecterRepresentant(
  id: string,
  destination: { teleconseillerId: string } | { campagneId: string },
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.POST('/api/v1/representants/{id}/affecter', {
      params: { path: { id } },
      body: destination,
    }),
  );
}

/** L'encadrement pose le statut de qualification sans appel ; la relation suit. */
export async function poserStatutRepresentant(
  id: string,
  body: { statutQualificationId: string; callbackAt?: string },
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.POST('/api/v1/representants/{id}/statut-qualification', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function updateRepresentant(
  id: string,
  patch: UpdateRepresentantPatch,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(
    await client.PATCH('/api/v1/representants/{id}', { params: { path: { id } }, body: patch }),
  );
}

export type RepresentantComment = components['schemas']['RepresentantCommentDto'];

export interface NewRepresentantComment {
  id: string;
  body: string;
  clientCreatedAt: string;
}

export const representantCommentsQueryKey = (representantId: string) =>
  ['representants', 'detail', representantId, 'comments'] as const;

export async function fetchRepresentantComments(
  representantId: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantComment[]> {
  const payload = unwrap(
    await client.GET('/api/v1/representants/{id}/comments', {
      params: { path: { id: representantId } },
    }),
  );
  return payload.items;
}

export async function createRepresentantComment(
  representantId: string,
  comment: NewRepresentantComment,
  client: ApiClient = getApiClient(),
): Promise<RepresentantComment> {
  return unwrap(
    await client.POST('/api/v1/representants/{id}/comments', {
      params: { path: { id: representantId } },
      body: comment,
    }),
  );
}

/**
 * Archivage : la fiche porte un `deletedAt`, ses appels et son histoire restent.
 * Sans `cascade`, le serveur refuse en 409 tant que la fiche porte des prospects,
 * pour qu'on ne les emporte pas sans le savoir.
 */
export async function deleteRepresentant(
  id: string,
  cascade = false,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.DELETE('/api/v1/representants/{id}', {
      params: { path: { id }, query: cascade ? { cascade: true } : {} },
    }),
  );
}

export async function deleteRepresentantComment(
  representantId: string,
  commentId: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.DELETE('/api/v1/representants/{id}/comments/{commentId}', {
      params: { path: { id: representantId, commentId } },
    }),
  );
}

/**
 * UUID v7 posé par le CLIENT : il sert de clé d'idempotence, un envoi rejoué
 * après une coupure ne doit pas doubler le commentaire.
 */
export function newCommentId(): string {
  const at = Date.now().toString(16).padStart(12, '0');
  const random = Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const variant = ((Number.parseInt(random.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  return [
    at.slice(0, 8),
    at.slice(8, 12),
    `7${random.slice(0, 3)}`,
    `${variant}${random.slice(4, 7)}`,
    random.slice(7, 19),
  ].join('-');
}
