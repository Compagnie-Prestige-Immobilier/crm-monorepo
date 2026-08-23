'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback } from 'react';

import { AdvancedPanel, type AdvancedChipItem } from '@/components/filters/advanced-panel';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useRepCampaignFilters } from '@/components/phase2/use-rep-campaign-filters';
import { Button } from '@/components/ui/button';
import { fetchUsers } from '@/lib/data/users';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  clearRepCampaignAdvancedFilters,
  countActiveRepCampaignFilters,
  type RepCampaignAdvancedFilterKey,
  type RepCampaignFilters,
} from '@/lib/rep-campaign-filters';
import type { CampaignStatus, FilterOption } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

const STATUS_TABS: readonly { value: 'TOUTES' | CampaignStatus; label: string }[] = [
  { value: 'TOUTES', label: 'Toutes' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'CLOSED', label: 'Clôturées' },
];

export function RepCampaignsFiltersBar() {
  const { filters, setFilters, resetFilters } = useRepCampaignFilters();

  const { data: creators } = useQuery({
    queryKey: queryKeys.commerciaux({ ...EMPTY_USER_FILTERS, role: 'ADMIN', pageSize: 100 }),
    queryFn: () => fetchUsers({ ...EMPTY_USER_FILTERS, role: 'ADMIN', pageSize: 100 }),
    staleTime: 5 * 60_000,
  });

  const creatorOptions: FilterOption[] = (creators?.items ?? []).map((user) => ({
    value: user.id,
    label: user.fullName,
  }));

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const removeAdvanced = useCallback(
    (key: RepCampaignAdvancedFilterKey) => {
      const patch: Partial<Record<RepCampaignAdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch satisfies Partial<RepCampaignFilters>);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearRepCampaignAdvancedFilters());
  }, [setFilters]);

  const activeCount = countActiveRepCampaignFilters(filters);
  const chips = buildChips(filters, creatorOptions);

  return (
    <section
      aria-label="Filtres des campagnes représentants"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField value={searchDraft} onChange={setSearchDraft} placeholder="Nom de campagne…" />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
          {STATUS_TABS.map((tab) => {
            const isActive = (filters.status ?? 'TOUTES') === tab.value;
            return (
              <Button
                key={tab.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                aria-pressed={isActive}
                className="tap-target"
                onClick={() => {
                  setFilters({ status: tab.value === 'TOUTES' ? null : tab.value });
                }}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      <AdvancedPanel
        module="campagnes-representants"
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
          <FilterCombobox
            label="Créée par"
            placeholder="Tous les créateurs"
            options={creatorOptions}
            value={filters.createdById}
            onChange={(value) => {
              setFilters({ createdById: value });
            }}
          />
          <DatePicker
            id="rep-campagnes-date-from"
            label="Créée à partir du"
            value={filters.dateFrom}
            max={filters.dateTo}
            onChange={(dateFrom) => {
              setFilters({ dateFrom });
            }}
          />
          <DatePicker
            id="rep-campagnes-date-to"
            label="Jusqu’au"
            value={filters.dateTo}
            min={filters.dateFrom}
            onChange={(dateTo) => {
              setFilters({ dateTo });
            }}
          />
        </div>
      </AdvancedPanel>
    </section>
  );
}

function buildChips(
  filters: RepCampaignFilters,
  creators: readonly FilterOption[],
): AdvancedChipItem<RepCampaignAdvancedFilterKey>[] {
  const chips: AdvancedChipItem<RepCampaignAdvancedFilterKey>[] = [];

  if (filters.createdById !== null) {
    const match = creators.find((creator) => creator.value === filters.createdById);
    chips.push({
      key: 'createdById',
      field: 'Créée par',
      value: match?.label ?? 'Valeur inconnue',
    });
  }
  if (filters.dateFrom !== null) {
    chips.push({
      key: 'dateFrom',
      field: 'Créée à partir du',
      value: formatDate(filters.dateFrom),
    });
  }
  if (filters.dateTo !== null) {
    chips.push({ key: 'dateTo', field: 'Jusqu’au', value: formatDate(filters.dateTo) });
  }

  return chips;
}
