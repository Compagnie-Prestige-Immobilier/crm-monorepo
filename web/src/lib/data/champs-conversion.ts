import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { ProjetApi } from '@/lib/types';

export type ReglagesConversion = components['schemas']['ProspectReglagesConversion'];
export type ReglageChamp = components['schemas']['ProspectReglageChamp'];
export type ChampLibre = components['schemas']['ProspectChampLibre'];
export type TypeChampLibre = ChampLibre['type'];

export const TYPES_CHAMP_LIBRE: readonly TypeChampLibre[] = ['TEXTE', 'LISTE', 'OUI_NON'];

export const LIBELLES_TYPE_CHAMP: Record<TypeChampLibre, string> = {
  TEXTE: 'Texte',
  LISTE: 'Liste de valeurs',
  OUI_NON: 'Oui / non',
};

/** Le serveur ne reconnaît que les identifiants qu'il a écrits : ceux-ci sont provisoires. */
const PREFIXE_NOUVEAU = 'nouveau-';

const OUI_NON: readonly string[] = ['Oui', 'Non'];

/** Les valeurs proposées par un champ ajouté : une liste, ou le couple oui / non. */
export function valeursProposees(champ: ChampLibre): readonly string[] {
  if (champ.type === 'OUI_NON') return OUI_NON;
  return champ.options ?? [];
}

export async function fetchChampsConversion(projet: ProjetApi): Promise<ReglagesConversion> {
  return unwrap(
    await apiClient.GET('/api/v1/champs-conversion/{projet}', { params: { path: { projet } } }),
  );
}

export async function ecrireChampsConversion(
  projet: ProjetApi,
  champs: readonly ReglageChamp[],
  libres: readonly ChampLibre[],
): Promise<ReglagesConversion> {
  return unwrap(
    await apiClient.PUT('/api/v1/champs-conversion/{projet}', {
      params: { path: { projet } },
      body: {
        champs: champs.map((champ) => ({
          champ: champ.champ,
          visible: champ.visible,
          obligatoire: champ.obligatoire,
        })),
        libres: libres.map((champ) => ({
          ...(champ.id.startsWith(PREFIXE_NOUVEAU) ? {} : { id: champ.id }),
          libelle: champ.libelle,
          type: champ.type,
          options: champ.options ?? [],
          obligatoire: champ.obligatoire,
        })),
      },
    }),
  );
}

export function nouveauChampLibre(): ChampLibre {
  return {
    id: `${PREFIXE_NOUVEAU}${String(Date.now())}`,
    libelle: '',
    type: 'TEXTE',
    options: [],
    obligatoire: false,
  };
}
