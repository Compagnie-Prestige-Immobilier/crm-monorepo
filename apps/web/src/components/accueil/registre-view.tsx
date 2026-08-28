'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  RotateCcwIcon,
  SearchIcon,
} from 'lucide-react';
import { useId, useState } from 'react';

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

export function RegistreView() {
  const queryClient = useQueryClient();
  const { filters, setFilters, resetFilters } = useUrlFilters(ADAPTER);
  const duId = useId();
  const auId = useId();
  const [today] = useState(() => dakarNow().date);
  const [corrigeeId, setCorrigeeId] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  // Déplié d'emblée SI un critère est déjà posé : sinon le registre paraîtrait
  // amputé sans qu'on voie pourquoi.
  const [rechercheOuverte, setRechercheOuverte] = useState(
    () => countActiveVisiteFilters(filters) > 0,
  );
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

  // Le classement du serveur fait foi dès qu'on trie sur autre chose que la
  // date : le re-tri client, pensé pour « le plus récent en haut », le
  // contredirait sur un tri par nom ou par entreprise.
  const items = registre.data?.items ?? [];
  const visites = filters.sortBy === 'visitedAt' ? orderVisites(items) : items;
  const total = registre.data?.total ?? 0;
  const page = registre.data?.page ?? 1;
  const pageCount = registre.data?.pageCount ?? 1;
  const premiere = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const derniere = Math.min(page * filters.pageSize, total);
  const jourSeul = !filters.toutePeriode && filters.dateFrom === null && filters.dateTo === null;
  const chips = buildVisiteAdvancedChips(filters, referentiels.data);

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
    <div className="flex flex-col gap-6">
      <style media="print">{`@page { size: ${orientation}; margin: 10mm; }`}</style>

      {/* Le geste du comptoir passe AVANT l'outillage de recherche, et prend
          toute la largeur là où le pouce le cherche. */}
      <div className="print:hidden">
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => {
            setAjoutOuvert(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Ajouter une visite
        </Button>
      </div>

      <section
        aria-label="Rechercher dans le registre"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm print:hidden"
      >
        {/* Les deux bascules restent VISIBLES : c'est le réglage qu'on change
            plusieurs fois par jour, pas un critère de recherche. */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Période">
          <Button
            type="button"
            variant={jourSeul ? 'default' : 'outline'}
            aria-pressed={jourSeul}
            onClick={() => {
              setFilters({ toutePeriode: false, dateFrom: null, dateTo: null });
            }}
          >
            Aujourd’hui
          </Button>
          <Button
            type="button"
            variant={filters.toutePeriode ? 'default' : 'outline'}
            aria-pressed={filters.toutePeriode}
            onClick={() => {
              setFilters({ toutePeriode: true, dateFrom: null, dateTo: null });
            }}
          >
            Tout le registre
          </Button>
        </div>

        <details
          open={rechercheOuverte}
          onToggle={(event) => {
            setRechercheOuverte(event.currentTarget.open);
          }}
        >
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[0.875rem] font-[600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
            Rechercher
          </summary>

          <div className="flex flex-col gap-4 pt-3">
            <div className="flex flex-wrap items-end gap-3">
              <SearchField
                value={searchDraft}
                onChange={setSearchDraft}
                placeholder="Nom ou n° de registre…"
              />

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
            </div>

            <AdvancedPanel
              module="registre"
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
              <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <FilterCombobox
                  label={VISITE_COLONNES.entreprise}
                  placeholder="Toutes"
                  options={options(referentiels.data?.entreprises)}
                  value={filters.entrepriseId}
                  onChange={(value) => {
                    setFilters({ entrepriseId: value });
                  }}
                />
                <FilterCombobox
                  label={VISITE_COLONNES.direction}
                  placeholder="Toutes"
                  options={options(referentiels.data?.directions)}
                  value={filters.directionId}
                  onChange={(value) => {
                    setFilters({ directionId: value });
                  }}
                />
                <FilterCombobox
                  label={VISITE_COLONNES.destinataire}
                  placeholder="Tous"
                  options={options(referentiels.data?.destinataires)}
                  value={filters.destinataireId}
                  onChange={(value) => {
                    setFilters({ destinataireId: value });
                  }}
                />
                <FilterCombobox
                  label={VISITE_COLONNES.objet}
                  placeholder="Tous"
                  options={options(referentiels.data?.objets)}
                  value={filters.objetId}
                  onChange={(value) => {
                    setFilters({ objetId: value });
                  }}
                />
              </div>
            </AdvancedPanel>
          </div>
        </details>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
          {formatNumber(total)} visite{total > 1 ? 's' : ''}{' '}
          {jourSeul ? 'aujourd’hui' : 'au registre'}
        </h2>
        <Button
          type="button"
          variant="outline"
          className="print:hidden"
          disabled={visites.length === 0}
          onClick={() => {
            setImpressionOuverte(true);
          }}
        >
          <PrinterIcon aria-hidden="true" />
          Imprimer
        </Button>
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

      {(() => {
        if (registre.isPending) return <Skeleton className="h-64 w-full" />;
        return (() => {
          if (registre.isError)
            return (
              <QueryErrorState
                error={registre.error}
                onRetry={() => {
                  void registre.refetch();
                }}
                fallback="Le registre n’a pas pu être chargé."
              />
            );
          return (() => {
            if (visites.length === 0)
              return (
                <EmptyState
                  icon={ClipboardListIcon}
                  title={
                    jourSeul
                      ? 'Aucune visite enregistrée aujourd’hui'
                      : 'Aucune visite pour cette recherche'
                  }
                  description={
                    jourSeul
                      ? 'Enregistrez la première ou consultez les visites précédentes.'
                      : 'Élargissez la période ou retirez un filtre.'
                  }
                  action={
                    jourSeul ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setFilters({ toutePeriode: true, dateFrom: null, dateTo: null });
                        }}
                      >
                        Voir tout le registre
                      </Button>
                    ) : undefined
                  }
                />
              );
            return (
              <div className="rounded-lg border border-border bg-card shadow-elev-sm print:text-[10px]">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                              referentiels={referentiels.data}
                              visite={visite}
                              onSaved={() => {
                                setCorrigeeId(null);
                                rafraichir();
                              }}
                              onCancel={() => {
                                setCorrigeeId(null);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ) : (
                        <LigneVisite
                          key={visite.id}
                          visite={visite}
                          colonnesImprimees={colonnesImprimees}
                          onCorriger={() => {
                            setCorrigeeId(visite.id);
                          }}
                        />
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            );
          })();
        })();
      })()}

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
      <TableCell className={cn('font-[600] whitespace-nowrap', printClassName('N° REGISTRE'))}>
        {visite.reference}
      </TableCell>
      <TableCell className={cn('whitespace-nowrap', printClassName(VISITE_COLONNES.date))}>
        {formatDate(visite.date)}
      </TableCell>
      <TableCell className={cn('whitespace-nowrap', printClassName(VISITE_COLONNES.time))}>
        {visite.time ?? ''}
      </TableCell>
      <TableCell className={cn('font-[600]', printClassName(VISITE_COLONNES.visitorName))}>
        {visite.visitorName}
      </TableCell>
      <TableCell className={cn('whitespace-nowrap', printClassName(VISITE_COLONNES.phone))}>
        {visite.phone ?? ''}
      </TableCell>
      <TableCell className={printClassName(VISITE_COLONNES.entreprise)}>
        {visite.entreprise.label}
      </TableCell>
      <TableCell className={printClassName(VISITE_COLONNES.direction)}>
        {visite.direction?.label ?? ''}
      </TableCell>
      <TableCell className={printClassName(VISITE_COLONNES.destinataire)}>
        {visite.destinataire?.label ?? ''}
      </TableCell>
      <TableCell className={printClassName(VISITE_COLONNES.objet)}>{visite.objet.label}</TableCell>
      <TableCell className={cn('max-w-[20rem]', printClassName(VISITE_COLONNES.comment))}>
        {visite.comment ?? ''}
      </TableCell>
      <TableCell className="print:hidden">
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
