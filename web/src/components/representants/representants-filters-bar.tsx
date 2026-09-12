'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { AdvancedPanel, type AdvancedChipItem } from '@/components/filters/advanced-panel';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useRepresentantFilters } from '@/components/representants/use-representant-filters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchStatutsQualification } from '@/lib/data/statuts-qualification';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  clearRepresentantAdvancedFilters,
  countActiveRepresentantFilters,
  REPRESENTANT_RELATION_CHOICES,
  REPRESENTANT_RELATION_LABELS,
  REPRESENTANT_SORT_FIELDS,
  REPRESENTANT_SORT_LABELS,
  type RepresentantRelation,
  type RepresentantAdvancedFilterKey,
  type RepresentantFilters,
  type RepresentantSortField,
} from '@/lib/representant-filters';
import type { SortDirection } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';

const PRESENCE_ITEMS = [
  { value: 'tous', label: 'Tous' },
  { value: 'oui', label: 'Au moins un' },
  { value: 'non', label: 'Aucun' },
];

const RELATION_ITEMS = [
  { value: 'tous', label: 'Tous' },
  ...REPRESENTANT_RELATION_CHOICES.map((relation) => ({
    value: relation,
    label: REPRESENTANT_RELATION_LABELS[relation],
  })),
];

const SORT_ITEMS: { value: RepresentantSortField; label: string }[] = REPRESENTANT_SORT_FIELDS.map(
  (field) => ({ value: field, label: REPRESENTANT_SORT_LABELS[field] }),
);

const DIRECTION_ITEMS: { value: SortDirection; label: string }[] = [
  { value: 'desc', label: 'Décroissant' },
  { value: 'asc', label: 'Croissant' },
];

type Referentiels = Awaited<ReturnType<typeof fetchReferenceData>> | undefined;

function departementsDe(reference: Referentiels) {
  return reference?.departements ?? [];
}

function regionsDe(reference: Referentiels) {
  return reference?.regions ?? [];
}

function iefsDe(reference: Referentiels) {
  return reference?.iefs ?? [];
}

function commerciauxDe(reference: Referentiels) {
  return reference?.commerciaux ?? [];
}

