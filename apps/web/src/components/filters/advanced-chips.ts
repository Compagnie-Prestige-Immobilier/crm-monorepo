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
  // Les mêmes mots que sur les champs repliés : la pastille est ce qu'on lit
  // quand le panneau est fermé, elle ne peut pas nommer autrement.
  segment: 'Groupe (syndicat × banque)',
  phase2Status: 'Résultat de l’appel',
  enrollmentMethod: 'Comment il a adhéré',
  enrollmentCapturedById: 'Adhésion obtenue par',
};

const UNKNOWN_VALUE = 'Valeur inconnue';

function optionLabel(options: readonly { value: string; label: string }[], id: string): string {
  return options.find((option) => option.value === id)?.label ?? UNKNOWN_VALUE;
}

type ChipValue = (filters: ProspectFilters, reference: ReferenceData | undefined) => string | null;

const CHIP_VALUES: Record<AdvancedFilterKey, ChipValue> = {
  representantId: (filters, reference) =>
    filters.representantId === null
      ? null
      : optionLabel(reference?.representants ?? [], filters.representantId),

  departementId: (filters, reference) => {
    if (filters.departementId === null) return null;
    const item = reference?.departements.find((d) => d.id === filters.departementId);
    return item === undefined ? UNKNOWN_VALUE : withRetired(item.name, item.isActive);
  },

  banqueId: (filters, reference) => {
    if (filters.banqueId === null) return null;
    const item = reference?.banques.find((b) => b.id === filters.banqueId);
    return item === undefined ? UNKNOWN_VALUE : withRetired(item.shortName, item.isActive);
  },

  syndicatId: (filters, reference) => {
    if (filters.syndicatId === null) return null;
    const item = reference?.syndicats.find((s) => s.id === filters.syndicatId);
    return item === undefined ? UNKNOWN_VALUE : withRetired(item.sigle, item.isActive);
  },

  statut: (filters) => (filters.statut === null ? null : PROSPECT_STATUT_LABELS[filters.statut]),

  segment: (filters) => (filters.segment === null ? null : SEGMENT_LABELS[filters.segment]),

  phase2Status: (filters) =>
    filters.phase2Status === null ? null : PHASE2_STATUS_LABELS[filters.phase2Status],

  enrollmentMethod: (filters) =>
    filters.enrollmentMethod === null ? null : ENROLLMENT_METHOD_LABELS[filters.enrollmentMethod],

  enrollmentCapturedById: (filters, reference) =>
    filters.enrollmentCapturedById === null
      ? null
      : optionLabel(reference?.commerciaux ?? [], filters.enrollmentCapturedById),
};

export function buildAdvancedChips(
  filters: ProspectFilters,
  reference: ReferenceData | undefined,
): AdvancedChip[] {
  const chips: AdvancedChip[] = [];

  for (const key of ADVANCED_FILTER_KEYS) {
    const value = CHIP_VALUES[key](filters, reference);
    if (value === null) continue;
    chips.push({ key, field: ADVANCED_FILTER_LABELS[key], value });
  }

  return chips;
}
