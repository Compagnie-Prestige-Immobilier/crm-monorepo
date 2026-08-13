'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, RotateCcwIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { buildAdvancedChips } from '@/components/filters/advanced-chips';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { Badge } from '@/components/ui/badge';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  clearAdvancedFilters,
  countActiveFilters,
  countAdvancedFilters,
  initialAdvancedOpen,
  type AdvancedFilterKey,
} from '@/lib/filters';
import { withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
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

/**
 * La barre de filtre du tableau de bord et du tableau des prospects.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Trois critères visibles, dix repliés — et le repli ne cache jamais un
 * filtre actif.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les treize champs étaient empilés en permanence : la première chose visible
 * du tableau de bord était un formulaire, et les indicateurs commençaient sous
 * la ligne de flottaison. Restent donc à l'air libre la recherche, la période
 * et le téléconseiller ; les dix autres passent derrière « Filtres avancés ».
 *
 * Replier crée un risque que l'empilement n'avait pas : un critère resté actif
 * restreint la population sans qu'aucun champ visible ne le dise, et le
 * directeur lit un chiffre partiel en croyant lire le total. Le panneau replié
 * porte donc un COMPTE sur son bouton et une PUCE par critère, chacune
 * retirable sans rouvrir le panneau. Voir `advanced-chips.ts`.
 *
 * L'état d'ouverture est enregistré, mais l'URL l'emporte : un lien filtré
 * partagé ouvre le panneau, quelle que soit la préférence du destinataire
 * (`initialAdvancedOpen`).
 */

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

/**
 * Préférence d'ouverture du panneau.
 *
 * `localStorage` et non un cookie : la préférence n'a aucune raison de repartir
 * vers le serveur à chaque requête. Les accès sont protégés — un navigateur en
 * navigation privée stricte fait lever `localStorage`, et une barre de filtre
 * ne doit pas disparaître pour autant.
 */
const STORAGE_KEY = 'cpi.filtres-avances';

function readStoredOpen(): boolean | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}

function writeStoredOpen(open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    // Préférence perdue, écran intact. Il n'y a rien à signaler à l'utilisateur.
  }
}

export function FiltersBar() {
  const { filters, setFilters, resetFilters } = useProspectFilters();
  const panelId = useId();

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

  /**
   * Ouverture du panneau avancé.
   *
   * L'état initial se déduit de l'URL SEULE, identiquement sur le serveur et au
   * premier rendu client : lire `localStorage` dans le `useState` produirait
   * deux arbres différents et une erreur d'hydratation. La préférence est
   * appliquée juste après, une seule fois — la relire à chaque rendu
   * refermerait le panneau sous les doigts de l'utilisateur au moment où il
   * retire son dernier critère avancé.
   */
  const [advancedOpen, setAdvancedOpen] = useState(() => initialAdvancedOpen(filters, null));
  const preferenceApplied = useRef(false);

  useEffect(() => {
    if (preferenceApplied.current) return;
    preferenceApplied.current = true;
    setAdvancedOpen(initialAdvancedOpen(filters, readStoredOpen()));
  }, [filters]);

  const toggleAdvanced = useCallback(() => {
    setAdvancedOpen((open) => {
      writeStoredOpen(!open);
      return !open;
    });
  }, []);

  const removeAdvanced = useCallback(
    (key: AdvancedFilterKey) => {
      // `Record<AdvancedFilterKey, null>` plutôt qu'une clé calculée nue : le
      // littéral `{ [key]: null }` s'infère en `{ [x: string]: null }`, que
      // `Partial<ProspectFilters>` accepterait sans vérifier le nom du champ.
      const patch: Partial<Record<AdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch);
    },
    [setFilters],
  );

  const activeCount = countActiveFilters(filters);
  const advancedCount = countAdvancedFilters(filters);
  const chips = buildAdvancedChips(filters, reference);

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
      {/* ─── Filtrage simple ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder="Nom, téléphone, représentant…"
        />

        <div className="flex min-w-[13rem] flex-1 flex-col gap-1.5">
          {/* Le seul critère de liste resté visible : c'est celui qu'on change
              à chaque session, quand on regarde le travail d'une personne. */}
          <FilterCombobox
            label="Téléconseiller"
            placeholder="Tous les téléconseillers"
            options={reference.commerciaux}
            value={filters.commercialId}
            onChange={(value) => {
              setFilters({ commercialId: value });
            }}
          />
        </div>

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
      </div>

      {/* ─── Commandes ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={toggleAdvanced}
          aria-expanded={advancedOpen}
          aria-controls={panelId}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          Filtres avancés
          {/* Le compte porte sur les critères REPLIÉS, et sur eux seuls : ce
              sont les seuls qu'on ne voit pas. Compter aussi la recherche et la
              période mettrait un « 5 » sur un bouton qui n'en cache que trois. */}
          {advancedCount > 0 ? (
            <Badge variant="default" className="ml-1 tabular-nums">
              {advancedCount}
              <span className="sr-only">
                {' '}
                critère{advancedCount > 1 ? 's' : ''} replié{advancedCount > 1 ? 's' : ''}
              </span>
            </Badge>
          ) : null}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              'transition-transform duration-(--dur-1) ease-(--ease-out-cpi)',
              advancedOpen && 'rotate-180',
            )}
          />
        </Button>

        {/* Pas de seconde pastille « 3 filtres » à côté de celle du bouton :
            posées côte à côte, les deux comptes se lisaient comme une
            répétition, et rien n'indiquait qu'ils portent sur des ensembles
            différents. Les critères visibles se comptent à l'œil ; seuls les
            critères repliés méritaient un chiffre. */}
        {activeCount > 0 ? (
          <Button variant="ghost" onClick={resetFilters}>
            <RotateCcwIcon aria-hidden="true" />
            Tout effacer
          </Button>
        ) : null}
      </div>

      {/* ─── Rappel des critères repliés ────────────────────────────────────
          Affiché UNIQUEMENT panneau fermé : ouvert, chaque liste déroulante
          porte déjà sa valeur, et doubler l'information ferait relire deux
          fois la même chose. */}
      {!advancedOpen && chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-[0.75rem] text-muted-foreground">Filtres avancés actifs</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => {
                removeAdvanced(chip.key);
              }}
              aria-label={`Retirer le filtre ${chip.field} : ${chip.value}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pr-1.5 pl-2.5 text-[0.75rem] text-secondary-foreground transition-colors duration-(--dur-1) ease-(--ease-out-cpi) hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="truncate">
                <span className="text-muted-foreground">{chip.field} : </span>
                <span className="font-[600]">{chip.value}</span>
              </span>
              <XIcon className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters(clearAdvancedFilters());
            }}
          >
            Tout retirer
          </Button>
        </div>
      ) : null}

      {/* ─── Filtrage avancé ────────────────────────────────────────────────
          Le panneau est retiré du DOM quand il est fermé plutôt que masqué en
          CSS : dix listes déroulantes cachées resteraient atteignables au
          clavier, et le `Tab` traverserait un formulaire invisible. */}
      <div id={panelId} hidden={!advancedOpen}>
        {advancedOpen ? (
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-3">
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

            {/* ─── Phase 2 ──────────────────────────────────────────────────
                Ces cinq critères vivent dans le MÊME objet de filtre que les
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
              placeholder="Tous les téléconseillers"
              options={reference.commerciaux}
              value={filters.enrollmentCapturedById}
              onChange={(value) => {
                setFilters({ enrollmentCapturedById: value });
              }}
            />
          </div>
        ) : null}
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
