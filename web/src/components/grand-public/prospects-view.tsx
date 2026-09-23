'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FileSpreadsheetIcon,
  InboxIcon,
  LoaderIcon,
  PlusIcon,
  RotateCcwIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { buildAdvancedChips } from '@/components/filters/advanced-chips';
import { AdvancedPanel } from '@/components/filters/advanced-panel';
import { useFileDownload } from '@/components/exports/download-button';
import { DatePicker } from '@/components/filters/date-picker';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import {
  FilterableTableHead,
  type FiltreColonne,
} from '@/components/filters/filterable-table-head';
import { SearchField } from '@/components/filters/search-field';
import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import { Absent } from '@/components/grand-public/absence';
import { CanalProvenance } from '@/components/grand-public/canal-provenance';
import { FiltreOrigine } from '@/components/grand-public/filtre-origine';
import { NouveauProspect } from '@/components/grand-public/nouveau-prospect';
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
import { fetchReferenceData } from '@/lib/data/reference';
import {
  clearAdvancedFilters,
  GRAND_PUBLIC_ADVANCED_KEYS,
  PAGE_SIZE_OPTIONS,
  type AdvancedFilterKey,
} from '@/lib/filters';
import { formatDate, formatDateTime, formatNumber, formatPhone, withRetired } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  PROSPECT_STATUTS,
  PROSPECT_STATUT_LABELS,
  statutForProjet,
  type FilterOption,
  type Paginated,
  type ProspectRow,
  type ProspectStatut,
  type ReferenceData,
} from '@/lib/types';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { cn } from '@/lib/utils';

const STATUT_VARIANT: Record<ProspectStatut, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOUVEAU: 'secondary',
  CONTACTE: 'info',
  CONVERTI: 'success',
  VENDU: 'success',
  PERDU: 'destructive',
};

const FILTERS_ADAPTER: UrlFilterAdapter<GrandPublicFilters> = {
  parse: parseGrandPublicFilters,
  serialize: serializeGrandPublicFilters,
  cleared: (current) => ({ ...EMPTY_GRAND_PUBLIC_FILTERS, pageSize: current.pageSize }),
};

const TYPE_OPTIONS = PROSPECT_TYPES.map((type) => ({
  value: type,
  label: PROSPECT_TYPE_LABELS[type],
}));

const STATUT_OPTIONS = PROSPECT_STATUTS.map((statut) => ({
  value: statut,
  label: PROSPECT_STATUT_LABELS[statut],
}));

function banqueOptions(reference: ReferenceData | undefined) {
  return (reference?.banques ?? []).map((banque) => ({
    value: banque.id,
    label: withRetired(banque.shortName ?? '', banque.isActive ?? false),
    hint: banque.name ?? undefined,
  }));
}

interface FiltresColonnes {
  statut: FiltreColonne;
  situation: FiltreColonne;
  canal: FiltreColonne;
  banque: FiltreColonne;
}

/** Colonne vers le critère qui la filtre déjà côté serveur. */
function filtresDesColonnes(
  filters: GrandPublicFilters,
  setFilters: (patch: Partial<GrandPublicFilters>) => void,
  reference: ReferenceData | undefined,
  canaux: readonly FilterOption[],
): FiltresColonnes {
  return {
    statut: {
      label: 'Statut',
      placeholder: 'Tous les statuts',
      options: STATUT_OPTIONS,
      value: filters.statut,
      onChange: (value) => {
        setFilters({ statut: value as ProspectStatut | null });
      },
    },
    situation: {
      label: 'Situation',
      placeholder: 'Toutes les situations',
      options: TYPE_OPTIONS,
      value: filters.type,
      onChange: (value) => {
        setFilters({ type: value as ProspectType | null });
      },
    },
    canal: {
      label: 'Canal de provenance',
      placeholder: 'Tous les canaux',
      options: canaux,
      value: filters.canalProvenanceId,
      onChange: (value) => {
        setFilters({ canalProvenanceId: value });
      },
    },
    banque: {
      label: 'Banque',
      placeholder: 'Toutes les banques',
      options: banqueOptions(reference),
      value: filters.banqueId,
      onChange: (value) => {
        setFilters({ banqueId: value });
      },
    },
  };
}

