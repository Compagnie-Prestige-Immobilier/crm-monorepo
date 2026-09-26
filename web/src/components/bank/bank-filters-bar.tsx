'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useId, useState } from 'react';

import { buildBankAdvancedChips } from '@/components/bank/bank-advanced-chips';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { AdvancedPanel } from '@/components/filters/advanced-panel';
import { BoutonFiltres, classeRepliable } from '@/components/filters/bouton-filtres';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  activeQuickView,
  BANK_QUICK_VIEWS,
  clearBankAdvancedFilters,
  countActiveBankFilters,
  quickViewPatch,
  type BankAdvancedFilterKey,
  type BankCaseFilters,
  type BankQuickView,
} from '@/lib/bank-filters';
import { fetchBankStages, fetchRejectionReasons, initialStage } from '@/lib/data/bank-cases';
import { fetchBanques } from '@/lib/data/reference';
import { withRetired } from '@/lib/format';
import { parseMoneyInput } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption, Projet } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { cn } from '@/lib/utils';

const PROJET_OPTIONS: readonly FilterOption[] = [
  { value: 'TOUS', label: 'Tous' },
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

function optionsOrEmpty<T>(data: readonly T[] | undefined): readonly T[] {
  return data ?? [];
}

function moneyFieldValue(value: string | null): string {
  return value ?? '';
}

function stageComboOptions(
  stages: readonly { id: string; label: string; isActive: boolean }[],
): { value: string; label: string; hint: string | undefined }[] {
  return stages.map((stage) => ({
    value: stage.id,
    label: stage.label,
    hint: stage.isActive ? undefined : 'désactivée',
  }));
}

function BankQuickViewButtons({
  currentView,
  onSelect,
}: {
  currentView: BankQuickView;
  onSelect: (viewId: BankQuickView) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Vues rapides">
      {BANK_QUICK_VIEWS.map((view) => (
        <BankQuickViewButton
          key={view.id}
          view={view}
          active={currentView === view.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function BankQuickViewButton({
  view,
  active,
  onSelect,
}: {
  view: { id: BankQuickView; label: string };
  active: boolean;
  onSelect: (viewId: BankQuickView) => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      aria-pressed={active}
      className="tap-target"
      onClick={() => {
        onSelect(view.id);
      }}
    >
      {view.label}
    </Button>
  );
}

export function BankFiltersBar({
  agentOptions = [],
  colonnesFiltrables = false,
}: {
  agentOptions?: readonly FilterOption[] | undefined;
  /**
   * L'écran affiche le tableau des dossiers : banque et étape s'y filtrent
   * depuis l'en-tête. Le tableau de bord et l'export n'ont pas de colonne où
   * les poser, et les gardent ici.
   */
  colonnesFiltrables?: boolean | undefined;
}) {
  const { filters, setFilters, resetFilters } = useBankFilters();
  const minId = useId();
  const maxId = useId();
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const stages = useQuery({
    queryKey: queryKeys.bankStages(true),
    queryFn: () => fetchBankStages(true),
    staleTime: 5 * 60_000,
  });
  const banques = useQuery({
    queryKey: queryKeys.banques,
    queryFn: () => fetchBanques(),
    staleTime: 5 * 60_000,
  });
  const reasons = useQuery({
    queryKey: queryKeys.bankRejectionReasons,
    queryFn: () => fetchRejectionReasons(),
    staleTime: 5 * 60_000,
  });

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const removeAdvanced = useCallback(
    (key: BankAdvancedFilterKey) => {
      const patch: Partial<Record<BankAdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch satisfies Partial<BankCaseFilters>);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearBankAdvancedFilters());
  }, [setFilters]);

  if (stages.isError) {
    return (
      <QueryErrorState
        error={stages.error}
        onRetry={() => {
          void stages.refetch();
        }}
        fallback="Les étapes du flux n’ont pas pu être chargées."
        className="animate-rise items-center gap-3 border-destructive/30 px-6 py-8 text-center"
      />
    );
  }

  if (stages.isPending) return <BankFiltersBarSkeleton />;

  function stageId(stage: { id: string } | undefined): string | null {
    return stage?.id ?? null;
  }

  const initial = initialStage(stages.data);
  const initialId = stageId(initial);
  const currentView = activeQuickView(filters, initialId);
  const activeCount = countActiveBankFilters(filters);

  const banqueOptions: FilterOption[] = optionsOrEmpty(banques.data).map((banque) => ({
    value: banque.id,
    label: withRetired(banque.shortName ?? '', banque.isActive ?? false),
    hint: banque.name ?? undefined,
  }));
  const reasonOptions: FilterOption[] = optionsOrEmpty(reasons.data).map((reason) => ({
    value: reason.id,
    label: reason.label,
  }));

  const chips = buildBankAdvancedChips(filters, {
    banques: banqueOptions,
    agents: agentOptions,
    reasons: reasonOptions,
  });
  const repliable = classeRepliable(filtresOuverts);

  return (
    <section
      aria-label="Filtres des dossiers"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      {/* Vues rapides. `role="group"` et non `tablist` : ce ne sont pas des
          onglets : rien n'est masqué, ils écrivent un filtre dans l'URL, et
          `aria-pressed` décrit exactement cet état. */}
      <BankQuickViewButtons
        currentView={currentView}
        onSelect={(viewId) => {
          setFilters(quickViewPatch(viewId, initialId));
        }}
      />

      <BoutonFiltres
        ouverts={filtresOuverts}
        actifs={activeCount}
        className="self-start"
        onBasculer={() => {
          setFiltresOuverts(!filtresOuverts);
        }}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className={repliable}>
          <FilterCombobox
            label="Projet"
            placeholder="Tous les projets"
            options={PROJET_OPTIONS}
            value={filters.projet ?? 'TOUS'}
            onChange={(value) => {
              const nextProjet: Projet | null =
                value === 'CHUES' || value === 'GRAND_PUBLIC' ? value : null;
              setFilters({ projet: nextProjet });
            }}
          />
        </div>

        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Référence, nom du client, téléphone…"
        />

        {/* L'étape est la question posée à chaque session, celle que les vues
            rapides écrivent aussi. Sous 1024 px des cartes remplacent le
            tableau : elle revient alors même là où l'en-tête la porte. */}
        <div className={repliable}>
          <div
            className={cn(
              'flex min-w-[13rem] flex-1 flex-col gap-1.5',
              colonnesFiltrables && 'lg:hidden',
            )}
          >
            <FilterCombobox
              label="Étape"
              placeholder="Toutes les étapes"
              options={stageComboOptions(stages.data)}
              value={filters.stageId}
              onChange={(value) => {
                setFilters({ stageId: value, stageType: null });
              }}
            />
          </div>

          <DatePicker
            id="bank-cases-date-from"
            label="Créé à partir du"
            value={filters.dateFrom}
            max={filters.dateTo}
            onChange={(dateFrom) => {
              setFilters({ dateFrom });
            }}
          />
          <DatePicker
            id="bank-cases-date-to"
            label="Jusqu’au"
            value={filters.dateTo}
            min={filters.dateFrom}
            onChange={(dateTo) => {
              setFilters({ dateTo });
            }}
          />
        </div>
      </div>

      <div className={repliable}>
        <AdvancedPanel
          module="dossiers"
          chips={chips}
          onRemove={removeAdvanced}
          onClearAll={clearAdvanced}
          actions={
            activeCount > 0 ? (
              <>
                <Badge variant="secondary">
                  {activeCount} filtre{activeCount > 1 ? 's' : ''}
                </Badge>
                <Button variant="ghost" onClick={resetFilters}>
                  <RotateCcwIcon aria-hidden="true" />
                  Tout effacer
                </Button>
              </>
            ) : null
          }
        >
          <>
            <div className={cn('contents', colonnesFiltrables && 'lg:hidden')}>
              <FilterCombobox
                label="Banque de traitement"
                placeholder="Toutes les banques"
                options={banqueOptions}
                value={filters.banqueId}
                onChange={(value) => {
                  setFilters({ banqueId: value });
                }}
              />
            </div>
            <FilterCombobox
              label="Agent"
              placeholder="Tous les agents"
              options={agentOptions}
              value={filters.agentId}
              onChange={(value) => {
                setFilters({ agentId: value });
              }}
            />
            <FilterCombobox
              label="Motif de rejet"
              placeholder="Tous les motifs"
              options={reasonOptions}
              value={filters.rejectionReasonId}
              onChange={(value) => {
                setFilters({ rejectionReasonId: value });
              }}
            />

            {/* Bornes de montant : `inputMode="numeric"` et non `type="number"`.
              Un champ numérique HTML transforme la valeur en `number` côté DOM,
              ce qui réintroduit exactement la perte de précision que le contrat
              évite en exposant les montants en chaîne. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={minId}>Montant minimum (FCFA)</Label>
              <Input
                id={minId}
                inputMode="numeric"
                autoComplete="off"
                value={moneyFieldValue(filters.amountMin)}
                placeholder="0"
                onChange={(event) => {
                  setFilters({ amountMin: parseMoneyInput(event.target.value) });
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={maxId}>Montant maximum (FCFA)</Label>
              <Input
                id={maxId}
                inputMode="numeric"
                autoComplete="off"
                value={moneyFieldValue(filters.amountMax)}
                placeholder="Sans limite"
                onChange={(event) => {
                  setFilters({ amountMax: parseMoneyInput(event.target.value) });
                }}
              />
            </div>
          </>
        </AdvancedPanel>
      </div>
    </section>
  );
}

export function BankFiltersBarSkeleton({ className }: { className?: string | undefined }) {
  return (
    <section
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm',
        className,
      )}
    >
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-11 w-24" />
        ))}
      </div>
      {/* Le squelette décrit la barre REPLIÉE, celle qui sera peinte : quatre
          champs visibles et le bouton du panneau. Dessiner huit cases ferait
          sauter la moitié de l'écran au moment du chargement. */}
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
