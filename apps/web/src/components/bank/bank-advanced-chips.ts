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

function chipValue(
  key: BankAdvancedFilterKey,
  filters: BankCaseFilters,
  options: BankChipOptions,
): string | null {
  switch (key) {
    case 'banqueId':
      return filters.banqueId === null ? null : optionLabel(options.banques, filters.banqueId);
    case 'agentId':
      return filters.agentId === null ? null : optionLabel(options.agents, filters.agentId);
    case 'rejectionReasonId':
      return filters.rejectionReasonId === null
        ? null
        : optionLabel(options.reasons, filters.rejectionReasonId);
    case 'amountMin':
      return filters.amountMin === null ? null : formatXof(filters.amountMin);
    case 'amountMax':
      return filters.amountMax === null ? null : formatXof(filters.amountMax);
  }
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
