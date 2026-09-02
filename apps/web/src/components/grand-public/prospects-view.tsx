'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FileSpreadsheetIcon,
  InboxIcon,
  LoaderIcon,
  PhoneCallIcon,
  PlusIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useFileDownload } from '@/components/exports/download-button';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import { Absent } from '@/components/grand-public/absence';
import { GrandPublicProspectForm } from '@/components/grand-public/prospect-form';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildGrandPublicExportUrl, grandPublicExportFileName } from '@/lib/data/export';
import {
  EMPTY_GRAND_PUBLIC_FILTERS,
  PROSPECT_TYPES,
  PROSPECT_TYPE_LABELS,
  countGrandPublicFilters,
  fetchCanauxProvenance,
  fetchGrandPublicProspects,
  grandPublicKeys,
  parseGrandPublicFilters,
  serializeGrandPublicFilters,
  type GrandPublicFilters,
  type ProspectType,
} from '@/lib/data/grand-public';
import { PAGE_SIZE_OPTIONS } from '@/lib/filters';
import { formatDate, formatNumber, formatPhone, withRetired } from '@/lib/format';
import {
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  statutForProjet,
  type Paginated,
  type ProspectRow,
  type ProspectStatut,
} from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { cn } from '@/lib/utils';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  PERDU: 'destructive',
};

const FILTERS_ADAPTER: UrlFilterAdapter<GrandPublicFilters> = {
  parse: parseGrandPublicFilters,
  serialize: serializeGrandPublicFilters,
  cleared: (current) => ({ ...EMPTY_GRAND_PUBLIC_FILTERS, pageSize: current.pageSize }),
};

