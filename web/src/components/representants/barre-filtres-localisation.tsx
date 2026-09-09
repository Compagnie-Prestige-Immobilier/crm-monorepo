import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { FiltresRepresentants } from '@/components/representants/filtres';
import { FilterCombobox } from '@/components/ui/filter-combobox';
import {
  enOptions,
  fetchIefs,
  fetchReferentiels,
  REFERENTIELS_STALE_MS,
} from '@/lib/data/referentiels';
import { fetchComptes, FILTRES_REPRENEURS } from '@/lib/data/users';
import { queryKeys } from '@/lib/query-keys';

export type Setter = (patch: Partial<FiltresRepresentants>) => void;

/** Région, département et IEF s'enchaînent : changer l'un remet les suivants à zéro. */
export function ChampsLocalisation({
  filtres,
  setFiltres,
}: {
  filtres: FiltresRepresentants;
  setFiltres: Setter;
}) {
  const [regionBrouillon, setRegionBrouillon] = useState<string | null>(null);

  const referentiels = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferentiels(),
    staleTime: REFERENTIELS_STALE_MS,
  });
  const iefs = useQuery({
    queryKey: queryKeys.iefs,
    queryFn: () => fetchIefs(),
    staleTime: REFERENTIELS_STALE_MS,
  });
  const teleconseillers = useQuery({
    queryKey: queryKeys.commerciaux({ ...FILTRES_REPRENEURS }),
    queryFn: () => fetchComptes(FILTRES_REPRENEURS),
    staleTime: REFERENTIELS_STALE_MS,
  });

  const departements = referentiels.data?.departements ?? [];
  const regionId =
    departements.find((departement) => departement.id === filtres.departementId)?.regionId ??
    regionBrouillon;

  return (
    <>
      <FilterCombobox
        className="min-w-[13rem] flex-1"
        label="Région"
        placeholder="Toutes les régions"
        value={regionId}
        options={enOptions(referentiels.data?.regions)}
        onChange={(valeur) => {
          setRegionBrouillon(valeur);
          if (filtres.departementId === null && filtres.iefId === null) return;
          setFiltres({ departementId: null, iefId: null });
        }}
      />

      <FilterCombobox
        className="min-w-[13rem] flex-1"
        label="Département"
        placeholder="Tous les départements"
        value={filtres.departementId}
        options={enOptions(
          departements.filter(
            (departement) => regionId === null || departement.regionId === regionId,
          ),
          (item) => item.regionName ?? undefined,
        )}
        onChange={(valeur) => {
          setFiltres({ departementId: valeur, iefId: null });
        }}
      />

      <FilterCombobox
        className="min-w-[13rem] flex-1"
        label="IEF"
        placeholder="Toutes les IEF"
        value={filtres.iefId}
        options={enOptions(
          (iefs.data ?? []).filter(
            (ief) => filtres.departementId === null || ief.departementId === filtres.departementId,
          ),
          (item) => item.departementName ?? undefined,
        )}
        onChange={(iefId) => {
          setFiltres({ iefId });
        }}
      />

      <FilterCombobox
        className="min-w-[13rem] flex-1"
        label="Téléconseiller"
        placeholder="Tous les téléconseillers"
        value={filtres.commercialId}
        options={(teleconseillers.data?.items ?? []).map((compte) => ({
          value: compte.id,
          label: compte.fullName,
        }))}
        onChange={(commercialId) => {
          setFiltres({ commercialId });
        }}
      />
    </>
  );
}
