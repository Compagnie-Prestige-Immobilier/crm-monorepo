'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  LayersIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  UploadIcon,
  UsersRoundIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useFileDownload } from '@/components/exports/download-button';
import {
  FilterableTableHead,
  type FiltreColonne,
} from '@/components/filters/filterable-table-head';
import { QueryErrorState } from '@/components/query-error-state';
import { RelationBadge } from '@/components/representants/relation-badge';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { RepresentantsFiltersBar } from '@/components/representants/representants-filters-bar';
import { useRepresentantFilters } from '@/components/representants/use-representant-filters';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { fetchRepresentants } from '@/lib/data/representants';
import { fetchReferenceData } from '@/lib/data/reference';
import {
  buildRepresentantsExportUrl,
  representantsExportFileName,
} from '@/lib/data/representants-import';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import {
  countActiveRepresentantFilters,
  REPRESENTANT_RELATION_CHOICES,
  REPRESENTANT_RELATION_LABELS,
  REPRESENTANT_SORT_FIELDS,
  type RepresentantFilters,
  type RepresentantSortField,
} from '@/lib/representant-filters';
import type { FilterOption, ReferenceData, RepresentantRow } from '@/lib/types';
import { cn } from '@/lib/utils';

const NO_VALUE = '–';

const RELATION_OPTIONS: FilterOption[] = REPRESENTANT_RELATION_CHOICES.map((relation) => ({
  value: relation,
  label: REPRESENTANT_RELATION_LABELS[relation],
}));

const PRESENCE_OPTIONS: FilterOption[] = [
  { value: 'oui', label: 'Au moins un' },
  { value: 'non', label: 'Aucun' },
];

function isSortField(id: string): id is RepresentantSortField {
  return (REPRESENTANT_SORT_FIELDS as readonly string[]).includes(id);
}

type CritereColonne = {
  colonne: 'qualification' | 'departement' | 'ief' | 'saisiPar';
  cle: 'relationStatus' | 'departementId' | 'iefId' | 'commercialId';
  label: string;
  placeholder: string;
  options: (reference: ReferenceData | undefined) => readonly FilterOption[];
};

/** « Saisi par » porte `commercialId`, qui filtre bien l'auteur de la fiche. */
const CRITERES_COLONNES: readonly CritereColonne[] = [
  {
    colonne: 'qualification',
    cle: 'relationStatus',
    label: 'Qualification',
    placeholder: 'Toutes les qualifications',
    options: () => RELATION_OPTIONS,
  },
  {
    colonne: 'departement',
    cle: 'departementId',
    label: 'Département',
    placeholder: 'Tous les départements',
    options: (reference) =>
      (reference?.departements ?? []).map((departement) => ({
        value: departement.id,
        label: departement.name ?? '',
        hint: departement.regionName ?? undefined,
      })),
  },
  {
    colonne: 'ief',
    cle: 'iefId',
    label: 'IEF',
    placeholder: 'Toutes les IEF',
    options: (reference) =>
      (reference?.iefs ?? []).map((ief) => ({
        value: ief.id,
        label: ief.name ?? '',
        hint: ief.departementName ?? undefined,
      })),
  },
  {
    colonne: 'saisiPar',
    cle: 'commercialId',
    label: 'Saisi par',
    placeholder: 'Tous les utilisateurs',
    options: (reference) => reference?.commerciaux ?? [],
  },
];

type FiltresColonnes = Record<CritereColonne['colonne'] | 'prospects', FiltreColonne>;

function filtresDesColonnes(
  filters: RepresentantFilters,
  setFilters: (patch: Partial<RepresentantFilters>) => void,
  reference: ReferenceData | undefined,
): FiltresColonnes {
  const listes = Object.fromEntries(
    CRITERES_COLONNES.map((critere) => [
      critere.colonne,
      {
        label: critere.label,
        placeholder: critere.placeholder,
        options: critere.options(reference),
        value: filters[critere.cle],
        onChange: (value: string | null) => {
          setFilters({ [critere.cle]: value } as Partial<RepresentantFilters>);
        },
      },
    ]),
  ) as Record<CritereColonne['colonne'], FiltreColonne>;
  return {
    ...listes,
    prospects: {
      label: 'Prospects apportés',
      placeholder: 'Tous les représentants',
      options: PRESENCE_OPTIONS,
      value: presenceValue(filters.hasProspects),
      onChange: (value) => {
        setFilters({ hasProspects: value === null ? null : value === 'oui' });
      },
    },
  };
}

function presenceValue(hasProspects: boolean | null): string | null {
  if (hasProspects === null) return null;
  return hasProspects ? 'oui' : 'non';
}

