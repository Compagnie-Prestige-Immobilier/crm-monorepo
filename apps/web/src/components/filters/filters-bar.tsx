'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon, SearchIcon } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { FilterCombobox } from '@/components/filters/filter-combobox';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { Badge } from '@/components/ui/badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchReferenceData } from '@/lib/data/reference';
import { countActiveFilters } from '@/lib/filters';
import { withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  BDD_SEGMENTS,
  ENROLLMENT_METHODS,
  ENROLLMENT_METHOD_LABELS,
  PHASE2_STATUSES,
  PHASE2_STATUS_LABELS,
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  SEGMENT_LABELS,
  type BddSegment,
  type EnrollmentMethod,
  type FilterOption,
  type Phase2Status,
  type ProspectStatut,
} from '@/lib/types';

const STATUT_OPTIONS: FilterOption[] = PROSPECT_STATUTS.map((statut) => ({
  value: statut,
  label: PROSPECT_STATUT_LABELS[statut],
}));

/**
 * Le libellé complet (« BDD1 — CHUES / CBAO ») est repris tel quel du
 * référentiel partagé : c'est celui des onglets du classeur consolidé. Le
 * raccourcir ici obligerait à traduire mentalement entre l'écran et Excel.
 */
const SEGMENT_OPTIONS: FilterOption[] = BDD_SEGMENTS.map((segment) => ({
  value: segment,
  label: SEGMENT_LABELS[segment],
}));

const PHASE2_STATUS_OPTIONS: FilterOption[] = PHASE2_STATUSES.map((status) => ({
  value: status,
  label: PHASE2_STATUS_LABELS[status],
}));

const METHOD_OPTIONS: FilterOption[] = ENROLLMENT_METHODS.map((method) => ({
  value: method,
  label: ENROLLMENT_METHOD_LABELS[method],
}));

export function FiltersBar() {
  const { filters, setFilters, resetFilters } = useProspectFilters();
  const searchId = useId();
  const fromId = useId();
  const toId = useId();

  const {
    data: reference,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.reference,
    // Fonction fléchée obligatoire : passer `fetchReferenceData` directement
    // livrerait le QueryFunctionContext de TanStack en premier argument, là où
    // la couche de données attend un client d'API.
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  // Le champ texte est piloté localement puis synchronisé à l'URL après une
  // pause de frappe : écrire directement dans l'URL relancerait une requête à
  // chaque caractère.
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = setTimeout(() => {
      setFilters({ search: searchDraft });
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchDraft, filters.search, setFilters]);

  const activeCount = countActiveFilters(filters);

  // Sans cette branche, un échec du chargement des référentiels laissait la
  // barre en squelette permanent : les filtres devenaient inatteignables sans
  // qu'aucun message n'explique pourquoi.
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <Label htmlFor={searchId}>Recherche</Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={searchDraft}
              onChange={(event) => {
                setSearchDraft(event.target.value);
              }}
              placeholder="Nom, téléphone, représentant…"
              className="pl-9"
            />
          </div>
        </div>

        {activeCount > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {activeCount} filtre{activeCount > 1 ? 's' : ''}
            </Badge>
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcwIcon aria-hidden="true" />
              Réinitialiser
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FilterCombobox
          label="Commercial"
          placeholder="Tous les commerciaux"
          options={reference.commerciaux}
          value={filters.commercialId}
          onChange={(value) => {
            setFilters({ commercialId: value });
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
          label="Département"
          placeholder="Tous les départements"
          options={reference.departements.map((d) => ({
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

        {/* ─── Phase 2 ────────────────────────────────────────────────────
            Ces cinq critères vivent dans le MÊME objet de filtre que les six
            précédents. C'est ce qui garantit qu'un lien « BDD2, méthode
            obtenue, campagne d'avril » rouvre le tableau, les graphiques ET
            l'export sur exactement la même population. Un second état de
            filtre, même bien synchronisé, finirait par produire un classeur
            qui ne correspond pas à l'écran d'où il a été demandé. */}
        <FilterCombobox
          label="Segment BDD"
          placeholder="Tous les segments"
          options={SEGMENT_OPTIONS}
          value={filters.segment}
          onChange={(value) => {
            setFilters({ segment: value as BddSegment | null });
          }}
        />
        <FilterCombobox
          label="Statut phase 2"
          placeholder="Tous les statuts phase 2"
          options={PHASE2_STATUS_OPTIONS}
          value={filters.phase2Status}
          onChange={(value) => {
            setFilters({ phase2Status: value as Phase2Status | null });
          }}
        />
        <FilterCombobox
          label="Méthode d’enrôlement"
          placeholder="Toutes les méthodes"
          options={METHOD_OPTIONS}
          value={filters.enrollmentMethod}
          onChange={(value) => {
            setFilters({ enrollmentMethod: value as EnrollmentMethod | null });
          }}
        />
        <FilterCombobox
          label="Campagne d’appels"
          placeholder="Toutes les campagnes"
          options={reference.campagnes}
          value={filters.campaignId}
          onChange={(value) => {
            setFilters({ campaignId: value });
          }}
        />
        <FilterCombobox
          label="Méthode obtenue par"
          placeholder="Tous les commerciaux"
          options={reference.commerciaux}
          value={filters.enrollmentCapturedById}
          onChange={(value) => {
            setFilters({ enrollmentCapturedById: value });
          }}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fromId}>Saisi à partir du</Label>
          <Input
            id={fromId}
            type="date"
            value={filters.dateFrom ?? ''}
            max={filters.dateTo ?? undefined}
            onChange={(event) => {
              setFilters({ dateFrom: event.target.value === '' ? null : event.target.value });
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={toId}>Jusqu’au</Label>
          <Input
            id={toId}
            type="date"
            value={filters.dateTo ?? ''}
            min={filters.dateFrom ?? undefined}
            onChange={(event) => {
              setFilters({ dateTo: event.target.value === '' ? null : event.target.value });
            }}
          />
        </div>
      </div>
    </section>
  );
}

export function FiltersBarSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
