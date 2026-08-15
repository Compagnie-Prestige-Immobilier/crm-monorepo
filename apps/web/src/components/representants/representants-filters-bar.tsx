'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';

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
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  clearRepresentantAdvancedFilters,
  countActiveRepresentantFilters,
  REPRESENTANT_SORT_FIELDS,
  REPRESENTANT_SORT_LABELS,
  type RepresentantAdvancedFilterKey,
  type RepresentantFilters,
  type RepresentantSortField,
} from '@/lib/representant-filters';
import type { SortDirection } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';

/**
 * Barre de filtre des représentants.
 *
 * Quatre critères visibles (recherche, département, IEF, téléconseiller) et
 * trois repliés : la période de première saisie et la présence de prospects
 * répondent à une question ponctuelle, « qui dort depuis janvier ? ». Le tri
 * accompagne ces trois-là dans le panneau sans être compté : il ne restreint
 * aucune population, une puce « Tri : Nom » ferait croire à un filtre.
 *
 * L'état vit dans l'URL (`useRepresentantFilters`) : la vue filtrée se colle
 * dans un message et se recharge à l'identique.
 */
export function RepresentantsFiltersBar() {
  const { filters, setFilters, resetFilters } = useRepresentantFilters();
  const sortId = useId();
  const orderId = useId();
  const presenceId = useId();

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  // Recherche appliquée après une pause de frappe : écrire directement dans
  // l'URL relancerait une requête à chaque caractère.
  const [searchDraft, setSearchDraft] = useState(filters.search);
  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);
  const debouncedSearch = useDebouncedValue(searchDraft);
  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

  const removeAdvanced = useCallback(
    (key: RepresentantAdvancedFilterKey) => {
      // `Record<…, null>` plutôt qu'une clé calculée nue : le littéral
      // `{ [key]: null }` s'infère en `{ [x: string]: null }`, que
      // `Partial<RepresentantFilters>` accepterait sans vérifier le nom.
      const patch: Partial<Record<RepresentantAdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch satisfies Partial<RepresentantFilters>);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearRepresentantAdvancedFilters());
  }, [setFilters]);

  const activeCount = countActiveRepresentantFilters(filters);
  const chips = buildChips(filters);

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

        <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5">
          <FilterCombobox
            label="Département"
            placeholder="Tous les départements"
            value={filters.departementId}
            options={(reference?.departements ?? []).map((departement) => ({
              value: departement.id,
              label: departement.name,
            }))}
            onChange={(value) => {
              // L'IEF choisie n'appartient qu'à un département : la garder après
              // un changement de département donnerait une liste vide sans que
              // rien à l'écran n'explique pourquoi.
              setFilters({ departementId: value, iefId: null });
            }}
          />
        </div>

        <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5">
          <FilterCombobox
            label="IEF"
            placeholder="Toutes les IEF"
            value={filters.iefId}
            options={(reference?.iefs ?? [])
              // Restreintes au département choisi. Proposer les 59 IEF du pays
              // alors que le département est déjà filtré ferait chercher dans
              // cinquante-huit entrées hors sujet.
              .filter((ief) =>
                filters.departementId === null ? true : ief.departementId === filters.departementId,
              )
              .map((ief) => ({
                value: ief.id,
                label: ief.name,
                // Le département en indice : « Bignona 1 » et « Bignona 2 » ne
                // se distinguent que par lui, et quatre IEF partagent Dakar.
                hint: ief.departementName,
              }))}
            onChange={(value) => {
              setFilters({ iefId: value });
            }}
          />
        </div>

        <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5">
          <FilterCombobox
            label="Téléconseiller"
            placeholder="Tous les téléconseillers"
            value={filters.commercialId}
            options={reference?.commerciaux ?? []}
            onChange={(value) => {
              setFilters({ commercialId: value });
            }}
          />
        </div>
      </div>

      {/* ─── Filtrage avancé ────────────────────────────────────────────── */}
      <AdvancedPanel
        module="representants"
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
              value={presenceValue(filters.hasProspects)}
              onValueChange={(value) => {
                setFilters({ hasProspects: presenceFromValue(value) });
              }}
            >
              <SelectTrigger id={presenceId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous</SelectItem>
                <SelectItem value="oui">Au moins un</SelectItem>
                <SelectItem value="non">Aucun</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={sortId}>Trier par</Label>
            <Select
              value={filters.sortBy}
              onValueChange={(value) => {
                setFilters({ sortBy: value as RepresentantSortField });
              }}
            >
              <SelectTrigger id={sortId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPRESENTANT_SORT_FIELDS.map((field) => (
                  <SelectItem key={field} value={field}>
                    {REPRESENTANT_SORT_LABELS[field]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={orderId}>Sens</Label>
            <Select
              value={filters.sortDir}
              onValueChange={(value) => {
                setFilters({ sortDir: value as SortDirection });
              }}
            >
              <SelectTrigger id={orderId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Décroissant</SelectItem>
                <SelectItem value="asc">Croissant</SelectItem>
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

/**
 * Puces de rappel des critères repliés.
 *
 * Les dates portent une puce CHACUNE plutôt qu'une puce « période » : c'est la
 * seule forme qui permet de retirer une borne sans perdre l'autre, et une
 * période à moitié posée est un cas courant (« depuis janvier », sans fin).
 */
function buildChips(
  filters: RepresentantFilters,
): AdvancedChipItem<RepresentantAdvancedFilterKey>[] {
  const chips: AdvancedChipItem<RepresentantAdvancedFilterKey>[] = [];

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