function pagination(
  data: { total: number; page: number; pageCount: number } | undefined,
  pageSize: number,
): { total: number; page: number; pageCount: number; first: number; last: number } {
  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  return {
    total,
    page,
    pageCount: data?.pageCount ?? 1,
    first: total === 0 ? 0 : (page - 1) * pageSize + 1,
    last: Math.min(page * pageSize, total),
  };
}

function ambassadorCountDe(
  filters: RepresentantFilters,
  ambassadors: { total: number } | undefined,
): number | null {
  if (filters.relationStatus === 'AMBASSADEUR') return null;
  return ambassadors?.total ?? null;
}

function libelleResultats(
  total: number,
  first: number,
  last: number,
  ambassadorCount: number | null,
): string {
  if (total === 0) return 'Aucun résultat';
  const base = `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`;
  if (ambassadorCount === null) return base;
  return `${base}, dont ${formatNumber(ambassadorCount)} qui ont accepté`;
}

function representantEnEdition(
  editing: { representant: RepresentantRow | null } | null,
): RepresentantRow | null {
  return editing?.representant ?? null;
}

function messageVide(
  activeFilterCount: number,
  campaignScoped: boolean,
): { titre: string; detail: string } {
  if (activeFilterCount > 0) {
    return {
      titre: 'Aucun représentant ne correspond à ces critères.',
      detail: 'Élargissez la recherche ou retirez un filtre.',
    };
  }
  if (campaignScoped) {
    return {
      titre: 'Aucun représentant.',
      detail: 'Vos campagnes n’en contiennent aucun.',
    };
  }
  return {
    titre: 'Aucun représentant enregistré.',
    detail: 'Les fiches se créent ici, une par une ou par import d’un classeur.',
  };
}

/**
 * L'export part des filtres de l'URL, pas de la page affichée : celui qui
 * envoie le fichier doit pouvoir jurer qu'il contient ce qu'il avait sous les
 * yeux.
 */