export function GrandPublicProspectsView({
  viewerId,
  canCreate,
  canExport,
  campaignScoped,
  canFilterOrigine,
}: {
  /** Le lecteur : « Ajoutés par moi » se borne à ses saisies. */
  viewerId: string;
  canCreate: boolean;
  canExport?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campaignScoped?: boolean;
  /** Seul celui à qui une campagne confie des fiches a deux provenances à départager. */
  canFilterOrigine?: boolean;
}) {
  const canExporter = Boolean(canExport);
  const scopedParCampagnes = Boolean(campaignScoped);
  const origineFiltrable = Boolean(canFilterOrigine);
  const { filters, setFilters, resetFilters } = useUrlFilters(FILTERS_ADAPTER);
  const telechargement = useFileDownload();

  const { draft: searchDraft, setDraft: setSearchDraft } = useDebouncedSearch(
    filters.search,
    (search) => {
      setFilters({ search });
    },
  );

  const reference = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const canaux = useQuery({
    queryKey: grandPublicKeys.canaux,
    queryFn: () => fetchCanauxProvenance(),
    staleTime: 5 * 60_000,
  });

  const list = useQuery({
    queryKey: grandPublicKeys.prospects(filters),
    queryFn: () => fetchGrandPublicProspects(filters, viewerId),
    placeholderData: (previous) => previous,
  });

  const canalOptions = (canaux.data ?? []).map((canal) => ({
    value: canal.id,
    label: withRetired(canal.label ?? '', canal.isActive ?? false),
  }));

  const removeAdvanced = useCallback(
    (key: AdvancedFilterKey) => {
      const patch: Partial<Record<AdvancedFilterKey, null>> = { [key]: null };
      setFilters(patch);
    },
    [setFilters],
  );

  const clearAdvanced = useCallback(() => {
    setFilters(clearAdvancedFilters(GRAND_PUBLIC_ADVANCED_KEYS));
  }, [setFilters]);

  const activeCount = countGrandPublicFilters(filters);
  const advancedChips = buildAdvancedChips(
    {
      projet: 'GRAND_PUBLIC',
      search: '',
      commercialId: null,
      representantId: filters.representantId,
      departementId: filters.departementId,
      banqueId: filters.banqueId,
      syndicatId: filters.syndicatId,
      statut: filters.statut,
      segment: null,
      phase2Status: null,
      sansMotif: null,
      enrollmentMethod: null,
      enrollmentCapturedById: null,
      revue: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
      pageSize: 25,
      sortBy: 'clientCreatedAt',
      sortDir: 'desc',
    },
    reference.data,
    GRAND_PUBLIC_ADVANCED_KEYS,
  );
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
        <ActionsEnTete
          filters={filters}
          viewerId={viewerId}
          canExporter={canExporter}
          telechargement={telechargement}
        />
      </div>

      <section
        aria-label="Filtres"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            label="Rechercher"
            placeholder="Nom, prénom ou téléphone"
            value={searchDraft}
            onChange={setSearchDraft}
          />
          {origineFiltrable ? (
            <FiltreOrigine
              value={filters.origine}
              onChange={(origine) => {
                setFilters({ origine });
              }}
            />
          ) : null}
        </div>

        <AdvancedPanel
          module="grand-public"
          startCollapsed
          chips={advancedChips}
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
          <FiltresAvances filters={filters} setFilters={setFilters} reference={reference.data} />
        </AdvancedPanel>
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
        filtresColonnes={filtresDesColonnes(filters, setFilters, reference.data, canalOptions)}
        hasFilters={activeCount > 0}
        canCreate={canCreate}
        campaignScoped={scopedParCampagnes}
        onCreate={() => setCreateOpen(true)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouveau prospect Grand Public</DialogTitle>
            <DialogDescription>Le nom et le téléphone suffisent.</DialogDescription>
          </DialogHeader>
          <NouveauProspect
            embedded
            onSaved={() => {
              setCreateOpen(false);
            }}
            onAnnuler={() => {
              setCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * L'export ne connaît pas l'attribution de campagne : sous ce critère le
 * classeur serait plus large que la liste, et le bouton s'efface.
 */
function ActionsEnTete({
  filters,
  viewerId,
  canExporter,
  telechargement,
}: {
  filters: GrandPublicFilters;
  viewerId: string;
  canExporter: boolean;
  telechargement: ReturnType<typeof useFileDownload>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/grand-public/rappels"
        className={buttonVariants({ variant: 'outline', size: 'lg' })}
      >
        <ClockIcon aria-hidden="true" />
        Voir les rappels
      </Link>
      {canExporter && filters.origine !== 'CAMPAGNE' ? (
        <Button
          variant="outline"
          size="lg"
          disabled={telechargement.pending}
          onClick={() => {
            void telechargement.download({
              url: buildGrandPublicExportUrl(filters, viewerId),
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
    </div>
  );
}

function FiltresAvances({
  filters,
  setFilters,
  reference,
}: {
  filters: GrandPublicFilters;
  setFilters: (patch: Partial<GrandPublicFilters>) => void;
  reference: ReferenceData | undefined;
}) {
  return (
    <>
      {reference && reference.representants.length > 0 ? (
        <FilterCombobox
          label="Représentant"
          placeholder="Tous les représentants"
          options={reference.representants}
          value={filters.representantId}
          onChange={(value) => {
            setFilters({ representantId: value });
          }}
        />
      ) : null}
      <FilterCombobox
        label="Département"
        placeholder="Tous les départements"
        options={(reference?.departements ?? []).map((d) => ({
          value: d.id,
          label: withRetired(d.name ?? '', d.isActive ?? false),
          hint: d.regionName ?? undefined,
        }))}
        value={filters.departementId}
        onChange={(value) => {
          setFilters({ departementId: value });
        }}
      />
      <FilterCombobox
        label="Syndicat"
        placeholder="Tous les syndicats"
        options={(reference?.syndicats ?? []).map((s) => ({
          value: s.id,
          label: withRetired(s.sigle ?? '', s.isActive ?? false),
          hint: s.secteur ?? undefined,
        }))}
        value={filters.syndicatId}
        onChange={(value) => {
          setFilters({ syndicatId: value });
        }}
      />
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
        label="Saisi jusqu'au"
        value={filters.dateTo}
        min={filters.dateFrom}
        onChange={(value) => {
          setFilters({ dateTo: value });
        }}
      />
    </>
  );
}

function ProspectsTable({
  list,
  filters,
  setFilters,
  filtresColonnes,
  hasFilters,
  canCreate,
  campaignScoped,
  onCreate,
}: {
  list: UseQueryResult<Paginated<ProspectRow>>;
  filters: GrandPublicFilters;
  setFilters: (patch: Partial<GrandPublicFilters>) => void;
  filtresColonnes: FiltresColonnes;
  hasFilters: boolean;
  canCreate: boolean;
  campaignScoped: boolean;
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
              <FilterableTableHead label="Statut" filtre={filtresColonnes.statut} />
              <FilterableTableHead label="Situation" filtre={filtresColonnes.situation} />
              <TableHead>Profession</TableHead>
              <FilterableTableHead label="Canal" filtre={filtresColonnes.canal} />
              <FilterableTableHead label="Banque" filtre={filtresColonnes.banque} />
              <TableHead>Segment</TableHead>
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Saisi le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-16">
                  <EmptyState
                    hasFilters={hasFilters}
                    canCreate={canCreate}
                    campaignScoped={campaignScoped}
                    onCreate={onCreate}
                  />
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

function detailVide(hasFilters: boolean, campaignScoped: boolean): string {
  if (hasFilters) return 'Élargissez la période ou retirez un critère.';
  if (campaignScoped) return 'Vos campagnes n’en contiennent aucun.';
  return 'La première fiche se crée depuis « Nouveau prospect ».';
}

function EmptyState({
  hasFilters,
  canCreate,
  campaignScoped,
  onCreate,
}: {
  hasFilters: boolean;
  canCreate: boolean;
  campaignScoped: boolean;
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
        {detailVide(hasFilters, campaignScoped)}
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

function StatutCell({ prospect }: { prospect: ProspectRow }) {
  const statut = statutForProjet(prospect, 'GRAND_PUBLIC');
  return (
    <TableCell>
      <div className="flex flex-col gap-0.5">
        <Badge variant={STATUT_VARIANT[statut]} className="w-fit">
          {prospect.lastReasonLabel ?? PROSPECT_STATUT_LABELS[statut]}
        </Badge>
        {prospect.lastAttemptAt ? (
          <span className="text-[0.75rem] text-muted-foreground tabular-nums">
            {formatDateTime(prospect.lastAttemptAt)}
            {prospect.callAttemptCount > 1 ? ` · ${prospect.callAttemptCount} appels` : ''}
          </span>
        ) : (
          <span className="text-[0.75rem] text-muted-foreground">Non appelé</span>
        )}
        {prospect.lastComment ? (
          <span
            className="max-w-xs truncate text-[0.75rem] italic text-muted-foreground"
            title={prospect.lastComment}
          >
            « {prospect.lastComment} »
          </span>
        ) : null}
      </div>
    </TableCell>
  );
}

function Row({ prospect }: { prospect: ProspectRow }) {
  const name = `${prospect.prenom} ${prospect.nom}`.trim();

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/grand-public/appel/${prospect.id}`}
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
      <StatutCell prospect={prospect} />
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
          <CanalProvenance label={prospect.canalProvenanceLabel} />
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
