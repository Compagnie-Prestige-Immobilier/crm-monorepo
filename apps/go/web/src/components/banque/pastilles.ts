import type { CleAvancee, FiltresDossiers } from '@/components/banque/filtres';
import { CLES_AVANCEES, LIBELLES_AVANCES } from '@/components/banque/filtres';
import { formatMontant } from '@/components/banque/montant';
import type { PastilleFiltre } from '@/components/ui/advanced-panel';
import type { OptionFiltre } from '@/components/ui/filter-combobox';

export interface ListesAvancees {
  banques: readonly OptionFiltre[];
  agents: readonly OptionFiltre[];
  motifs: readonly OptionFiltre[];
}

function libelle(options: readonly OptionFiltre[], id: string | null): string | null {
  if (id === null) return null;
  return options.find((option) => option.value === id)?.label ?? 'Valeur inconnue';
}

/** Ce que le panneau replié laisse voir : un critère caché reste retirable. */
export function pastillesAvancees(
  filtres: FiltresDossiers,
  listes: ListesAvancees,
): PastilleFiltre<CleAvancee>[] {
  const valeurs: Record<CleAvancee, string | null> = {
    banqueId: libelle(listes.banques, filtres.banqueId),
    agentId: libelle(listes.agents, filtres.agentId),
    rejectionReasonId: libelle(listes.motifs, filtres.rejectionReasonId),
    amountMin: filtres.amountMin === null ? null : formatMontant(filtres.amountMin),
    amountMax: filtres.amountMax === null ? null : formatMontant(filtres.amountMax),
  };

  return CLES_AVANCEES.filter((cle) => valeurs[cle] !== null).map((cle) => ({
    key: cle,
    champ: LIBELLES_AVANCES[cle],
    valeur: valeurs[cle] ?? '',
  }));
}
