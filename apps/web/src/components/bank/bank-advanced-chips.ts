import type { AdvancedChipItem } from '@/components/filters/advanced-panel';
import {
  BANK_ADVANCED_FILTER_KEYS,
  type BankAdvancedFilterKey,
  type BankCaseFilters,
} from '@/lib/bank-filters';
import { formatXof } from '@/lib/money';
import type { FilterOption } from '@/lib/types';

/**
 * Les puces qui rappellent les critères avancés des dossiers pendant que le
 * panneau est replié : même rôle que `filters/advanced-chips.ts` pour les
 * prospects, et pour la même raison : un critère actif mais invisible est pire
 * qu'un panneau trop haut.
 *
 * Un agent qui envoie un classeur à sa direction doit pouvoir jurer qu'il
 * contient exactement ce qu'il avait sous les yeux. Une borne de montant restée
 * posée trois écrans plus tôt fausse ce classeur en silence : la puce la nomme,
 * avec sa valeur, et la retire en un clic.
 *
 * Le module est PUR et séparé du composant pour être éprouvable sans
 * navigateur : c'est la correspondance identifiant vers libellé qui casse en
 * premier, quand une banque est retirée du référentiel ou qu'un motif de rejet
 * disparaît.
 */

export type BankAdvancedChip = AdvancedChipItem<BankAdvancedFilterKey>;

/** Nom de chaque critère, identique à l'étiquette de son champ dans le panneau. */
export const BANK_ADVANCED_FILTER_LABELS: Record<BankAdvancedFilterKey, string> = {
  banqueId: 'Banque de traitement',
  agentId: 'Agent',
  rejectionReasonId: 'Motif de rejet',
  amountMin: 'Montant minimum',
  amountMax: 'Montant maximum',
};

/**
 * Valeur affichée quand l'identifiant ne correspond à aucune entrée connue.
 *
 * Le cas est réel : une URL partagée peut porter l'identifiant d'un motif de
 * rejet retiré depuis. Masquer la puce laisserait un filtre actif sans aucune
 * trace à l'écran, c'est-à-dire exactement le défaut que ces puces existent
 * pour supprimer.
 */
const UNKNOWN_VALUE = 'Valeur inconnue';

function optionLabel(options: readonly FilterOption[], id: string): string {
  return options.find((option) => option.value === id)?.label ?? UNKNOWN_VALUE;
}

export interface BankChipOptions {
  banques: readonly FilterOption[];
  agents: readonly FilterOption[];
  reasons: readonly FilterOption[];
}

/**
 * Valeur lisible d'un critère, ou `null` s'il n'est pas renseigné.
 *
 * Chaque branche lit SON champ nommément plutôt qu'un `filters[key]` générique :
 * un critère renommé casse ici, à l'endroit exact, au lieu de produire une puce
 * vide en production.
 */
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
    // Les bornes restent des chaînes de chiffres d'un bout à l'autre : la puce
    // les met en forme pour l'œil, elle ne les convertit jamais en nombre.
    case 'amountMin':
      return filters.amountMin === null ? null : formatXof(filters.amountMin);
    case 'amountMax':
      return filters.amountMax === null ? null : formatXof(filters.amountMax);
  }
}

/**
 * Les listes d'options peuvent être vides : elles se chargent après le premier
 * rendu. Une puce portant « Valeur inconnue » pendant une seconde vaut mieux
 * qu'une absence de puce, qui laisserait croire qu'aucun filtre ne s'applique.
 */
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
