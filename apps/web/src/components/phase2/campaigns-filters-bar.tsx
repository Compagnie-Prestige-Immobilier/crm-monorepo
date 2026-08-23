'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback } from 'react';

import { AdvancedPanel, type AdvancedChipItem } from '@/components/filters/advanced-panel';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useCampaignFilters } from '@/components/phase2/use-campaign-filters';
import { Button } from '@/components/ui/button';
import {
  clearCampaignAdvancedFilters,
  countActiveCampaignFilters,
  type CampaignAdvancedFilterKey,
  type CampaignFilters,
} from '@/lib/campaign-filters';
import { fetchUsers } from '@/lib/data/users';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  CAMPAIGN_SCOPES,
  campaignScopeLabel,
  type CampaignScope,
  type CampaignStatus,
  type FilterOption,
} from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

const STATUS_TABS: readonly { value: 'TOUTES' | CampaignStatus; label: string }[] = [
  { value: 'TOUTES', label: 'Toutes' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'PAUSED', label: 'Suspendues' },
  { value: 'CLOSED', label: 'Clôturées' },
];

export function CampaignsFiltersBar({ projet = 'CHUES' }: { projet?: 'CHUES' | 'GRAND_PUBLIC' }) {
  const { filters, setFilters, resetFilters } = useCampaignFilters();

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
    (key: CampaignAdvancedFilterKey) => {
      const patch: Partial<Record<CampaignAdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch satisfies Partial<CampaignFilters>);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearCampaignAdvancedFilters());
  }, [setFilters]);

  const activeCount = countActiveCampaignFilters(filters);
  const chips = buildChips(filters, creatorOptions);
  const scopes = CAMPAIGN_SCOPES.filter(
    (scope) =>
      scope === 'ALL' ||
      (projet === 'GRAND_PUBLIC' ? scope.startsWith('GP') : scope.startsWith('BDD')),
  );

  return (
    <section
      aria-label="Filtres des campagnes"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <SearchField value={searchDraft} onChange={setSearchDraft} placeholder="Nom de campagne…" />

        {/* `role="group"` et non `tablist` : rien n'est masqué, ces boutons
            écrivent un filtre dans l'URL, et `aria-pressed` décrit exactement
            cet état. */}
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
        module="campagnes"
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
            label="Périmètre"
            placeholder="Tous les périmètres"
            options={scopes.map((scope) => ({
              value: scope,
              label: campaignScopeLabel(scope),
            }))}
            value={filters.scope}
            onChange={(value) => {
              setFilters({ scope: value as CampaignScope | null });
            }}
          />
          <FilterCombobox
            label="Créée par"
            placeholder="Tous les créateurs"
            options={creatorOptions}
            value={filters.createdBy}
            onChange={(value) => {
              setFilters({ createdBy: value });
            }}
          />
          <DatePicker
            id="campagnes-date-from"
            label="Créée à partir du"
            value={filters.dateFrom}
            max={filters.dateTo}
            onChange={(dateFrom) => {
              setFilters({ dateFrom });
            }}
          />
          <DatePicker
            id="campagnes-date-to"
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
  filters: CampaignFilters,
  creators: readonly FilterOption[],
): AdvancedChipItem<CampaignAdvancedFilterKey>[] {
  const chips: AdvancedChipItem<CampaignAdvancedFilterKey>[] = [];

  if (filters.scope !== null) {
    chips.push({ key: 'scope', field: 'Périmètre', value: campaignScopeLabel(filters.scope) });
  }
  if (filters.createdBy !== null) {
    const match = creators.find((creator) => creator.value === filters.createdBy);
    chips.push({ key: 'createdBy', field: 'Créée par', value: match?.label ?? 'Valeur inconnue' });
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
