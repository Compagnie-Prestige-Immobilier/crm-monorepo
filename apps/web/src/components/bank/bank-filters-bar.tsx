'use client';

import { useQuery } from '@tanstack/react-query';
import { RotateCcwIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';

import { buildBankAdvancedChips } from '@/components/bank/bank-advanced-chips';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { AdvancedPanel } from '@/components/filters/advanced-panel';
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
} from '@/lib/bank-filters';
import { fetchBankStages, fetchRejectionReasons, initialStage } from '@/lib/data/bank-cases';
import { fetchBanques } from '@/lib/data/reference';
import { withRetired } from '@/lib/format';
import { parseMoneyInput } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

/**
 * Barre de filtre des dossiers bancaires.
 *
 * Les vues rapides ne sont PAS un second système de filtre : chacune écrit dans
 * le même objet, donc dans la même URL, et l'export les suit. « À traiter »
 * vise l'étape initiale : configurable, donc lue dans la configuration plutôt
 * que devinée d'un code en dur.
 *
 * Trois critères restent visibles (recherche, étape, période) et cinq passent
 * derrière « Filtres avancés » : les huit champs dépliés en permanence
 * repoussaient les dossiers, et sur le tableau de bord les chiffres, sous la
 * ligne de flottaison. Le compte, les puces et le démontage du panneau sont
 * tenus par `AdvancedPanel`, comme sur les prospects.
 */
export function BankFiltersBar({
  /** Options d'agent, dérivées des agrégats : `GET /users` est réservé à l'ADMIN. */
  agentOptions = [],
}: {
  agentOptions?: readonly FilterOption[] | undefined;
}) {
  const { filters, setFilters, resetFilters } = useBankFilters();
  const minId = useId();
  const maxId = useId();

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

  // Champ texte piloté localement puis synchronisé à l'URL après une pause de
  // frappe : écrire directement dans l'URL relancerait une requête à chaque
  // caractère, et l'API plafonne à 300 requêtes par minute.
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
    (key: BankAdvancedFilterKey) => {
      // `Record<BankAdvancedFilterKey, null>` plutôt qu'une clé calculée nue :
      // le littéral `{ [key]: null }` s'infère en `{ [x: string]: null }`, que
      // `Partial<BankCaseFilters>` accepterait sans vérifier le nom du champ.
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

  const initial = initialStage(stages.data);
  const currentView = activeQuickView(filters, initial?.id ?? null);
  const activeCount = countActiveBankFilters(filters);

  const banqueOptions: FilterOption[] = (banques.data ?? []).map((banque) => ({
    value: banque.id,
    label: withRetired(banque.shortName, banque.isActive),
    hint: banque.name,
  }));
  const reasonOptions: FilterOption[] = (reasons.data ?? []).map((reason) => ({
    value: reason.id,
    label: reason.label,
  }));

  const chips = buildBankAdvancedChips(filters, {
    banques: banqueOptions,
    agents: agentOptions,
    reasons: reasonOptions,
  });

  return (
    <section
      aria-label="Filtres des dossiers"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
    >
      {/* Vues rapides. `role="group"` et non `tablist` : ce ne sont pas des
          onglets : rien n'est masqué, ils écrivent un filtre dans l'URL, et
          `aria-pressed` décrit exactement cet état. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vues rapides">
        {BANK_QUICK_VIEWS.map((view) => {
          const isActive = currentView === view.id;
          return (
            <Button
              key={view.id}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              aria-pressed={isActive}
              className="tap-target"
              onClick={() => {
                setFilters(quickViewPatch(view.id, initial?.id ?? null));
              }}
            >
              {view.label}
            </Button>
          );
        })}
      </div>

      {/* ─── Filtrage simple ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Référence, nom du client, téléphone…"
        />

        <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5">
          {/* Le seul critère de liste resté visible : l'étape est la question
              posée à chaque session, celle que les vues rapides écrivent aussi. */}
          <FilterCombobox
            label="Étape"
            placeholder="Toutes les étapes"
            options={stages.data.map((stage) => ({
              value: stage.id,
              label: stage.label,
              hint: stage.isActive ? undefined : 'désactivée',
            }))}
            value={filters.stageId}
            onChange={(value) => {
              // Étape précise et type d'étape se contredisent : choisir l'une
              // efface l'autre, sinon « Encaissés » + « À traiter » renverrait
              // zéro ligne sans que rien n'explique pourquoi.
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

      {/* ─── Filtrage avancé ────────────────────────────────────────────── */}
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
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <FilterCombobox
            label="Banque de traitement"
            placeholder="Toutes les banques"
            options={banqueOptions}
            value={filters.banqueId}
            onChange={(value) => {
              setFilters({ banqueId: value });
            }}
          />
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
              value={filters.amountMin ?? ''}
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
              value={filters.amountMax ?? ''}
              placeholder="Sans limite"
              onChange={(event) => {
                setFilters({ amountMax: parseMoneyInput(event.target.value) });
              }}
            />
          </div>
        </div>
      </AdvancedPanel>
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
