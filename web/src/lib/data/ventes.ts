import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type Vente = components['schemas']['VenteDTO'];
export type ClasseurVentes = components['schemas']['ClasseurDTO'];
export type VenteParTeleconseiller = components['schemas']['VenteParTeleconseillerDTO'];
export interface VentesData {
  classeur: ClasseurVentes | null;
  ventes: Vente[];
  parTeleconseiller: VenteParTeleconseiller[];
}

export const CLASSEUR_VENTES_URL = '/api/v1/ventes/classeur/fichier';

export async function fetchVentes(client: ApiClient = getApiClient()): Promise<VentesData> {
  return unwrap(await client.GET('/api/v1/ventes'));
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
