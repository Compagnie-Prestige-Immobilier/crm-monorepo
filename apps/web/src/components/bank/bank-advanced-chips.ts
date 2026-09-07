import type { AdvancedChipItem } from '@/components/filters/advanced-panel';
import {
  BANK_ADVANCED_FILTER_KEYS,
  type BankAdvancedFilterKey,
  type BankCaseFilters,
} from '@/lib/bank-filters';
import { formatXof } from '@/lib/money';
import type { FilterOption } from '@/lib/types';

export type BankAdvancedChip = AdvancedChipItem<BankAdvancedFilterKey>;

const BANK_ADVANCED_FILTER_LABELS: Record<BankAdvancedFilterKey, string> = {
  banqueId: 'Banque de traitement',
  agentId: 'Agent',
  rejectionReasonId: 'Motif de rejet',
  amountMin: 'Montant minimum',
  amountMax: 'Montant maximum',
};

const UNKNOWN_VALUE = 'Valeur inconnue';

function optionLabel(options: readonly FilterOption[], id: string): string {
  return options.find((option) => option.value === id)?.label ?? UNKNOWN_VALUE;
}

export interface BankChipOptions {
  banques: readonly FilterOption[];
  agents: readonly FilterOption[];
  reasons: readonly FilterOption[];
}

type ChipExtractor = (filters: BankCaseFilters, options: BankChipOptions) => string | null;

const CHIP_EXTRACTORS: Record<BankAdvancedFilterKey, ChipExtractor> = {
  banqueId: (filters, options) =>
    filters.banqueId === null ? null : optionLabel(options.banques, filters.banqueId),
  agentId: (filters, options) =>
    filters.agentId === null ? null : optionLabel(options.agents, filters.agentId),
  rejectionReasonId: (filters, options) =>
    filters.rejectionReasonId === null
      ? null
      : optionLabel(options.reasons, filters.rejectionReasonId),
  amountMin: (filters) => (filters.amountMin === null ? null : formatXof(filters.amountMin)),
  amountMax: (filters) => (filters.amountMax === null ? null : formatXof(filters.amountMax)),
};

function chipValue(
  key: BankAdvancedFilterKey,
  filters: BankCaseFilters,
  options: BankChipOptions,
): string | null {
  return CHIP_EXTRACTORS[key](filters, options);
}

export function buildBankAdvancedChips(
  filters: BankCaseFilters,
  options: BankChipOptions,
): BankAdvancedChip[] {
  const chips: BankAdvancedChip[] = [];

  for (const key of BANK_ADVANCED_FILTER_KEYS) {
    const value = chipValue(key, filters, options);
    if (value === null) continue;
    chips.push({ key, field: BANK_ADVANCED_FILTER_LABELS[key], value });
  }

  return chips;
}
