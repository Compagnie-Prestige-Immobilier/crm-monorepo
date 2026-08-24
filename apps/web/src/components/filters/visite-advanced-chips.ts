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

function chipValue(
  key: VisiteAdvancedFilterKey,
  filters: VisiteFilters,
  referentiels: VisiteReferentiels | undefined,
): string | null {
  switch (key) {
    case 'entrepriseId':
      return filters.entrepriseId === null
        ? null
        : (referentiels?.entreprises.find((item) => item.id === filters.entrepriseId)?.label ??
            UNKNOWN_VALUE);

    case 'directionId':
      return filters.directionId === null
        ? null
        : (referentiels?.directions.find((item) => item.id === filters.directionId)?.label ??
            UNKNOWN_VALUE);

    case 'destinataireId':
      return filters.destinataireId === null
        ? null
        : (referentiels?.destinataires.find((item) => item.id === filters.destinataireId)?.label ??
            UNKNOWN_VALUE);

    case 'objetId':
      return filters.objetId === null
        ? null
        : (referentiels?.objets.find((item) => item.id === filters.objetId)?.label ??
            UNKNOWN_VALUE);
  }
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