/** Peu d'options, toutes visibles : on désigne au lieu d'ouvrir puis de chercher. */
function ChoiceRow<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[0.8125rem] font-[600] text-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? 'default' : 'outline'}
              aria-pressed={active}
              onClick={() => {
                onChange(active ? null : option.value);
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

const TYPE_OPTIONS = PROSPECT_TYPES.map((type) => ({
  value: type,
  label: PROSPECT_TYPE_LABELS[type],
}));

const STATUT_OPTIONS = PROSPECT_STATUTS.map((statut) => ({
  value: statut,
  label: PROSPECT_STATUT_LABELS[statut],
}));

export function GrandPublicProspectsView({
  canCreate,
  canExport = false,
}: {
  canCreate: boolean;
  canExport?: boolean;
}) {
  const { filters, setFilters, resetFilters } = useUrlFilters(FILTERS_ADAPTER);
  const telechargement = useFileDownload();

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const canaux = useQuery({
    queryKey: grandPublicKeys.canaux,
    queryFn: () => fetchCanauxProvenance(),
    staleTime: 5 * 60_000,
  });

  const list = useQuery({
    queryKey: grandPublicKeys.prospects(filters),
    queryFn: () => fetchGrandPublicProspects(filters),
    placeholderData: (previous) => previous,
  });

  const canalOptions = (canaux.data ?? []).map((canal) => ({
    value: canal.id,
    label: withRetired(canal.label, canal.isActive),
  }));

  const activeCount = countGrandPublicFilters(filters);
  const [filtersOpen, setFiltersOpen] = useState(activeCount > 0);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
            Prospects Grand Public
          </h1>
          <p className="text-body text-muted-foreground">
            Les particuliers démarchés hors syndicat. Les fiches CHUES ne figurent pas ici.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/grand-public/rappels"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <ClockIcon aria-hidden="true" />
            Voir les rappels
          </Link>
          {canExport ? (
            <Button
              variant="outline"
              size="lg"
              disabled={telechargement.pending}
              onClick={() => {
                void telechargement.download({
                  url: buildGrandPublicExportUrl(filters),
                  fileName: grandPublicExportFileName(),
                  failureMessage: 'L’export a échoué.',
                });
              }}
            >
              {telechargement.pending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileSpreadsheetIcon aria-hidden="true" />
              )}
              Exporter
            </Button>
          ) : null}
          {canCreate ? (
            <>
              <Link
                href="/grand-public/console"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                <PhoneCallIcon aria-hidden="true" />
                Appeler les prospects
              </Link>
              <Button size="lg" onClick={() => setCreateOpen(true)}>
                <PlusIcon aria-hidden="true" />
                Nouveau prospect
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <section
        aria-label="Filtres"
        className="rounded-lg border border-border bg-card p-4 shadow-elev-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            label="Rechercher"
            placeholder="Nom, prénom ou téléphone"
            value={searchDraft}
            onChange={setSearchDraft}
          />
          <Button
            type="button"
            variant="outline"
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen((open) => !open);
            }}
          >
            <SlidersHorizontalIcon aria-hidden="true" />
            Filtres{activeCount > 0 ? ` (${String(activeCount)})` : ''}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn('transition-transform', filtersOpen && 'rotate-180')}
            />
          </Button>
        </div>

        {filtersOpen ? (
          <div className="mt-5 flex flex-col gap-5 border-t border-border pt-5">
            <FilterCombobox
              label="Canal de provenance"
              placeholder="Tous les canaux"
              value={filters.canalProvenanceId}
              options={canalOptions}
              onChange={(value) => {
                setFilters({ canalProvenanceId: value });
              }}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <ChoiceRow<ProspectType>
                legend="Situation"
                options={TYPE_OPTIONS}
                value={filters.type}
                onChange={(value) => {
                  setFilters({ type: value });
                }}
              />
              <ChoiceRow<ProspectStatut>
                legend="Statut"
                options={STATUT_OPTIONS}
                value={filters.statut}
                onChange={(value) => {
                  setFilters({ statut: value });
                }}
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <DatePicker
                id="gp-date-from"
                label="Saisi à partir du"
                value={filters.dateFrom}
                max={filters.dateTo}
                onChange={(value) => {
                  setFilters({ dateFrom: value });
                }}
              />
              <DatePicker
                id="gp-date-to"
                label="Saisi jusqu’au"
                value={filters.dateTo}
                min={filters.dateFrom}
                onChange={(value) => {
                  setFilters({ dateTo: value });
                }}
              />
              {activeCount > 0 ? (
                <Button type="button" variant="ghost" onClick={resetFilters}>
                  <RotateCcwIcon aria-hidden="true" />
                  Tout effacer
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {canaux.isError ? (
        <QueryErrorState
          error={canaux.error}
          onRetry={() => {
            void canaux.refetch();
          }}
          fallback="La liste des canaux de provenance n’a pas pu être chargée. Les autres filtres restent utilisables."
          className="animate-rise items-center gap-3 border-destructive/30 px-6 py-8 text-center"
        />
      ) : null}

      <ProspectsTable
        list={list}
        filters={filters}
        setFilters={setFilters}
        hasFilters={activeCount > 0}
        canCreate={canCreate}
        onCreate={() => setCreateOpen(true)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau prospect Grand Public</DialogTitle>
            <DialogDescription>Le nom, le prénom et le téléphone suffisent.</DialogDescription>
          </DialogHeader>
          <GrandPublicProspectForm embedded onSaved={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProspectsTable({
  list,
  filters,
  setFilters,
  hasFilters,
  canCreate,
  onCreate,
}: {
  list: UseQueryResult<Paginated<ProspectRow>>;
  filters: GrandPublicFilters;
  setFilters: (patch: Partial<GrandPublicFilters>) => void;
  hasFilters: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  if (list.isPending) return <GrandPublicTableSkeleton />;

  if (list.isError) {
    return (
      <QueryErrorState
        error={list.error}
        onRetry={() => {
          void list.refetch();
        }}
        fallback="La liste des prospects Grand Public n’a pas pu être chargée."
      />
    );
  }

  const { items, total, page, pageCount } = list.data;
  const first = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const last = Math.min(page * filters.pageSize, total);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'overflow-x-auto rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
          list.isFetching && 'opacity-80',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nom</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Situation</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Banque</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Saisi le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-16">
                  <EmptyState hasFilters={hasFilters} canCreate={canCreate} onCreate={onCreate} />
                </TableCell>
              </TableRow>
            ) : (
              items.map((prospect) => <Row key={prospect.id} prospect={prospect} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-muted-foreground" role="status">
          <span className="sr-only">Prospects affichés&nbsp;: </span>
          {total === 0
            ? 'Aucun résultat'
            : `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`}
        </p>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
            <span className="hidden sm:inline">Lignes</span>
            <Select
              value={String(filters.pageSize)}
              onValueChange={(value) => {
                if (value === null) return;
                setFilters({ pageSize: Number(value), page: 1 });
              }}
            >
              <SelectTrigger size="sm" className="w-20" aria-label="Lignes par page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Page précédente"
              disabled={page <= 1}
              onClick={() => {
                setFilters({ page: page - 1 });
              }}
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Button>
            <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Page suivante"
              disabled={page >= pageCount}
              onClick={() => {
                setFilters({ page: page + 1 });
              }}
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  canCreate,
  onCreate,
}: {
  hasFilters: boolean;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-[600]">
        {hasFilters
          ? 'Aucun prospect ne correspond à ces filtres.'
          : 'Aucun prospect Grand Public n’a encore été saisi.'}
      </p>
      <p className="text-[0.8125rem] text-muted-foreground">
        {hasFilters
          ? 'Élargissez la période ou retirez un critère.'
          : 'La première fiche se crée depuis « Nouveau prospect ».'}
      </p>
      {!hasFilters && canCreate ? (
        <Button className="mt-2" onClick={onCreate}>
          <PlusIcon aria-hidden="true" />
          Nouveau prospect
        </Button>
      ) : null}
    </div>
  );
}

function Row({ prospect }: { prospect: ProspectRow }) {
  const name = `${prospect.prenom} ${prospect.nom}`.trim();
  const statut = statutForProjet(prospect, 'GRAND_PUBLIC');

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/grand-public/${prospect.id}`}
          className="block min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="block truncate font-[600] underline-offset-2 hover:underline">
            {name}
          </span>
          <span className="block truncate text-[0.75rem] text-muted-foreground tabular-nums">
            {formatPhone(prospect.phoneE164)}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant={STATUT_VARIANT[statut]}>{PROSPECT_STATUT_LABELS[statut]}</Badge>
      </TableCell>
      <TableCell>
        {prospect.type === null ? <Absent /> : PROSPECT_TYPE_LABELS[prospect.type]}
      </TableCell>
      <TableCell>
        {prospect.profession === null || prospect.profession === '' ? (
          <Absent />
        ) : (
          <span className="truncate">{prospect.profession}</span>
        )}
      </TableCell>
      <TableCell>
        {prospect.canalProvenanceLabel === null ? (
          <Absent />
        ) : (
          <span className="truncate">{prospect.canalProvenanceLabel}</span>
        )}
      </TableCell>
      <TableCell>
        {prospect.banqueName === null ? (
          <Absent>Non renseignée</Absent>
        ) : (
          <span className="truncate">{prospect.banqueName}</span>
        )}
      </TableCell>
      {/* Sans banque NI syndicat, la fiche n'entre dans aucun BDD1-4. On l'écrit :
          la ranger dans BDD4 serait une réponse là où il n'y a qu'une absence. */}
      <TableCell>
        {prospect.segment === null ? (
          <Absent>Aucun</Absent>
        ) : (
          <Badge variant="outline">{prospect.segment}</Badge>
        )}
      </TableCell>
      <TableCell>
        <span className="truncate">{prospect.ownedByCommercialName}</span>
      </TableCell>
      <TableCell>
        <time dateTime={prospect.clientCreatedAt} className="whitespace-nowrap tabular-nums">
          {formatDate(prospect.clientCreatedAt)}
        </time>
      </TableCell>
    </TableRow>
  );
}

export function GrandPublicTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <div className="flex h-11 items-center gap-4 border-b border-border px-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: 8 }, (_, index) => index).map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-3">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <Skeleton key={cell} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