export function RepresentantsFiltersBar() {
  const { filters, setFilters, resetFilters } = useRepresentantFilters();
  const sortId = useId();
  const orderId = useId();
  const presenceId = useId();
  const relationId = useId();
  const statutId = useId();

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const { data: statuts } = useQuery({
    queryKey: queryKeys.statutsQualification,
    queryFn: () => fetchStatutsQualification(),
    staleTime: 5 * 60_000,
  });

  const statutItems = [
    { value: 'tous', label: 'Tous' },
    ...(statuts ?? []).map((statut) => ({ value: statut.id, label: statut.label })),
  ];

  const [regionDraft, setRegionDraft] = useState<string | null>(null);
  const departements = departementsDe(reference);
  const regionId =
    departements.find((departement) => departement.id === filters.departementId)?.regionId ??
    regionDraft;

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const removeAdvanced = useCallback(
    (key: RepresentantAdvancedFilterKey) => {
      const patch: Partial<Record<RepresentantAdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch satisfies Partial<RepresentantFilters>);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearRepresentantAdvancedFilters());
  }, [setFilters]);

  const activeCount = countActiveRepresentantFilters(filters);
  const chips = buildChips(filters, reference, statuts);

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
          placeholder="Nom ou téléphone…"
        />

        <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor={relationId}>Qualification</Label>
          <Select
            items={RELATION_ITEMS}
            value={filters.relationStatus ?? 'tous'}
            onValueChange={(value) => {
              if (value === null) return;
              setFilters({
                relationStatus: value === 'tous' ? null : (value as RepresentantRelation),
              });
            }}
          >
            <SelectTrigger id={relationId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATION_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Filtrage avancé ────────────────────────────────────────────── */}
      <AdvancedPanel
        module="representants"
        startCollapsed={true}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={statutId}>Statut de qualification</Label>
            <Select
              items={statutItems}
              value={filters.statutQualificationId ?? 'tous'}
              onValueChange={(value) => {
                if (value === null) return;
                setFilters({ statutQualificationId: value === 'tous' ? null : value });
              }}
            >
              <SelectTrigger id={statutId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statutItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <FilterCombobox
              label="Région"
              placeholder="Toutes les régions"
              value={regionId}
              options={regionsDe(reference).map((region) => ({
                value: region.id,
                label: region.name,
              }))}
              onChange={(value) => {
                setRegionDraft(value);
                if (filters.departementId === null && filters.iefId === null) return;
                setFilters({ departementId: null, iefId: null });
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FilterCombobox
              label="Département"
              placeholder="Tous les départements"
              value={filters.departementId}
              options={departements
                .filter((departement) => regionId === null || departement.regionId === regionId)
                .map((departement) => ({
                  value: departement.id,
                  label: departement.name,
                  hint: departement.regionName,
                }))}
              onChange={(value) => {
                setFilters({ departementId: value, iefId: null });
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FilterCombobox
              label="IEF"
              placeholder="Toutes les IEF"
              value={filters.iefId}
              options={iefsDe(reference)
                .filter((ief) =>
                  filters.departementId === null
                    ? true
                    : ief.departementId === filters.departementId,
                )
                .map((ief) => ({
                  value: ief.id,
                  label: ief.name,
                  hint: ief.departementName,
                }))}
              onChange={(value) => {
                setFilters({ iefId: value });
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FilterCombobox
              label="Téléconseiller"
              placeholder="Tous les téléconseillers"
              value={filters.commercialId}
              options={commerciauxDe(reference)}
              onChange={(value) => {
                setFilters({ commercialId: value });
              }}
            />
          </div>

          <DatePicker
            id="representants-date-from"
            label="Saisi à partir du"
            value={filters.dateFrom}
            max={filters.dateTo}
            onChange={(dateFrom) => {
              setFilters({ dateFrom });
            }}
          />
          <DatePicker
            id="representants-date-to"
            label="Jusqu’au"
            value={filters.dateTo}
            min={filters.dateFrom}
            onChange={(dateTo) => {
              setFilters({ dateTo });
            }}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={presenceId}>Prospects apportés</Label>
            <Select
              items={PRESENCE_ITEMS}
              value={presenceValue(filters.hasProspects)}
              onValueChange={(value) => {
                if (value === null) return;
                setFilters({ hasProspects: presenceFromValue(value) });
              }}
            >
              <SelectTrigger id={presenceId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESENCE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={sortId}>Trier par</Label>
            <Select
              items={SORT_ITEMS}
              value={filters.sortBy}
              onValueChange={(value) => {
                if (value === null) return;
                setFilters({ sortBy: value });
              }}
            >
              <SelectTrigger id={sortId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={orderId}>Sens</Label>
            <Select
              items={DIRECTION_ITEMS}
              value={filters.sortDir}
              onValueChange={(value) => {
                if (value === null) return;
                setFilters({ sortDir: value });
              }}
            >
              <SelectTrigger id={orderId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AdvancedPanel>
    </section>
  );
}

function presenceValue(hasProspects: boolean | null): string {
  if (hasProspects === null) return 'tous';
  return hasProspects ? 'oui' : 'non';
}

function presenceFromValue(value: string): boolean | null {
  if (value === 'oui') return true;
  if (value === 'non') return false;
  return null;
}

function buildChips(
  filters: RepresentantFilters,
  reference: Referentiels,
  statuts: readonly { id: string; label: string }[] | undefined,
): AdvancedChipItem<RepresentantAdvancedFilterKey>[] {
  const chips: AdvancedChipItem<RepresentantAdvancedFilterKey>[] = [];

  if (filters.relationStatus !== null) {
    chips.push({
      key: 'relationStatus',
      field: 'Qualification',
      value: REPRESENTANT_RELATION_LABELS[filters.relationStatus],
    });
  }
  if (filters.statutQualificationId !== null) {
    const statut = statuts?.find((s) => s.id === filters.statutQualificationId);
    chips.push({
      key: 'statutQualificationId',
      field: 'Statut de qualification',
      value: statut?.label ?? 'Sélectionné',
    });
  }
  if (filters.departementId !== null) {
    const dep = reference?.departements.find((d) => d.id === filters.departementId);
    chips.push({
      key: 'departementId',
      field: 'Département',
      value: dep?.name ?? 'Sélectionné',
    });
  }
  if (filters.iefId !== null) {
    const ief = reference?.iefs.find((i) => i.id === filters.iefId);
    chips.push({
      key: 'iefId',
      field: 'IEF',
      value: ief?.name ?? 'Sélectionné',
    });
  }
  if (filters.commercialId !== null) {
    const com = reference?.commerciaux.find((c) => c.value === filters.commercialId);
    chips.push({
      key: 'commercialId',
      field: 'Téléconseiller',
      value: com?.label ?? 'Sélectionné',
    });
  }
  if (filters.dateFrom !== null) {
    chips.push({
      key: 'dateFrom',
      field: 'Saisi à partir du',
      value: formatDate(filters.dateFrom),
    });
  }
  if (filters.dateTo !== null) {
    chips.push({ key: 'dateTo', field: 'Jusqu’au', value: formatDate(filters.dateTo) });
  }
  if (filters.hasProspects !== null) {
    chips.push({
      key: 'hasProspects',
      field: 'Prospects apportés',
      value: filters.hasProspects ? 'Au moins un' : 'Aucun',
    });
  }

  return chips;
}
