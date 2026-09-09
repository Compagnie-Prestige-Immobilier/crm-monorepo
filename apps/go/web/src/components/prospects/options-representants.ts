import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { FILTRES_VIDES } from '@/components/representants/filtres';
import type { OptionFiltre } from '@/components/ui/filter-combobox';
import { fetchRepresentants } from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * La liste des représentants est trop longue pour être chargée d'un bloc : le
 * serveur cherche, et la fiche déjà rattachée reste proposée même hors résultat.
 */
export function useOptionsRepresentants(
  deja: OptionFiltre | null,
  actif = true,
): { options: OptionFiltre[]; onSearchChange: (recherche: string) => void } {
  const [recherche, setRecherche] = useState('');

  const liste = useQuery({
    queryKey: [...queryKeys.representantsRoot, 'choix', recherche.trim()],
    queryFn: () =>
      fetchRepresentants({
        ...FILTRES_VIDES,
        search: recherche.trim(),
        sortBy: 'fullName',
        sortDir: 'asc',
      }),
    enabled: actif,
  });

  const trouves = (liste.data?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.fullName} - ${formatPhone(item.phoneE164)}`,
    hint: item.departementName,
  }));

  const options = [...(deja === null ? [] : [deja]), ...trouves].filter(
    (option, index, toutes) => toutes.findIndex((autre) => autre.value === option.value) === index,
  );

  return { options, onSearchChange: setRecherche };
}
