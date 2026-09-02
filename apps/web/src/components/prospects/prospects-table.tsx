'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { prospectColumns } from '@/components/prospects/columns';
import { ProspectEditDialog } from '@/components/prospects/prospect-edit-dialog';
import { ProspectMergeDialog } from '@/components/prospects/prospect-merge-dialog';
import { ProspectReassignDialog } from '@/components/prospects/prospect-reassign-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deleteProspect, fetchProspects } from '@/lib/data/prospects';
import { PAGE_SIZE_OPTIONS } from '@/lib/filters';
import { formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { PROSPECT_SORT_FIELDS, type ProspectRow, type ProspectSortField } from '@/lib/types';
import { cn } from '@/lib/utils';

function isSortField(id: string): id is ProspectSortField {
  return (PROSPECT_SORT_FIELDS as readonly string[]).includes(id);
}

export function ProspectsTable({
  canAdminister,
  readOnly = false,
  campaignScoped = false,
}: {
  canAdminister: boolean;
  readOnly?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campaignScoped?: boolean;
}) {
  const { filters, setFilters } = useProspectFilters();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<ProspectRow | null>(null);
  const [merging, setMerging] = useState<ProspectRow | null>(null);
  const [reassigning, setReassigning] = useState<ProspectRow | null>(null);
  const [deleting, setDeleting] = useState<ProspectRow | null>(null);

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.prospects(filters),
    queryFn: () => fetchProspects(filters),
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (target: ProspectRow) => deleteProspect(target.id),
    onSuccess: (_result, target) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.prospectsRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardRoot });
      toast.success(`${target.prenom} ${target.nom} supprimé. Le numéro redevient disponible.`);
      setDeleting(null);
    },
    onError: (error) => {
      toastApiError(error, 'La suppression a échoué.');
    },
  });

  const columns = useMemo(
    () =>
      prospectColumns({
        projet: filters.projet,
        canAdminister: canAdminister && !readOnly,
        readOnly,
        onEdit: setEditing,
        onMerge: setMerging,
        onReassign: setReassigning,
        onDelete: setDeleting,
      }),
    [canAdminister, filters.projet, readOnly],
  );

  // oxlint-disable-next-line react/incompatible-library -- faux positif TanStack Table
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: data?.pageCount ?? 0,
    state: {
      sorting: [{ id: filters.sortBy, desc: filters.sortDir === 'desc' }],
    },
  });

  function toggleSort(columnId: string): void {
    if (!isSortField(columnId)) return;
    if (filters.sortBy === columnId) {
      setFilters({ sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sortBy: columnId, sortDir: 'asc' });
    }
  }

  if (isPending) return <ProspectsTableSkeleton />;

  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => {
          void refetch();
        }}
        fallback="La liste des prospects n’a pas pu être chargée."
      />
    );
  }

  const total = data.total;
  const page = data.page;
  const pageCount = data.pageCount;
  const first = total === 0 ? 0 : (page - 1) * filters.pageSize + 1;
  const last = Math.min(page * filters.pageSize, total);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
          isFetching && 'opacity-80',
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const label = flexRender(header.column.columnDef.header, header.getContext());
                  return isSortField(header.column.id) ? (
                    <SortableTableHead
                      key={header.id}
                      column={{ id: header.column.id, label }}
                      sortBy={filters.sortBy}
                      sortDir={filters.sortDir}
                      onToggle={toggleSort}
                    />
                  ) : (
                    <TableHead key={header.id}>{label}</TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <InboxIcon className="size-8 text-muted-foreground" aria-hidden="true" />
                    <p className="font-[600]">Aucun prospect ne correspond à ces filtres.</p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {campaignScoped
                        ? 'Vos campagnes n’en contiennent aucun.'
                        : 'Élargissez la période ou retirez un critère.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          Région live à laquelle son intitulé est DONNÉ EN TEXTE, pas en
          `aria-label`.

          Deux pièges évités ici :
          : `aria-label` sur un `<p>` est INTERDIT : le rôle `paragraph` figure
            sur la liste « name prohibited » d'ARIA 1.2. Là où un lecteur
            d'écran l'honore quand même, le nom REMPLACE le contenu annoncé :
            l'utilisateur entend l'intitulé et jamais le décompte, soit
            exactement l'inverse du but recherché.
          : le `Toaster` de Sonner monte lui aussi une région `aria-live="polite"`,
            plus haut dans le DOM. Un préfixe en `sr-only` distingue les deux
            sans recourir à un attribut interdit.

          `role="status"` implique déjà `aria-live="polite"`.
        */}
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
              <SelectTrigger size="sm" className="w-20">
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

      <ProspectEditDialog
        prospect={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
      <ProspectMergeDialog
        prospect={merging}
        onOpenChange={(open) => {
          if (!open) setMerging(null);
        }}
      />
      <ProspectReassignDialog
        prospect={reassigning}
        onOpenChange={(open) => {
          if (!open) setReassigning(null);
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce prospect ?</DialogTitle>
            <DialogDescription>
              {deleting === null
                ? null
                : `${deleting.prenom} ${deleting.nom}, ${formatPhone(deleting.phoneE164)}. La fiche est retirée des listes et des exports, le numéro redevient disponible.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleting(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (deleting !== null) remove.mutate(deleting);
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProspectsTableSkeleton() {
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