function MenuExport({
  filters,
  total,
  activeFilterCount,
}: {
  filters: RepresentantFilters;
  total: number;
  activeFilterCount: number;
}) {
  const exporter = useFileDownload();
  const filtres =
    activeFilterCount === 0
      ? 'Aucun filtre actif'
      : `${String(activeFilterCount)} filtre${activeFilterCount > 1 ? 's' : ''} appliqué${activeFilterCount > 1 ? 's' : ''}`;

  const telecharger = (mode: 'filtered' | 'all') => () => {
    void exporter.download({
      url: buildRepresentantsExportUrl(filters, mode),
      fileName: representantsExportFileName(new Date(), mode),
      failureMessage: 'L’export n’a pas pu être généré.',
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" disabled={exporter.pending} />}
      >
        {exporter.pending ? (
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileSpreadsheetIcon aria-hidden="true" />
        )}
        Exporter
        <ChevronDownIcon className="size-4 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Export Excel</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="items-start gap-3 py-2.5"
          disabled={total === 0}
          onClick={telecharger('filtered')}
        >
          <FileSpreadsheetIcon className="mt-0.5" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-[600]">Exporter la vue filtrée</span>
            <span className="text-[0.75rem] text-muted-foreground">{filtres}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="items-start gap-3 py-2.5" onClick={telecharger('all')}>
          <LayersIcon className="mt-0.5" aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-[600]">Exporter tous les représentants</span>
            <span className="text-[0.75rem] text-muted-foreground">
              Aucun filtre de la liste n’est appliqué.
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PiedTableau({
  isPending,
  isError,
  total,
  first,
  last,
  ambassadorCount,
  page,
  pageCount,
  onPageChange,
}: {
  isPending: boolean;
  isError: boolean;
  total: number;
  first: number;
  last: number;
  ambassadorCount: number | null;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (isPending || isError) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/*
          L'intitulé est DONNÉ EN TEXTE (`sr-only`), pas en `aria-label` :
          `aria-label` est interdit sur un `<p>` (rôle `paragraph`, liste « name
          prohibited » d'ARIA 1.2), et là où un lecteur d'écran l'honore quand
          même, le nom REMPLACE le contenu annoncé : l'utilisateur entendrait
          l'intitulé au lieu du décompte. Le préfixe suffit à distinguer cette
          région de celle du Toaster. `role="status"` implique déjà
          `aria-live="polite"`.
        */}
      <p className="text-[0.8125rem] text-muted-foreground" role="status">
        <span className="sr-only">Représentants affichés&nbsp;: </span>
        {libelleResultats(total, first, last, ambassadorCount)}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Page précédente"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
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
            onPageChange(page + 1);
          }}
        >
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function RepresentantsView({
  canAdminister,
  readOnly = false,
  canExport = !readOnly,
  campaignScoped = false,
}: {
  canAdminister: boolean;
  readOnly?: boolean;
  canExport?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campaignScoped?: boolean;
}) {
  const { filters, setFilters } = useRepresentantFilters();
  const [editing, setEditing] = useState<{ representant: RepresentantRow | null } | null>(null);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.representants(filters),
    queryFn: () => fetchRepresentants(filters),
    placeholderData: (previous) => previous,
  });

  // Le total de ceux qui ont accepté porte sur la SÉLECTION entière, pas sur la page :
  // l'API ne le rend pas avec la liste, il se lit sur le `total` d'une seconde
  // requête aux mêmes critères.
  const ambassadorFilters: RepresentantFilters = {
    ...filters,
    relationStatus: 'AMBASSADEUR',
    page: 1,
  };
  const ambassadors = useQuery({
    queryKey: queryKeys.representants(ambassadorFilters),
    queryFn: () => fetchRepresentants(ambassadorFilters),
    placeholderData: (previous) => previous,
  });
  const ambassadorCount = ambassadorCountDe(filters, ambassadors.data);

  const { data: reference } = useQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(),
    staleTime: 5 * 60_000,
  });

  const { total, page, pageCount, first, last } = pagination(data, filters.pageSize);
  const activeFilterCount = countActiveRepresentantFilters(filters);
  const filtres = filtresDesColonnes(filters, setFilters, reference);

  function toggleSort(columnId: string): void {
    if (!isSortField(columnId)) return;
    if (filters.sortBy === columnId) {
      setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    setFilters({ sortBy: columnId, sortDir: 'asc' });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Personnes qui remettent les listes de prospects. Les fiches se saisissent ici ou
          s’importent d’un classeur.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {readOnly ? null : (
            <Button
              type="button"
              onClick={() => {
                setEditing({ representant: null });
              }}
            >
              <PlusIcon aria-hidden="true" />
              Nouveau représentant
            </Button>
          )}

          {canAdminister ? (
            // Un LIEN habillé en bouton : la primitive `Button` de Base UI
            // poserait `role="button"` sur le `<a>`.
            <Link
              href="/teleconseil/representants/import"
              className={buttonVariants({ variant: 'outline' })}
            >
              <UploadIcon aria-hidden="true" />
              Import Excel
            </Link>
          ) : null}

          {canExport ? (
            <MenuExport filters={filters} total={total} activeFilterCount={activeFilterCount} />
          ) : null}
        </div>
      </div>

      <RepresentantsFiltersBar />

      {(() => {
        if (isPending) return <TableSkeleton />;
        return (() => {
          if (isError)
            return (
              <QueryErrorState
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Liste des représentants non chargée."
              />
            );
          return (() => {
            if (data.items.length === 0)
              return (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
                  <UsersRoundIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="font-[600]">
                    {messageVide(activeFilterCount, campaignScoped).titre}
                  </p>
                  <p className="max-w-md text-[0.8125rem] text-muted-foreground">
                    {messageVide(activeFilterCount, campaignScoped).detail}
                  </p>
                </div>
              );
            return (
              <>
                {/* ─── Cartes : sous 1024 px ────────────────────────────────── */}
                <ul className={cn('flex flex-col gap-3 lg:hidden', isFetching && 'opacity-80')}>
                  {data.items.map((representant) => (
                    <li key={representant.id}>
                      <RepresentantCard
                        representant={representant}
                        onEdit={
                          readOnly
                            ? null
                            : () => {
                                setEditing({ representant });
                              }
                        }
                      />
                    </li>
                  ))}
                </ul>

                {/* ─── Tableau : à partir de 1024 px ────────────────────────── */}
                <div
                  className={cn(
                    'hidden overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity lg:block',
                    isFetching && 'opacity-80',
                  )}
                >
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <SortableTableHead
                          column={{ id: 'fullName', label: 'Représentant' }}
                          sortBy={filters.sortBy}
                          sortDir={filters.sortDir}
                          onToggle={toggleSort}
                        />
                        {/* Trier la qualification, c'est remonter les statuts
                            prioritaires : c'est ce que « priorite » ordonne. */}
                        <FilterableTableHead
                          label="Qualification"
                          filtre={filtres.qualification}
                          tri={{
                            column: { id: 'priorite', label: 'Qualification' },
                            sortBy: filters.sortBy,
                            sortDir: filters.sortDir,
                            onToggle: toggleSort,
                          }}
                        />
                        <TableHead>Téléphone</TableHead>
                        <FilterableTableHead label="Département" filtre={filtres.departement} />
                        <FilterableTableHead label="IEF" filtre={filtres.ief} />
                        <FilterableTableHead label="Saisi par" filtre={filtres.saisiPar} />
                        <FilterableTableHead
                          className="text-right"
                          label="Prospects"
                          filtre={filtres.prospects}
                          tri={{
                            column: { id: 'prospects', label: 'Prospects' },
                            sortBy: filters.sortBy,
                            sortDir: filters.sortDir,
                            onToggle: toggleSort,
                          }}
                        />
                        <SortableTableHead
                          column={{ id: 'clientCreatedAt', label: 'Première saisie' }}
                          sortBy={filters.sortBy}
                          sortDir={filters.sortDir}
                          onToggle={toggleSort}
                        />
                        {readOnly ? null : (
                          <TableHead className="w-24">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((representant) => (
                        <TableRow key={representant.id}>
                          <TableCell className="font-[600]">
                            <Link
                              href={`/teleconseil/representants/${representant.id}`}
                              className="hover:underline focus-visible:underline"
                            >
                              {representant.fullName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <RelationBadge
                              status={representant.relationStatus}
                              label={representant.statutQualificationLabel}
                              effect={representant.statutQualificationEffect}
                            />
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatPhone(representant.phoneE164)}
                          </TableCell>
                          <TableCell>{representant.departementName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {/* Un tiret demi-cadratin, et non « aucune » : les fiches
                          saisies avant l'arrivée du référentiel n'en portent
                          pas, et ce n'est pas une anomalie à commenter. */}
                            {representant.iefName ?? NO_VALUE}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {representant.createdByName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(representant.prospectCount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(representant.clientCreatedAt)}
                          </TableCell>
                          {readOnly ? null : (
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Modifier la fiche de ${representant.fullName}`}
                                onClick={() => {
                                  setEditing({ representant });
                                }}
                              >
                                <PencilIcon className="size-4" aria-hidden="true" />
                                <span aria-hidden="true">Modifier</span>
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })();
        })();
      })()}

      {/*
        Le pied de tableau n'existe QUE sur la branche chargée.

        Auparavant il vivait hors du ternaire d'état : pendant la première
        requête `total` vaut 0, et la région live annonçait donc « Aucun
        résultat » par-dessus le squelette : puis de nouveau par-dessus la carte
        d'erreur, qu'elle contredisait. La pagination affichait « 1 / 1 » dans
        les deux cas.
      */}
      <PiedTableau
        isPending={isPending}
        isError={isError}
        total={total}
        first={first}
        last={last}
        ambassadorCount={ambassadorCount}
        page={page}
        pageCount={pageCount}
        onPageChange={(nextPage) => {
          setFilters({ page: nextPage });
        }}
      />

      <RepresentantFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        representant={representantEnEdition(editing)}
      />
    </div>
  );
}

function RepresentantCard({
  representant,
  onEdit,
}: {
  representant: RepresentantRow;
  onEdit: (() => void) | null;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-[600]">
            <Link
              href={`/teleconseil/representants/${representant.id}`}
              className="hover:underline focus-visible:underline"
            >
              {representant.fullName}
            </Link>
          </p>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {formatPhone(representant.phoneE164)}
          </p>
          <div className="mt-1.5">
            <RelationBadge
              status={representant.relationStatus}
              label={representant.statutQualificationLabel}
              effect={representant.statutQualificationEffect}
            />
          </div>
        </div>
        {/*
          Le compte de prospects reste l'information CENTRALE : c'est lui qui dit
          si une fiche compte. Il garde donc le poids typographique qu'il a dans
          le tableau, plutôt que de se fondre dans la liste des attributs.
        */}
        <p className="shrink-0 text-right">
          <span className="block font-display text-[1.25rem] font-[800] leading-none tabular-nums">
            {formatNumber(representant.prospectCount)}
          </span>
          <span className="block text-[0.6875rem] text-muted-foreground">
            prospect{representant.prospectCount === 1 ? '' : 's'}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-muted-foreground">Département</dt>
          <dd className="truncate">{representant.departementName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-muted-foreground">IEF</dt>
          <dd className="truncate text-muted-foreground">{representant.iefName ?? NO_VALUE}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-muted-foreground">Saisi par</dt>
          <dd className="truncate text-muted-foreground">{representant.createdByName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-muted-foreground">Première saisie</dt>
          <dd className="truncate text-muted-foreground">
            {formatDate(representant.clientCreatedAt)}
          </dd>
        </div>
      </dl>

      {onEdit === null ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          aria-label={`Modifier la fiche de ${representant.fullName}`}
          onClick={onEdit}
        >
          <PencilIcon className="size-4" aria-hidden="true" />
          <span aria-hidden="true">Modifier</span>
        </Button>
      )}
    </article>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm">
      <div className="flex h-11 items-center gap-4 border-b border-border px-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-3 py-4">
          {[0, 1, 2, 3, 4, 5].map((cell) => (
            <Skeleton key={cell} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
