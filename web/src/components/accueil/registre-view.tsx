'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2Icon,
  CalendarCheck2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { ImpressionDialog } from '@/components/accueil/impression-dialog';
import { VisiteForm } from '@/components/accueil/visite-form';
import { EmptyState } from '@/components/empty-state';
import { AdvancedPanel } from '@/components/filters/advanced-panel';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  VISITE_ADVANCED_FILTER_KEYS,
  buildVisiteAdvancedChips,
  type VisiteAdvancedFilterKey,
} from '@/components/filters/visite-advanced-chips';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  EMPTY_VISITE_FILTERS,
  IMPRESSION_COLONNES_PAR_DEFAUT,
  VISITE_COLONNES,
  VISITE_REFERENTIELS_QUERY_KEY,
  VISITE_SORT_FIELDS,
  countActiveVisiteFilters,
  dakarNow,
  fetchVisiteReferentiels,
  fetchVisites,
  impressionColonneVisible,
  orderVisites,
  parseVisiteFilters,
  serializeVisiteFilters,
  visitesQueryKey,
  type ImpressionColonne,
  type Visite,
  type VisiteFilters,
  type VisiteReferentielItem,
  type VisiteReferentiels,
  type VisiteSortField,
} from '@/lib/data/visites';
import { formatDate, formatNumber } from '@/lib/format';
import type { FilterOption } from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { cn } from '@/lib/utils';

/** Le libellé du classeur porte aussi le champ de tri : les deux voisinent naturellement. */
const SORT_FIELD_OF: Partial<Record<string, VisiteSortField>> = {
  [VISITE_COLONNES.date]: 'visitedAt',
  [VISITE_COLONNES.visitorName]: 'visitorName',
  [VISITE_COLONNES.entreprise]: 'entreprise',
  [VISITE_COLONNES.direction]: 'direction',
  [VISITE_COLONNES.destinataire]: 'destinataire',
  [VISITE_COLONNES.objet]: 'objet',
};

function isVisiteSortField(value: string): value is VisiteSortField {
  return (VISITE_SORT_FIELDS as readonly string[]).includes(value);
}

const ADAPTER: UrlFilterAdapter<VisiteFilters> = {
  parse: parseVisiteFilters,
  serialize: serializeVisiteFilters,
  cleared: () => EMPTY_VISITE_FILTERS,
};

const COLONNES = [
  VISITE_COLONNES.date,
  VISITE_COLONNES.time,
  VISITE_COLONNES.visitorName,
  VISITE_COLONNES.phone,
  VISITE_COLONNES.entreprise,
  VISITE_COLONNES.direction,
  VISITE_COLONNES.destinataire,
  VISITE_COLONNES.objet,
  VISITE_COLONNES.comment,
];

function options(items: readonly VisiteReferentielItem[] | undefined): FilterOption[] {
  return (items ?? []).map((item) => ({ value: item.id, label: item.label }));
}

function optionsReferentiel<K extends keyof VisiteReferentiels>(
  data: VisiteReferentiels | undefined,
  key: K,
): FilterOption[] {
  return options(data?.[key]);
}

interface Pagination {
  total: number;
  page: number;
  pageCount: number;
  premiere: number;
  derniere: number;
}

function pagination(
  data: { total: number; page: number; pageCount: number } | undefined,
  pageSize: number,
): Pagination {
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  return {
    total,
    page,
    pageCount: data?.pageCount ?? 1,
    premiere: total === 0 ? 0 : (page - 1) * pageSize + 1,
    derniere: Math.min(page * pageSize, total),
  };
}

// Le classement du serveur fait foi dès qu'on trie sur autre chose que la
// date : le re-tri client, pensé pour « le plus récent en haut », le
// contredirait sur un tri par nom ou par entreprise.
function visitesTriees(data: { items: Visite[] } | undefined, sortBy: VisiteSortField): Visite[] {
  const items = data?.items ?? [];
  return sortBy === 'visitedAt' ? orderVisites(items) : items;
}

/** La journée seule : aucun critère posé, le registre n'est pas amputé. */
function estJourSeul(filters: VisiteFilters, chips: number): boolean {
  return (
    !filters.toutePeriode &&
    filters.dateFrom === null &&
    filters.dateTo === null &&
    filters.search === '' &&
    chips === 0
  );
}

