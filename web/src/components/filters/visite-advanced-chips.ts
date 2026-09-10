import type { AdvancedChipItem } from '@/components/filters/advanced-panel';
import { VISITE_COLONNES, type VisiteFilters, type VisiteReferentiels } from '@/lib/data/visites';

export type VisiteAdvancedFilterKey = 'entrepriseId' | 'directionId' | 'destinataireId' | 'objetId';

export const VISITE_ADVANCED_FILTER_KEYS: readonly VisiteAdvancedFilterKey[] = [
  'entrepriseId',
  'directionId',
  'destinataireId',
  'objetId',
];

const LABELS: Record<VisiteAdvancedFilterKey, string> = {
  entrepriseId: VISITE_COLONNES.entreprise,
  directionId: VISITE_COLONNES.direction,
  destinataireId: VISITE_COLONNES.destinataire,
  objetId: VISITE_COLONNES.objet,
};

const UNKNOWN_VALUE = 'Valeur inconnue';

type ListeReferentiel = readonly { readonly id: string; readonly label: string }[];

const LISTES: Record<
  VisiteAdvancedFilterKey,
  (referentiels: VisiteReferentiels | undefined) => ListeReferentiel
> = {
  entrepriseId: (referentiels) => referentiels?.entreprises ?? [],
  directionId: (referentiels) => referentiels?.directions ?? [],
  destinataireId: (referentiels) => referentiels?.destinataires ?? [],
  objetId: (referentiels) => referentiels?.objets ?? [],
};

function chipValue(
  key: VisiteAdvancedFilterKey,
  filters: VisiteFilters,
  referentiels: VisiteReferentiels | undefined,
): string | null {
  const id = filters[key];
  if (id === null) return null;
  return LISTES[key](referentiels).find((item) => item.id === id)?.label ?? UNKNOWN_VALUE;
}

export function buildVisiteAdvancedChips(
  filters: VisiteFilters,
  referentiels: VisiteReferentiels | undefined,
): AdvancedChipItem<VisiteAdvancedFilterKey>[] {
  const chips: AdvancedChipItem<VisiteAdvancedFilterKey>[] = [];

  for (const key of VISITE_ADVANCED_FILTER_KEYS) {
    const value = chipValue(key, filters, referentiels);
    if (value === null) continue;
    chips.push({ key, field: LABELS[key], value });
  }

  return chips;
}
