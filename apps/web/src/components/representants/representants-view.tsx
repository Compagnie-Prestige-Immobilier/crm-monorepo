'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileSpreadsheetIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  UploadIcon,
  UsersRoundIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useFileDownload } from '@/components/exports/download-button';
import { QueryErrorState } from '@/components/query-error-state';
import { RepresentantFormDialog } from '@/components/representants/representant-form-dialog';
import { RepresentantsFiltersBar } from '@/components/representants/representants-filters-bar';
import { useRepresentantFilters } from '@/components/representants/use-representant-filters';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchRepresentants } from '@/lib/data/representants';
import {
  buildRepresentantsExportUrl,
  representantsExportFileName,
} from '@/lib/data/representants-import';
import { formatDate, formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { countActiveRepresentantFilters } from '@/lib/representant-filters';
import type { RepresentantRow } from '@/lib/types';
import { cn } from '@/lib/utils';

const NO_VALUE = '–';

export function RepresentantsView({
  canAdminister,
  readOnly = false,
}: {
  canAdminister: boolean;
  readOnly?: boolean;
}) {
  const { filters, setFilters } = useRepresentantFilters();
  const exporter = useFileDownload();
  const [editing, setEditing] = useState<{ representant: RepresentantRow | null } | null>(null);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.representants(filters),
    queryFn: () => fetchRepresentants(filters),
    placeholderData: (previous) => previous,
  });

  const total = data?.total ?? 0;
  const page = data?.page ?? 1;
  const pageCount = data?.pageCount ?? 1;
  const first = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const last = Math.min(page * filters.pageSize, total);
  const activeFilterCount = countActiveRepresentantFilters(filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">
          Personnes qui remettent les listes de prospects. Les fiches naissent en tournée, sur
          l’application mobile ; la saisie et l’import ci-contre couvrent les exceptions.
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
            <Link href="/representants/import" className={buttonVariants({ variant: 'outline' })}>
              <UploadIcon aria-hidden="true" />
              Import Excel
            </Link>
          ) : null}

          {/* L'export part des filtres de l'URL, pas de la page affichée :
              celui qui envoie le fichier doit pouvoir jurer qu'il contient ce
              qu'il avait sous les yeux. */}
          {readOnly ? null : (
            <Button
              type="button"
              variant="outline"
              disabled={exporter.pending || total === 0}
              onClick={() => {
                void exporter.download({
                  url: buildRepresentantsExportUrl(filters),
                  fileName: representantsExportFileName(),
                  failureMessage: 'L’export n’a pas pu être généré.',
                });
              }}
            >
              {exporter.pending ? (
                <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileSpreadsheetIcon aria-hidden="true" />
              )}
              Exporter
            </Button>
          )}
        </div>
      </div>

      <RepresentantsFiltersBar />

      {isPending ? (
        <TableSkeleton />
      ) : isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Liste des représentants non chargée."
        />
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center shadow-elev-sm">
          <UsersRoundIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-[600]">
            {activeFilterCount === 0
              ? 'Aucun représentant enregistré.'
              : 'Aucun représentant ne correspond à ces critères.'}
          </p>
          <p className="max-w-md text-[0.8125rem] text-muted-foreground">
            {activeFilterCount === 0
              ? 'Les fiches sont saisies en tournée depuis le mobile, ou créées ici, une par une ou par import d’un classeur.'
              : 'Élargissez la recherche ou retirez un filtre.'}
          </p>
        </div>
      ) : (
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
                  <TableHead>Représentant</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>IEF</TableHead>
                  <TableHead>Saisi par</TableHead>
                  <TableHead className="text-right">Prospects</TableHead>
                  <TableHead>Première saisie</TableHead>
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
                    <TableCell className="font-[600]">{representant.fullName}</TableCell>
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
      )}

      {/*
        Le pied de tableau n'existe QUE sur la branche chargée.

        Auparavant il vivait hors du ternaire d'état : pendant la première
        requête `total` vaut 0, et la région live annonçait donc « Aucun
        résultat » par-dessus le squelette : puis de nouveau par-dessus la carte
        d'erreur, qu'elle contredisait. La pagination affichait « 1 / 1 » dans
        les deux cas.
      */}
      {isPending || isError ? null : (
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
            {total === 0
              ? 'Aucun résultat'
              : `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`}
          </p>

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
      )}

      <RepresentantFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        representant={editing?.representant ?? null}
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
          <p className="truncate font-[600]">{representant.fullName}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {formatPhone(representant.phoneE164)}
          </p>
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
