'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback } from 'react';

import { buildAdvancedChips } from '@/components/filters/advanced-chips';
import { AdvancedPanel } from '@/components/filters/advanced-panel';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  clearAdvancedFilters,
  countActiveFilters,
  PROSPECT_ADVANCED_KEYS,
  type AdvancedFilterKey,
} from '@/lib/filters';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';

// Les deux valeurs ne portent QUE sur des demandes converties : rien d'autre
// n'a de revue à passer.
const REVUE_OPTIONS: FilterOption[] = [
  { value: 'non', label: 'Non revue' },
  { value: 'oui', label: 'Revue' },
];

function revueValue(revue: boolean | null): string | null {
  if (revue === null) return null;
  return revue ? 'oui' : 'non';
}

export function FiltersBar({
  startCollapsed = true,
  viewerId,
}: {
  startCollapsed?: boolean;
  /** Pose le bouton « Mes fiches » : l'admin et la direction retrouvent ce qu'ils ont ajouté. */
  viewerId?: string | undefined;
}) {
  const { filters, setFilters, resetFilters } = useProspectFilters();

  const {
    data: reference,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const removeAdvanced = useCallback(
    (key: AdvancedFilterKey) => {
      const patch: Partial<Record<AdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearAdvancedFilters(PROSPECT_ADVANCED_KEYS));
  }, [setFilters]);

  const activeCount = countActiveFilters(filters);
  const chips = buildAdvancedChips(filters, reference, PROSPECT_ADVANCED_KEYS);

  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => {
          void refetch();
        }}
        fallback="Les listes de filtre n’ont pas pu être chargées."
        className="animate-rise items-center gap-3 border-destructive/30 px-6 py-8 text-center"
      />
    );
  }

  if (isPending) return <FiltersBarSkeleton />;

  return (
    <section
      aria-label="Filtres"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      {/* Projet, statut, segment, représentant, banque, syndicat, département,
          résultat de l'appel et méthode se filtrent depuis l'en-tête de leur
          colonne : ne restent ici que les critères qu'aucune colonne ne porte. */}
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Nom, téléphone, représentant…"
          className="sm:max-w-md"
        />

        {viewerId === undefined ? null : (
          <BoutonMesFiches
            actif={filters.commercialId === viewerId}
            onBasculer={(actif) => {
              setFilters({ commercialId: actif ? viewerId : null });
            }}
          />
        )}
      </div>

      {/* ─── Filtrage avancé ────────────────────────────────────────────── */}
      <AdvancedPanel
        module="prospects"
        startCollapsed={startCollapsed}
        chips={chips}
        onRemove={removeAdvanced}
        onClearAll={clearAdvanced}
        actions={
          activeCount > 0 ? (
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcwIcon aria-hidden="true" />
              Tout effacer
            </Button>
          ) : null
        }
      >
        <>
          <DatePicker
            id="prospects-date-from"
            label="Saisi à partir du"
            value={filters.dateFrom}
            max={filters.dateTo}
            onChange={(dateFrom) => {
              setFilters({ dateFrom });
            }}
          />
          <DatePicker
            id="prospects-date-to"
            label="Jusqu’au"
            value={filters.dateTo}
            min={filters.dateFrom}
            onChange={(dateTo) => {
              setFilters({ dateTo });
            }}
          />
          {/* Tous les comptes, pas les seuls téléconseillers : l'accueil, le
              chargé de clientèle et l'admin créent aussi des fiches. La colonne
              « Téléconseiller » montre le titulaire, pas l'auteur de la saisie :
              le critère n'a donc pas d'en-tête où se poser. */}
          {reference.utilisateurs.length === 0 ? null : (
            <FilterCombobox
              label="Ajoutée par"
              placeholder="Tous les utilisateurs"
              options={reference.utilisateurs}
              value={filters.commercialId}
              onChange={(value) => {
                setFilters({ commercialId: value });
              }}
            />
          )}
          <FilterCombobox
            label="Revue de la demande"
            placeholder="Toutes les demandes"
            options={REVUE_OPTIONS}
            value={revueValue(filters.revue)}
            onChange={(value) => {
              setFilters({ revue: value === null ? null : value === 'oui' });
            }}
          />
        </>
      </AdvancedPanel>
    </section>
  );
}

function BoutonMesFiches({
  actif,
  onBasculer,
}: {
  actif: boolean;
  onBasculer: (actif: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant={actif ? 'default' : 'outline'}
      aria-pressed={actif}
      className="min-h-11"
      onClick={() => {
        onBasculer(!actif);
      }}
    >
      Mes fiches
    </Button>
  );
}

export function FiltersBarSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-11 min-w-[15rem] flex-1" />
        <Skeleton className="h-11 min-w-[13rem] flex-1" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-40" />
      </div>
      <Skeleton className="h-9 w-44" />
    </section>
  );
}