function contenuRegistreVide(jourSeul: boolean): { titre: string; description: string } {
  if (jourSeul) {
    return {
      titre: 'Aucune visite enregistrée aujourd’hui',
      description: 'Enregistrez la première ou consultez les visites précédentes.',
    };
  }
  return {
    titre: 'Aucune visite pour cette recherche',
    description: 'Élargissez la période ou retirez un filtre.',
  };
}

function RegistreCorps({
  isPending,
  isError,
  error,
  isFetching,
  onRetry,
  visites,
  jourSeul,
  colonnesImprimees,
  corrigeeId,
  referentielsData,
  filters,
  toggleSort,
  onVoirToutLeRegistre,
  onCorriger,
  onAnnulerCorrection,
  onCorrige,
}: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  onRetry: () => void;
  visites: Visite[];
  jourSeul: boolean;
  colonnesImprimees: ReadonlySet<ImpressionColonne>;
  corrigeeId: string | null;
  referentielsData: VisiteReferentiels | undefined;
  filters: VisiteFilters;
  toggleSort: (columnId: string) => void;
  onVoirToutLeRegistre: () => void;
  onCorriger: (id: string) => void;
  onAnnulerCorrection: () => void;
  onCorrige: () => void;
}): ReactNode {
  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError)
    return (
      <QueryErrorState
        error={error}
        onRetry={onRetry}
        fallback="Le registre n’a pas pu être chargé."
      />
    );
  if (visites.length === 0) {
    const { titre, description } = contenuRegistreVide(jourSeul);
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title={titre}
        description={description}
        action={
          jourSeul ? (
            <Button type="button" variant="outline" onClick={onVoirToutLeRegistre}>
              Voir tout le registre
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-elev-sm transition-opacity print:text-[10px]',
        '[&_[data-slot=table-container]]:max-h-[calc(100dvh-17rem)] [&_[data-slot=table-container]]:overflow-auto',
        isFetching && 'opacity-80',
      )}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
          <TableRow className="hover:bg-transparent">
            <TableHead
              className={
                impressionColonneVisible('N° REGISTRE', colonnesImprimees)
                  ? undefined
                  : 'print:hidden'
              }
            >
              N° REGISTRE
            </TableHead>
            {COLONNES.map((colonne) => {
              const sortField = SORT_FIELD_OF[colonne];
              const printClassName = impressionColonneVisible(colonne, colonnesImprimees)
                ? undefined
                : 'print:hidden';
              return sortField === undefined ? (
                <TableHead key={colonne} className={printClassName}>
                  {colonne}
                </TableHead>
              ) : (
                <SortableTableHead
                  key={colonne}
                  column={{ id: sortField, label: colonne }}
                  sortBy={filters.sortBy}
                  sortDir={filters.sortDir}
                  onToggle={toggleSort}
                  className={printClassName}
                />
              );
            })}
            <TableHead className="print:hidden">CORRIGER</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visites.map((visite) =>
            visite.id === corrigeeId ? (
              <TableRow key={visite.id}>
                <TableCell colSpan={COLONNES.length + 2} className="bg-secondary/40 p-4">
                  <VisiteForm
                    referentiels={referentielsData}
                    visite={visite}
                    onSaved={onCorrige}
                    onCancel={onAnnulerCorrection}
                  />
                </TableCell>
              </TableRow>
            ) : (
              <LigneVisite
                key={visite.id}
                visite={visite}
                colonnesImprimees={colonnesImprimees}
                onCorriger={() => {
                  onCorriger(visite.id);
                }}
              />
            ),
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function computeKPIs(visites: readonly Visite[], total: number, jourSeul: boolean) {
  const countVisites = jourSeul ? total : visites.length;

  const entrepriseSet = new Set(visites.map((v) => v.entreprise.id));
  const countEntreprises = entrepriseSet.size;

  const objetCounts = new Map<string, number>();
  visites.forEach((v) => {
    const label = v.objet.label;
    objetCounts.set(label, (objetCounts.get(label) ?? 0) + 1);
  });

  let topObjet = '–';
  let topObjetCount = 0;
  objetCounts.forEach((count, label) => {
    if (count > topObjetCount) {
      topObjetCount = count;
      topObjet = label;
    }
  });

  return { countVisites, countEntreprises, topObjet, topObjetCount };
}

function VisitesKpiCards({
  countVisites,
  countEntreprises,
  topObjet,
  topObjetCount,
  jourSeul,
}: {
  countVisites: number;
  countEntreprises: number;
  topObjet: string;
  topObjetCount: number;
  jourSeul: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 print:hidden">
      <div className="flex min-w-0 items-center gap-3.5 rounded-lg border border-border bg-card p-3.5 shadow-elev-xs">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarCheck2Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[0.8125rem] font-[500] text-muted-foreground">
            {jourSeul ? 'Visites aujourd’hui' : 'Visites au registre'}
          </span>
          <span className="font-display text-[1.25rem] font-[700] tabular-nums tracking-[-0.02em]">
            {formatNumber(countVisites)}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3.5 rounded-lg border border-border bg-card p-3.5 shadow-elev-xs">
        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Building2Icon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[0.8125rem] font-[500] text-muted-foreground">
            Entreprises & Organismes
          </span>
          <span className="font-display text-[1.25rem] font-[700] tabular-nums tracking-[-0.02em]">
            {formatNumber(countEntreprises)}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3.5 rounded-lg border border-border bg-card p-3.5 shadow-elev-xs">
        <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <FileTextIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[0.8125rem] font-[500] text-muted-foreground">
            Motif le plus fréquent
          </span>
          <span
            className="truncate font-display text-[0.9375rem] font-[700] tracking-[-0.01em]"
            title={topObjet}
          >
            {topObjet} {topObjetCount > 0 ? `(${topObjetCount})` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export function RegistreView() {
  const queryClient = useQueryClient();
  const { filters, setFilters, resetFilters } = useUrlFilters(ADAPTER);
  const duId = useId();
  const auId = useId();
  const [today] = useState(() => dakarNow().date);
  const [corrigeeId, setCorrigeeId] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);

  const [impressionOuverte, setImpressionOuverte] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [colonnesImprimees, setColonnesImprimees] = useState<ReadonlySet<ImpressionColonne>>(
    IMPRESSION_COLONNES_PAR_DEFAUT,
  );

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const referentiels = useQuery({
    queryKey: VISITE_REFERENTIELS_QUERY_KEY,
    queryFn: () => fetchVisiteReferentiels(),
    staleTime: 5 * 60_000,
  });

  const registre = useQuery({
    queryKey: visitesQueryKey(filters),
    queryFn: () => fetchVisites(filters, today),
    placeholderData: (previous) => previous,
  });

  const visites = visitesTriees(registre.data, filters.sortBy);
  const { total, page, pageCount, premiere, derniere } = pagination(
    registre.data,
    filters.pageSize,
  );
  const chips = buildVisiteAdvancedChips(filters, referentiels.data);
  const jourSeul = estJourSeul(filters, chips.length);
  const kpis = computeKPIs(visites, total, jourSeul);

  function rafraichir(): void {
    void queryClient.invalidateQueries({ queryKey: ['visites'] });
  }

  function removeAdvanced(key: VisiteAdvancedFilterKey): void {
    setFilters({ [key]: null });
  }

  function clearAdvanced(): void {
    setFilters(Object.fromEntries(VISITE_ADVANCED_FILTER_KEYS.map((key) => [key, null])));
  }

  function toggleSort(columnId: string): void {
    if (!isVisiteSortField(columnId)) return;
    if (filters.sortBy === columnId) {
      setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sortBy: columnId, sortDir: 'asc' });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <style media="print">{`@page { size: ${orientation}; margin: 10mm; }`}</style>

      <VisitesKpiCards
        countVisites={kpis.countVisites}
        countEntreprises={kpis.countEntreprises}
        topObjet={kpis.topObjet}
        topObjetCount={kpis.topObjetCount}
        jourSeul={jourSeul}
      />

      <section
        aria-label="Actions et filtres du registre"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-elev-sm print:hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setAjoutOuvert(true);
              }}
            >
              <PlusIcon aria-hidden="true" />
              Ajouter une visite
            </Button>

            <fieldset className="flex items-center gap-1.5 rounded-lg bg-muted p-1">
              <legend className="sr-only">Période</legend>
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1 text-[0.875rem] font-[600] transition-colors',
                  jourSeul
                    ? 'bg-card text-foreground shadow-elev-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={jourSeul}
                onClick={() => {
                  setFilters({ toutePeriode: false, dateFrom: null, dateTo: null });
                }}
              >
                Aujourd’hui
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-md px-3 py-1 text-[0.875rem] font-[600] transition-colors',
                  filters.toutePeriode
                    ? 'bg-card text-foreground shadow-elev-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={filters.toutePeriode}
                onClick={() => {
                  setFilters({ toutePeriode: true, dateFrom: null, dateTo: null });
                }}
              >
                Tout le registre
              </button>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={searchDraft}
              onChange={setSearchDraft}
              placeholder="Nom ou n° de registre…"
              className="w-full sm:w-64"
            />
            <Button
              type="button"
              variant="outline"
              disabled={visites.length === 0}
              onClick={() => {
                setImpressionOuverte(true);
              }}
            >
              <PrinterIcon aria-hidden="true" />
              Imprimer
            </Button>
          </div>
        </div>

        <AdvancedPanel
          module="registre"
          startCollapsed={true}
          chips={chips}
          onRemove={removeAdvanced}
          onClearAll={clearAdvanced}
          actions={
            countActiveVisiteFilters(filters) > 0 ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                <RotateCcwIcon aria-hidden="true" />
                Retirer les filtres
              </Button>
            ) : null
          }
        >
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <DatePicker
              id={duId}
              label="Du"
              value={filters.dateFrom}
              max={filters.dateTo}
              onChange={(value) => {
                setFilters({ dateFrom: value });
              }}
            />
            <DatePicker
              id={auId}
              label="Au"
              value={filters.dateTo}
              min={filters.dateFrom}
              onChange={(value) => {
                setFilters({ dateTo: value });
              }}
            />
            <FilterCombobox
              label={VISITE_COLONNES.entreprise}
              placeholder="Toutes"
              options={optionsReferentiel(referentiels.data, 'entreprises')}
              value={filters.entrepriseId}
              onChange={(value) => {
                setFilters({ entrepriseId: value });
              }}
            />
            <FilterCombobox
              label={VISITE_COLONNES.direction}
              placeholder="Toutes"
              options={optionsReferentiel(referentiels.data, 'directions')}
              value={filters.directionId}
              onChange={(value) => {
                setFilters({ directionId: value });
              }}
            />
            <FilterCombobox
              label={VISITE_COLONNES.destinataire}
              placeholder="Tous"
              options={optionsReferentiel(referentiels.data, 'destinataires')}
              value={filters.destinataireId}
              onChange={(value) => {
                setFilters({ destinataireId: value });
              }}
            />
            <FilterCombobox
              label={VISITE_COLONNES.objet}
              placeholder="Tous"
              options={optionsReferentiel(referentiels.data, 'objets')}
              value={filters.objetId}
              onChange={(value) => {
                setFilters({ objetId: value });
              }}
            />
          </div>
        </AdvancedPanel>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[1.125rem] font-[700] tracking-[-0.01em]">
          <span className="tabular-nums">{formatNumber(total)}</span> visite{total > 1 ? 's' : ''}{' '}
          {jourSeul ? 'aujourd’hui' : 'au registre'}
        </h2>
      </div>

      {/* SUR LE PAPIER, dire ce que la feuille contient. La pagination de
          l'écran est masquée à l'impression, et rien n'indiquait qu'il manquait
          les visites au-delà de la page en cours. */}
      {pageCount > 1 ? (
        <p className="hidden text-[0.75rem] print:block">
          Page {page} sur {pageCount}, visites {formatNumber(premiere)} à {formatNumber(derniere)}{' '}
          sur {formatNumber(total)}. Les autres pages s’impriment séparément.
        </p>
      ) : null}

      <RegistreCorps
        isPending={registre.isPending}
        isError={registre.isError}
        error={registre.error}
        isFetching={registre.isFetching}
        onRetry={() => {
          void registre.refetch();
        }}
        visites={visites}
        jourSeul={jourSeul}
        colonnesImprimees={colonnesImprimees}
        corrigeeId={corrigeeId}
        referentielsData={referentiels.data}
        filters={filters}
        toggleSort={toggleSort}
        onVoirToutLeRegistre={() => {
          setFilters({ toutePeriode: true, dateFrom: null, dateTo: null });
        }}
        onCorriger={setCorrigeeId}
        onAnnulerCorrection={() => {
          setCorrigeeId(null);
        }}
        onCorrige={() => {
          setCorrigeeId(null);
          rafraichir();
        }}
      />

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <p className="text-[0.9375rem]" role="status">
            <span className="sr-only">Visites affichées&nbsp;: </span>
            {formatNumber(premiere)}–{formatNumber(derniere)} sur {formatNumber(total)}
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                setFilters({ page: page - 1 });
              }}
            >
              <ChevronLeftIcon aria-hidden="true" />
              Page précédente
            </Button>
            <span className="min-w-20 text-center text-[0.9375rem] tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => {
                setFilters({ page: page + 1 });
              }}
            >
              Page suivante
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={ajoutOuvert} onOpenChange={setAjoutOuvert}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Enregistrer une visite</DialogTitle>
          </DialogHeader>
          {/* Le dialogue RESTE ouvert : le formulaire se remet en file de
              lui-même, entreprise conservée, focus sur le nom. Trois visiteurs
              de la même société s'enregistrent d'affilée, ce que la fermeture
              automatique rendait impossible. L'accueil ferme quand il a fini. */}
          <VisiteForm referentiels={referentiels.data} onSaved={rafraichir} />
        </DialogContent>
      </Dialog>

      <ImpressionDialog
        open={impressionOuverte}
        onOpenChange={setImpressionOuverte}
        orientation={orientation}
        onOrientationChange={setOrientation}
        colonnesImprimees={colonnesImprimees}
        onColonnesImpriméesChange={setColonnesImprimees}
        filters={filters}
        today={today}
        total={total}
        pageItemsCount={visites.length}
      />
    </div>
  );
}

