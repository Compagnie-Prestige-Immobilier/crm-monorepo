import { ApiError, apiClient, unwrap } from '@/api/client';
import type { components, paths } from '@/api/schema';
import type { ProjetApi } from '@/lib/types';

type Schemas = components['schemas'];

export type DossierBanque = Schemas['DossierBanque'];
export type EtapeBanque = Schemas['EtapeBanque'];
export type MotifBanque = Schemas['MotifBanque'];
export type TransitionBanque = Schemas['TransitionBanque'];
export type ProspectBanque = Schemas['ProspectBanque'];
export type DetailDossier = Schemas['DetailDossierOutputBody'];
export type IndicateursBanque = Schemas['IndicateursBanqueOutputBody'];
export type CorpsTransition = Schemas['CorpsTransitionBanque'];

export type RequeteDossiers = NonNullable<
  paths['/api/v1/bank-cases']['get']['parameters']['query']
>;
export type RequeteIndicateurs = NonNullable<
  paths['/api/v1/bank-cases/analytics']['get']['parameters']['query']
>;

export interface PageDossiers {
  items: DossierBanque[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export async function fetchDossiers(query: RequeteDossiers): Promise<PageDossiers> {
  const page = unwrap(await apiClient.GET('/api/v1/bank-cases', { params: { query } }));
  return { items: page.items ?? [], ...page.meta };
}

/** `projet` borne la lecture à la coque ouverte : un dossier de l'autre parcours répond 404. */
export async function fetchDossier(id: string, projet: ProjetApi): Promise<DetailDossier> {
  return unwrap(
    await apiClient.GET('/api/v1/bank-cases/{id}', {
      params: { path: { id }, query: { projet } },
    }),
  );
}

export async function fetchIndicateurs(query: RequeteIndicateurs): Promise<IndicateursBanque> {
  return unwrap(await apiClient.GET('/api/v1/bank-cases/analytics', { params: { query } }));
}

export async function chercherProspects(
  search: string,
  projet: ProjetApi,
): Promise<ProspectBanque[]> {
  const page = unwrap(
    await apiClient.GET('/api/v1/bank-cases/prospect-search', {
      params: { query: { search, projet, pageSize: 20 } },
    }),
  );
  return page.items ?? [];
}

export async function ouvrirDossier(body: {
  prospectId: string;
  reference: string;
  processingBankId?: string;
}): Promise<DossierBanque> {
  return unwrap(await apiClient.POST('/api/v1/bank-cases', { body }));
}

export async function franchirEtape(id: string, body: CorpsTransition): Promise<DetailDossier> {
  return unwrap(
    await apiClient.POST('/api/v1/bank-cases/{id}/transitions', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function fetchEtapes(includeInactive: boolean): Promise<EtapeBanque[]> {
  const liste = unwrap(
    await apiClient.GET('/api/v1/bank-case-stages', { params: { query: { includeInactive } } }),
  );
  return liste.items ?? [];
}

export async function fetchMotifs(): Promise<MotifBanque[]> {
  const liste = unwrap(
    await apiClient.GET('/api/v1/bank-cases/rejection-reasons', {
      params: { query: { includeInactive: false } },
    }),
  );
  return liste.items ?? [];
}

export async function creerEtape(body: {
  code: string;
  label: string;
  color: string;
}): Promise<EtapeBanque> {
  return unwrap(await apiClient.POST('/api/v1/bank-case-stages', { body }));
}

export async function renommerEtape(
  id: string,
  body: { label: string; color: string },
): Promise<EtapeBanque> {
  return unwrap(
    await apiClient.PATCH('/api/v1/bank-case-stages/{id}', { params: { path: { id } }, body }),
  );
}

export async function reordonnerEtapes(stageIds: string[]): Promise<EtapeBanque[]> {
  const liste = unwrap(
    await apiClient.POST('/api/v1/bank-case-stages/reorder', { body: { stageIds } }),
  );
  return liste.items ?? [];
}

export async function activerEtape(id: string, isActive: boolean): Promise<EtapeBanque> {
  return unwrap(
    await apiClient.POST('/api/v1/bank-case-stages/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}

export async function chercherRepresentants(search: string): Promise<Schemas['RepresentantDto'][]> {
  const page = unwrap(
    await apiClient.GET('/api/v1/representants', { params: { query: { search, pageSize: 20 } } }),
  );
  return page.items ?? [];
}

/** Charge utile v1 d'un refus bancaire : elle voyage dans `errors[0].value` (RFC 9457). */
export function chargeRefus(erreur: unknown): Record<string, unknown> | null {
  if (!(erreur instanceof ApiError)) return null;
  const payload = erreur.payload;
  if (typeof payload !== 'object' || payload === null) return null;
  const liste = (payload as { errors?: unknown }).errors;
  if (!Array.isArray(liste)) return null;
  const valeur: unknown = (liste[0] as { value?: unknown } | undefined)?.value;
  return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : null;
}
