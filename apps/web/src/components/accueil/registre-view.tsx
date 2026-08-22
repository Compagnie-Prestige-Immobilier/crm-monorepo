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
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { VisiteForm } from '@/components/accueil/visite-form';
import { EmptyState } from '@/components/empty-state';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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
  VISITE_COLONNES,
  VISITE_REFERENTIELS_QUERY_KEY,
  countActiveVisiteFilters,
  dakarNow,
  fetchVisiteReferentiels,
  fetchVisites,
  orderVisites,
  parseVisiteFilters,
  serializeVisiteFilters,
  visitesQueryKey,
  type Visite,
  type VisiteFilters,
  type VisiteReferentielItem,
} from '@/lib/data/visites';
import { formatDate, formatNumber } from '@/lib/format';
import type { FilterOption } from '@/lib/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';

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
  const [impressionOuverte, setImpressionOuverte] = useState(false);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [commentairesImprimes, setCommentairesImprimes] = useState(true);

  const [searchDraft, setSearchDraft] = useState(filters.search);
  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);
  const debouncedSearch = useDebouncedValue(searchDraft);
  useEffect(() => {
    if (debouncedSearch === filters.search) return;
    setFilters({ search: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilters]);

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

  const visites = orderVisites(registre.data?.items ?? []);
  const total = registre.data?.total ?? 0;
  const page = registre.data?.page ?? 1;
  const pageCount = registre.data?.pageCount ?? 1;
  const premiere = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const derniere = Math.min(page * filters.pageSize, total);
  const jourSeul = !filters.toutePeriode && filters.dateFrom === null && filters.dateTo === null;

  function rafraichir(): void {
    void queryClient.invalidateQueries({ queryKey: ['visites'] });
  }

  return (
    <div className="flex flex-col gap-6">
      <style media="print">{`@page { size: ${orientation}; margin: 10mm; }`}</style>

      <div className="flex justify-end print:hidden">
        <Button
          type="button"
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
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Nom ou n° de registre…"
          />

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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

        {countActiveVisiteFilters(filters) > 0 ? (
          <div>
            <Button type="button" variant="outline" onClick={resetFilters}>
              <RotateCcwIcon aria-hidden="true" />
              Retirer les filtres
            </Button>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">
          {jourSeul ? 'Visites du jour' : 'Registre des visites'}
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[0.875rem] font-[600] text-muted-foreground">
            {formatNumber(total)}
          </span>
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

      {registre.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : registre.isError ? (
        <QueryErrorState
          error={registre.error}
          onRetry={() => {
            void registre.refetch();
          }}
          fallback="Le registre n’a pas pu être chargé."
        />
      ) : visites.length === 0 ? (
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
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-elev-sm print:text-[10px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° REGISTRE</TableHead>
                {COLONNES.map((colonne) => (
                  <TableHead
                    key={colonne}
                    className={
                      colonne === VISITE_COLONNES.comment && !commentairesImprimes
                        ? 'print:hidden'
                        : undefined
                    }
                  >
                    {colonne}
                  </TableHead>
                ))}
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
                    commentairesImprimes={commentairesImprimes}
                    onCorriger={() => {
                      setCorrigeeId(visite.id);
                    }}
                  />
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}

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
          <VisiteForm
            referentiels={referentiels.data}
            onSaved={() => {
              setAjoutOuvert(false);
              rafraichir();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={impressionOuverte} onOpenChange={setImpressionOuverte}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Préparer l’impression</DialogTitle>
            <DialogDescription>
              Les filtres et la période affichés seront conservés.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="pb-1 text-[0.8125rem] font-[600]">Orientation</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['landscape', 'Paysage', 'Recommandé pour toutes les colonnes'],
                  ['portrait', 'Portrait', 'Pour une liste plus étroite'],
                ] as const
              ).map(([value, label, description]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    orientation === value ? 'border-primary bg-secondary' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="orientation-impression"
                    value={value}
                    checked={orientation === value}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                    onChange={() => {
                      setOrientation(value);
                    }}
                  />
                  <span>
                    <span className="block text-[0.875rem] font-[600]">{label}</span>
                    <span className="block text-[0.75rem] text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border p-3 text-[0.875rem]">
            <input
              type="checkbox"
              checked={commentairesImprimes}
              className="size-4 accent-[var(--primary)]"
              onChange={(event) => {
                setCommentairesImprimes(event.target.checked);
              }}
            />
            Inclure la colonne commentaires
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImpressionOuverte(false);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => {
                setImpressionOuverte(false);
                window.print();
              }}
            >
              <PrinterIcon aria-hidden="true" />
              Ouvrir l’impression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LigneVisite({
  visite,
  commentairesImprimes,
  onCorriger,
}: {
  visite: Visite;
  commentairesImprimes: boolean;
  onCorriger: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-[600] whitespace-nowrap">{visite.reference}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(visite.date)}</TableCell>
      <TableCell className="whitespace-nowrap">{visite.time ?? ''}</TableCell>
      <TableCell className="font-[600]">{visite.visitorName}</TableCell>
      <TableCell className="whitespace-nowrap">{visite.phone ?? ''}</TableCell>
      <TableCell>{visite.entreprise.label}</TableCell>
      <TableCell>{visite.direction?.label ?? ''}</TableCell>
      <TableCell>{visite.destinataire?.label ?? ''}</TableCell>
      <TableCell>{visite.objet.label}</TableCell>
      <TableCell className={`max-w-[20rem] ${commentairesImprimes ? '' : 'print:hidden'}`}>
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
