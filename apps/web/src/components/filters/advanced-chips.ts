import { ADVANCED_FILTER_KEYS, type AdvancedFilterKey } from '@/lib/filters';
import { withRetired } from '@/lib/format';
import {
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type ProspectFilters,
  type ReferenceData,
} from '@/lib/types';

export interface AdvancedChip {
  key: AdvancedFilterKey;
  field: string;
  value: string;
}

export const ADVANCED_FILTER_LABELS: Record<AdvancedFilterKey, string> = {
  representantId: 'Représentant',
  departementId: 'Département',
  banqueId: 'Banque',
  syndicatId: 'Syndicat',
  statut: 'Statut',
  segment: 'Segment BDD',
  phase2Status: 'Statut phase 2',
  enrollmentMethod: 'Méthode d’enrôlement',
  campaignId: 'Campagne d’appels',
  enrollmentCapturedById: 'Méthode obtenue par',
};

const UNKNOWN_VALUE = 'Valeur inconnue';

function optionLabel(options: readonly { value: string; label: string }[], id: string): string {
  return options.find((option) => option.value === id)?.label ?? UNKNOWN_VALUE;
}

function chipValue(
  key: AdvancedFilterKey,
  filters: ProspectFilters,
  reference: ReferenceData | undefined,
): string | null {
  switch (key) {
    case 'representantId':
      return filters.representantId === null
        ? null
        : optionLabel(reference?.representants ?? [], filters.representantId);

    case 'departementId': {
      if (filters.departementId === null) return null;
      const item = reference?.departements.find((d) => d.id === filters.departementId);
      return item === undefined ? UNKNOWN_VALUE : withRetired(item.name, item.isActive);
    }

    case 'banqueId': {
      if (filters.banqueId === null) return null;
      const item = reference?.banques.find((b) => b.id === filters.banqueId);
      return item === undefined ? UNKNOWN_VALUE : withRetired(item.shortName, item.isActive);
    }

    case 'syndicatId': {
      if (filters.syndicatId === null) return null;
      const item = reference?.syndicats.find((s) => s.id === filters.syndicatId);
      return item === undefined ? UNKNOWN_VALUE : withRetired(item.sigle, item.isActive);
    }

    case 'statut':
      return filters.statut === null ? null : PROSPECT_STATUT_LABELS[filters.statut];

    case 'segment':
      return filters.segment === null ? null : SEGMENT_LABELS[filters.segment];

    case 'phase2Status':
      return filters.phase2Status === null ? null : PHASE2_STATUS_LABELS[filters.phase2Status];

    case 'enrollmentMethod':
      return filters.enrollmentMethod === null
        ? null
        : ENROLLMENT_METHOD_LABELS[filters.enrollmentMethod];

    case 'campaignId':
      return filters.campaignId === null
        ? null
        : optionLabel(reference?.campagnes ?? [], filters.campaignId);

    case 'enrollmentCapturedById':
      return filters.enrollmentCapturedById === null
        ? null
        : optionLabel(reference?.commerciaux ?? [], filters.enrollmentCapturedById);
  }
}

export function buildAdvancedChips(
  filters: ProspectFilters,
  reference: ReferenceData | undefined,
): AdvancedChip[] {
  const chips: AdvancedChip[] = [];

  for (const key of ADVANCED_FILTER_KEYS) {
    const value = chipValue(key, filters, reference);
    if (value === null) continue;
    chips.push({ key, field: ADVANCED_FILTER_LABELS[key], value });
  }

  return chips;
}
