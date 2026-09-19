import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type Vente = components['schemas']['VenteDTO'];
export type ClasseurVentes = components['schemas']['ClasseurDTO'];
export type VenteParTeleconseiller = components['schemas']['VenteParTeleconseillerDTO'];
export type VenteInput = components['schemas']['VenteInput'];
export type VersementInput = components['schemas']['VersementInput'];
export type SiteVente = components['schemas']['SiteVenteDTO'];
export type CanalVente = components['schemas']['CanalVenteDTO'];
export type SiteVenteInput = components['schemas']['SiteVenteModifyInputBody'];
export type SiteVenteCreationInput = components['schemas']['SiteVenteInputBody'];
export type CanalVenteInput = components['schemas']['CanalVenteModifyInputBody'];
export type CanalVenteCreationInput = components['schemas']['CanalVenteInputBody'];
export interface VentesData {
  classeur: ClasseurVentes | null;
  ventes: Vente[];
  parTeleconseiller: VenteParTeleconseiller[];
}

export interface VentesConfiguration {
  sites: SiteVente[];
  canaux: CanalVente[];
}

export const CLASSEUR_VENTES_URL = '/api/v1/ventes/classeur/fichier';

export async function fetchVentes(client: ApiClient = getApiClient()): Promise<VentesData> {
  return unwrap(await client.GET('/api/v1/ventes'));
}

export async function fetchVentesConfiguration(
  client: ApiClient = getApiClient(),
): Promise<VentesConfiguration> {
  return unwrap(await client.GET('/api/v1/ventes/configuration'));
}

export async function createVente(
  input: VenteInput,
  client: ApiClient = getApiClient(),
): Promise<Vente> {
  return unwrap(await client.POST('/api/v1/ventes', { body: input }));
}

export async function updateVente(
  id: number,
  input: VenteInput,
  client: ApiClient = getApiClient(),
): Promise<Vente> {
  return unwrap(
    await client.PATCH('/api/v1/ventes/{id}', {
      params: { path: { id: String(id) } },
      body: input,
    }),
  );
}

export async function addVenteVersement(
  id: number,
  input: VersementInput,
  client: ApiClient = getApiClient(),
): Promise<Vente> {
  return unwrap(
    await client.POST('/api/v1/ventes/{id}/versements', {
      params: { path: { id: String(id) } },
      body: input,
    }),
  );
}

export async function archiveVente(id: number, client: ApiClient = getApiClient()): Promise<void> {
  unwrap(await client.DELETE('/api/v1/ventes/{id}', { params: { path: { id: String(id) } } }));
}

export async function updateSiteVente(
  id: string,
  input: SiteVenteInput,
  client: ApiClient = getApiClient(),
): Promise<SiteVente> {
  return unwrap(
    await client.PATCH('/api/v1/ventes/sites/{id}', { params: { path: { id } }, body: input }),
  );
}

export async function createSiteVente(
  input: SiteVenteCreationInput,
  client: ApiClient = getApiClient(),
): Promise<SiteVente> {
  return unwrap(await client.POST('/api/v1/ventes/sites', { body: input }));
}

export async function setSiteVenteActive(
  id: string,
  actif: boolean,
  client: ApiClient = getApiClient(),
): Promise<SiteVente> {
  return unwrap(
    await client.POST('/api/v1/ventes/sites/{id}/active', {
      params: { path: { id } },
      body: { actif },
    }),
  );
}

export async function updateCanalVente(
  id: string,
  input: CanalVenteInput,
  client: ApiClient = getApiClient(),
): Promise<CanalVente> {
  return unwrap(
    await client.PATCH('/api/v1/ventes/canaux/{id}', { params: { path: { id } }, body: input }),
  );
}

export async function createCanalVente(
  input: CanalVenteCreationInput,
  client: ApiClient = getApiClient(),
): Promise<CanalVente> {
  return unwrap(await client.POST('/api/v1/ventes/canaux', { body: input }));
}

export async function setCanalVenteActive(
  id: string,
  actif: boolean,
  client: ApiClient = getApiClient(),
): Promise<CanalVente> {
  return unwrap(
    await client.POST('/api/v1/ventes/canaux/{id}/active', {
      params: { path: { id } },
      body: { actif },
    }),
  );
}

export async function deposerClasseurVentes(
  file: File,
  depuis: string,
  client: ApiClient = getApiClient(),
): Promise<VentesData> {
  const form = new FormData();
  form.append('file', file);
  return unwrap(
    await client.POST('/api/v1/ventes/classeur', {
      params: { query: depuis === '' ? {} : { depuis } },
      body: { file: '' },
      bodySerializer: () => form,
    }),
  );
}

export const totalVerse = (vente: Vente): number =>
  vente.versements.reduce((somme, versement) => somme + versement.montant, vente.acompte);

const FCFA = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const formatFcfa = (montant: number): string => `${FCFA.format(montant)} FCFA`;
