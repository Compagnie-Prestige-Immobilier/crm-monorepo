import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { useQuery } from '@tanstack/react-query';

import { getApiClient } from '@/lib/api/browser';
import { queryKeys } from '@/lib/query-keys';
import type { Projet } from '@/lib/types';

export type ReglagesConversion = components['schemas']['ReglagesConversionDto'];
export type ReglageChamp = components['schemas']['ReglageChampDto'];
export type ChampLibre = components['schemas']['ChampLibreDto'];
export type UpdateReglagesConversion = components['schemas']['UpdateReglagesConversionDto'];
export type TypeChampLibre = ChampLibre['type'];

export const TYPE_CHAMP_LIBRE_LABELS: Readonly<Record<TypeChampLibre, string>> = {
  TEXTE: 'Texte',
  LISTE: 'Liste de valeurs',
  OUI_NON: 'Oui / non',
};

export const OUI_NON: readonly string[] = ['Oui', 'Non'];

export async function fetchChampsConversion(
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<ReglagesConversion> {
  return unwrap(
    await client.GET('/api/v1/champs-conversion/{projet}', { params: { path: { projet } } }),
  );
}

export async function updateChampsConversion(
  projet: Projet,
  body: UpdateReglagesConversion,
  client: ApiClient = getApiClient(),
): Promise<ReglagesConversion> {
  return unwrap(
    await client.PUT('/api/v1/champs-conversion/{projet}', {
      params: { path: { projet } },
      body,
    }),
  );
}

/** Les valeurs proposées par un champ ajouté : une liste, ou le couple oui / non. */
export function valeursProposees(champ: ChampLibre): readonly string[] {
  if (champ.type === 'OUI_NON') return OUI_NON;
  return champ.options;
}

const STALE_TIME = 300_000;

interface Formulaire {
  readonly champs: readonly ReglageChamp[];
  readonly libres: readonly ChampLibre[];
}

const SANS_REGLAGE: Formulaire = { champs: [], libres: [] };

/**
 * Le formulaire tel que l'administrateur l'a réglé. Tant qu'il n'est pas lu,
 * les listes sont vides et les écrans retombent sur les règles du projet.
 */
export function useChampsConversion(projet: Projet): Formulaire {
  const reglages = useQuery({
    queryKey: queryKeys.champsConversion(projet),
    queryFn: () => fetchChampsConversion(projet),
    staleTime: STALE_TIME,
  });
  return reglages.data ?? SANS_REGLAGE;
}