function LigneVisite({
  visite,
  colonnesImprimees,
  onCorriger,
}: {
  visite: Visite;
  colonnesImprimees: ReadonlySet<ImpressionColonne>;
  onCorriger: () => void;
}) {
  const printClassName = (colonne: ImpressionColonne): string | undefined =>
    impressionColonneVisible(colonne, colonnesImprimees) ? undefined : 'print:hidden';

  return (
    <TableRow>
      <TableCell
        className={cn(
          'whitespace-nowrap font-mono text-[0.8125rem] font-[600]',
          printClassName('N° REGISTRE'),
        )}
      >
        {visite.reference}
      </TableCell>
      <TableCell
        className={cn(
          'whitespace-nowrap text-[0.8125rem] tabular-nums',
          printClassName(VISITE_COLONNES.date),
        )}
      >
        {formatDate(visite.date)}
      </TableCell>
      <TableCell
        className={cn(
          'whitespace-nowrap text-[0.8125rem] tabular-nums text-muted-foreground',
          printClassName(VISITE_COLONNES.time),
        )}
      >
        {visite.time ?? ''}
      </TableCell>
      <TableCell
        className={cn(
          'whitespace-nowrap text-[0.875rem] font-[600]',
          printClassName(VISITE_COLONNES.visitorName),
        )}
      >
        {visite.visitorName}
      </TableCell>
      <TableCell
        className={cn(
          'whitespace-nowrap font-mono text-[0.8125rem] font-semibold text-foreground/80 tabular-nums',
          printClassName(VISITE_COLONNES.phone),
        )}
      >
        {visite.phone ?? ''}
      </TableCell>
      <TableCell className={cn('text-[0.8125rem]', printClassName(VISITE_COLONNES.entreprise))}>
        {visite.entreprise.label}
      </TableCell>
      <TableCell className={cn('text-[0.8125rem]', printClassName(VISITE_COLONNES.direction))}>
        {visite.direction?.label ?? ''}
      </TableCell>
      <TableCell className={cn('text-[0.8125rem]', printClassName(VISITE_COLONNES.destinataire))}>
        {visite.destinataire?.label ?? ''}
      </TableCell>
      <TableCell
        className={cn(
          'min-w-[14rem] text-[0.8125rem] font-[500]',
          printClassName(VISITE_COLONNES.objet),
        )}
      >
        {visite.objet.label}
      </TableCell>
      <TableCell
        className={cn(
          'max-w-[20rem] text-[0.8125rem] text-muted-foreground',
          printClassName(VISITE_COLONNES.comment),
        )}
      >
        {visite.comment ?? ''}
      </TableCell>
      <TableCell className="text-right print:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Modifier la visite de ${visite.visitorName}`}
          onClick={onCorriger}
        >
          <PencilIcon aria-hidden="true" />
          Modifier
        </Button>
      </TableCell>
    </TableRow>
  );
}
