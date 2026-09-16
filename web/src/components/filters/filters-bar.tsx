'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

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
import { clearAdvancedFilters, countActiveFilters, type AdvancedFilterKey } from '@/lib/filters';
import { withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  BDD_SEGMENTS,
  ENROLLMENT_METHOD_LABELS,
  ENROLLMENT_METHOD_ORDER,
  PHASE2_STATUSES,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type BddSegment,
  type EnrollmentMethod,
  type FilterOption,
  type Phase2Status,
  type Projet,
  type ProspectStatut,
} from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';

const PROJET_OPTIONS: FilterOption[] = [
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

const STATUT_OPTIONS: FilterOption[] = PROSPECT_STATUTS.map((statut) => ({
  value: statut,
  label: PROSPECT_STATUT_LABELS[statut],
}));

const SEGMENT_OPTIONS: FilterOption[] = BDD_SEGMENTS.map((segment) => ({
  value: segment,
  label: SEGMENT_LABELS[segment],
}));

const PHASE2_STATUS_OPTIONS: FilterOption[] = PHASE2_STATUSES.map((status) => ({
  value: status,
  label: PHASE2_STATUS_LABELS[status],
}));

const METHOD_OPTIONS: FilterOption[] = ENROLLMENT_METHOD_ORDER.map((method) => ({
  value: method,
  label: ENROLLMENT_METHOD_LABELS[method],
}));

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
  const [regionDraft, setRegionDraft] = useState<string | null>(null);

  const removeAdvanced = useCallback(
    (key: AdvancedFilterKey) => {
      const patch: Partial<Record<AdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearAdvancedFilters());
  }, [setFilters]);

  const activeCount = countActiveFilters(filters);
  const chips = buildAdvancedChips(filters, reference);

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

  const regionId =
    reference.departements.find((departement) => departement.id === filters.departementId)
      ?.regionId ?? regionDraft;

  return (
    <section
      aria-label="Filtres"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      {/* ─── Filtrage simple ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Nom, téléphone, représentant…"
        />

        <div className="flex min-w-[11rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
          <FilterCombobox
            label="Projet"
            placeholder="Tous les projets"
            options={PROJET_OPTIONS}
            value={filters.projet}
            onChange={(value) => {
              setFilters({ projet: (value as Projet) || null });
            }}
          />
        </div>

        {/* Le seul critère de liste resté visible : c'est celui qu'on change
            à chaque session, quand on regarde le travail d'une personne. Vide
            pour qui n'a pas le droit de lister les comptes : il ne voit que ses fiches.
            Tous les comptes, pas les seuls téléconseillers : l'accueil, le
            chargé de clientèle et l'admin créent aussi des fiches. */}
        {reference.utilisateurs.length === 0 ? null : (
          <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
            <FilterCombobox
              label="Ajoutée par"
              placeholder="Tous les utilisateurs"
              options={reference.utilisateurs}
              value={filters.commercialId}
              onChange={(value) => {
                setFilters({ commercialId: value });
              }}
            />
          </div>
        )}
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
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
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
          <FilterCombobox
            label="Représentant"
            placeholder="Tous les représentants"
            options={reference.representants}
            value={filters.representantId}
            onChange={(value) => {
              setFilters({ representantId: value });
            }}
          />
          <FilterCombobox
            label="Région"
            placeholder="Toutes les régions"
            options={reference.regions.map((region) => ({
              value: region.id,
              label: region.name,
            }))}
            value={regionId}
            onChange={(value) => {
              setRegionDraft(value);
              if (filters.departementId === null) return;
              setFilters({ departementId: null });
            }}
          />
          <FilterCombobox
            label="Département"
            placeholder="Tous les départements"
            options={reference.departements
              .filter((d) => regionId === null || d.regionId === regionId)
              .map((d) => ({
                value: d.id,
                label: withRetired(d.name, d.isActive),
                hint: d.regionName,
              }))}
            value={filters.departementId}
            onChange={(value) => {
              setFilters({ departementId: value });
            }}
          />
          <FilterCombobox
            label="Banque"
            placeholder="Toutes les banques"
            options={reference.banques.map((b) => ({
              value: b.id,
              label: withRetired(b.shortName, b.isActive),
              hint: b.name,
            }))}
            value={filters.banqueId}
            onChange={(value) => {
              setFilters({ banqueId: value });
            }}
          />
          <FilterCombobox
            label="Syndicat"
            placeholder="Tous les syndicats"
            options={reference.syndicats.map((s) => ({
              value: s.id,
              label: withRetired(s.sigle, s.isActive),
              hint: s.secteur ?? undefined,
            }))}
            value={filters.syndicatId}
            onChange={(value) => {
              setFilters({ syndicatId: value });
            }}
          />
          <FilterCombobox
            label="Statut"
            placeholder="Tous les statuts"
            options={STATUT_OPTIONS}
            value={filters.statut}
            onChange={(value) => {
              setFilters({ statut: value as ProspectStatut | null });
            }}
          />

          {/* ─── Ce que l'appel a donné ───────────────────────────────────
                Ces cinq critères vivent dans le MÊME objet de filtre que les
                précédents. C'est ce qui garantit qu'un lien « BDD2, méthode
                obtenue, IEF de Thiès » rouvre le tableau, les graphiques ET
                l'export sur exactement la même population. Un second état de
                filtre, même bien synchronisé, finirait par produire un classeur
                qui ne correspond pas à l'écran d'où il a été demandé. */}
          <FilterCombobox
            label="Groupe (syndicat × banque)"
            placeholder="Tous les groupes"
            options={SEGMENT_OPTIONS}
            value={filters.segment}
            onChange={(value) => {
              setFilters({ segment: value as BddSegment | null });
            }}
          />
          <FilterCombobox
            label="Résultat de l’appel"
            placeholder="Tous les résultats"
            options={PHASE2_STATUS_OPTIONS}
            value={filters.phase2Status}
            onChange={(value) => {
              setFilters({ phase2Status: value as Phase2Status | null });
            }}
          />
          <FilterCombobox
            label="Comment il a adhéré"
            placeholder="Toutes les manières"
            options={METHOD_OPTIONS}
            value={filters.enrollmentMethod}
            onChange={(value) => {
              setFilters({ enrollmentMethod: value as EnrollmentMethod | null });
            }}
          />
          {reference.utilisateurs.length === 0 ? null : (
            <FilterCombobox
              label="Adhésion obtenue par"
              placeholder="Tous les utilisateurs"
              options={reference.utilisateurs}
              value={filters.enrollmentCapturedById}
              onChange={(value) => {
                setFilters({ enrollmentCapturedById: value });
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
        </div>
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
