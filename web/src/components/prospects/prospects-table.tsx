'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable, type Row } from '@tanstack/react-table';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { prospectColumns } from '@/components/prospects/columns';
import { ProjetBadge } from '@/components/prospects/projet-badge';
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
import {
  PROSPECT_SORT_FIELDS,
  PROSPECT_STATUT_LABELS,
  statutForProjet,
  type Paginated,
  type ProspectFilters,
  type ProspectRow,
  type ProspectSortField,
} from '@/lib/types';
import { cn } from '@/lib/utils';

function isSortField(id: string): id is ProspectSortField {
  return (PROSPECT_SORT_FIELDS as readonly string[]).includes(id);
}

function tableSourceData(data: Paginated<ProspectRow> | undefined): {
  items: ProspectRow[];
  pageCount: number;
} {
  if (data === undefined) return { items: [], pageCount: 0 };
  return { items: data.items, pageCount: data.pageCount };
}

function rangeLabel(first: number, last: number, total: number): string {
  if (total === 0) return 'Aucun résultat';
  return `${formatNumber(first)}–${formatNumber(last)} sur ${formatNumber(total)}`;
}

function deleteSummary(deleting: ProspectRow | null): string | null {
  if (deleting === null) return null;
  return `${deleting.prenom} ${deleting.nom}, ${formatPhone(deleting.phoneE164)}. La fiche est retirée des listes et des exports, le numéro redevient disponible.`;
}

type Regroupement = 'aucun' | 'projet' | 'statut';

interface GroupeProspects {
  cle: string;
  libelle: string;
  projet: ProspectRow['projet'] | null;
  lignes: Row<ProspectRow>[];
}

function identiteGroupe(
  prospect: ProspectRow,
  regroupement: Exclude<Regroupement, 'aucun'>,
  projetFiltre: ProspectFilters['projet'],
): Pick<GroupeProspects, 'cle' | 'libelle' | 'projet'> {
  if (regroupement === 'projet') {
    return {
      cle: prospect.projet,
      libelle: prospect.projet === 'CHUES' ? 'CHUES' : 'Grand Public',
      projet: prospect.projet,
    };
  }
  const statut = statutForProjet(prospect, projetFiltre);
  return { cle: statut, libelle: PROSPECT_STATUT_LABELS[statut], projet: null };
}

function regrouperProspects(
  lignes: Row<ProspectRow>[],
  regroupement: Regroupement,
  projetFiltre: ProspectFilters['projet'],
): GroupeProspects[] {
  if (regroupement === 'aucun') return [];
  const groupes = new Map<string, GroupeProspects>();
  for (const ligne of lignes) {
    const identite = identiteGroupe(ligne.original, regroupement, projetFiltre);
    const groupe = groupes.get(identite.cle);
    if (groupe !== undefined) groupe.lignes.push(ligne);
    else groupes.set(identite.cle, { ...identite, lignes: [ligne] });
  }
  return [...groupes.values()];
}

export function ProspectsTable({
  canAdminister,
  canReassign: canReassignProp,
  readOnly: readOnlyProp,
  campaignScoped: campaignScopedProp,
}: {
  canAdminister: boolean;
  /** SUPERVISEUR : réaffecter une fiche malgré la lecture seule du reste. */
  canReassign?: boolean;
  readOnly?: boolean;
  /** Téléconseiller : l'API ne lui rend que ses fiches et celles de ses campagnes. */
  campaignScoped?: boolean;
}) {
  const readOnly = Boolean(readOnlyProp);
  const canReassign = Boolean(canReassignProp);
  const campaignScoped = Boolean(campaignScopedProp);
  const { filters, setFilters } = useProspectFilters();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<ProspectRow | null>(null);
  const [merging, setMerging] = useState<ProspectRow | null>(null);
  const [reassigning, setReassigning] = useState<ProspectRow | null>(null);
  const [deleting, setDeleting] = useState<ProspectRow | null>(null);
  const [regroupement, setRegroupement] = useState<Regroupement>('aucun');
  const [groupesFermes, setGroupesFermes] = useState<ReadonlySet<string>>(new Set());

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

  const columns = useMemo(() => {
    const toutes = prospectColumns({
      projet: filters.projet,
      canAdminister: canAdminister && !readOnly,
      canReassign,
      readOnly,
      onEdit: setEditing,
      onMerge: setMerging,
      onReassign: setReassigning,
      onDelete: setDeleting,
    });
    return regroupement === 'projet' ? toutes.filter((column) => column.id !== 'projet') : toutes;
  }, [canAdminister, canReassign, filters.projet, readOnly, regroupement]);

  const source = tableSourceData(data);

  // oxlint-disable-next-line react/incompatible-library -- faux positif TanStack Table
  const table = useReactTable({
    data: source.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: source.pageCount,
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
  const lignes = table.getRowModel().rows;
  const groupes = regrouperProspects(lignes, regroupement, filters.projet);

  const basculerGroupe = (cle: string): void => {
    setGroupesFermes((courants) => {
      const suivants = new Set(courants);
      if (suivants.has(cle)) suivants.delete(cle);
      else suivants.add(cle);
      return suivants;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Select
          value={regroupement}
          onValueChange={(value) => {
            setRegroupement(value as Regroupement);
            setGroupesFermes(new Set());
          }}
        >
          <SelectTrigger className="w-52" aria-label="Regrouper les prospects">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aucun">Ne pas regrouper</SelectItem>
            <SelectItem value="projet">Regrouper par projet</SelectItem>
            <SelectItem value="statut">Regrouper par statut</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
            <CorpsProspects
              lignes={lignes}
              groupes={groupes}
              regroupement={regroupement}
              groupesFermes={groupesFermes}
              campaignScoped={campaignScoped}
              colSpan={columns.length}
              onToggle={basculerGroupe}
            />
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
          {rangeLabel(first, last, total)}
        </p>

        <ProspectsTablePagination
          pageSize={filters.pageSize}
          page={page}
          pageCount={pageCount}
          setFilters={setFilters}
        />
      </div>

      <ProspectsTableDialogs
        editing={editing}
        setEditing={setEditing}
        merging={merging}
        setMerging={setMerging}
        reassigning={reassigning}
        setReassigning={setReassigning}
        deleting={deleting}
        setDeleting={setDeleting}
        onDelete={(target) => {
          remove.mutate(target);
        }}
        deletePending={remove.isPending}
      />
    </div>
  );
}

function CorpsProspects({
  lignes,
  groupes,
  regroupement,
  groupesFermes,
  campaignScoped,
  colSpan,
  onToggle,
}: {
  lignes: Row<ProspectRow>[];
  groupes: GroupeProspects[];
  regroupement: Regroupement;
  groupesFermes: ReadonlySet<string>;
  campaignScoped: boolean;
  colSpan: number;
  onToggle: (cle: string) => void;
}) {
  if (lignes.length === 0)
    return <ProspectsTableEmptyRow campaignScoped={campaignScoped} colSpan={colSpan} />;
  if (regroupement === 'aucun') return <LignesProspects lignes={lignes} />;
  return groupes.map((groupe) => (
    <GroupeProspectsRows
      key={groupe.cle}
      groupe={groupe}
      ferme={groupesFermes.has(groupe.cle)}
      colSpan={colSpan}
      onToggle={() => onToggle(groupe.cle)}
    />
  ));
}

function LignesProspects({ lignes }: { lignes: Row<ProspectRow>[] }) {
  return lignes.map((row) => (
    <TableRow key={row.id}>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ));
}

function GroupeProspectsRows({
  groupe,
  ferme,
  colSpan,
  onToggle,
}: {
  groupe: GroupeProspects;
  ferme: boolean;
  colSpan: number;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell colSpan={colSpan} className="p-0">
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left font-semibold"
            aria-expanded={!ferme}
            onClick={onToggle}
          >
            {ferme ? (
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="size-4" aria-hidden="true" />
            )}
            {groupe.projet === null ? groupe.libelle : <ProjetBadge projet={groupe.projet} />}
            <span className="text-sm font-normal text-muted-foreground">
              {formatNumber(groupe.lignes.length)}
            </span>
          </button>
        </TableCell>
      </TableRow>
      {ferme ? null : <LignesProspects lignes={groupe.lignes} />}
    </>
  );
}

function ProspectsTableEmptyRow({
  campaignScoped,
  colSpan,
}: {
  campaignScoped: boolean;
  colSpan: number;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-16">
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
  );
}

function ProspectsTablePagination({
  pageSize,
  page,
  pageCount,
  setFilters,
}: {
  pageSize: number;
  page: number;
  pageCount: number;
  setFilters: (patch: Partial<ProspectFilters>) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <span className="hidden sm:inline">Lignes</span>
        <Select
          value={String(pageSize)}
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
  );
}

function ProspectsTableDialogs({
  editing,
  setEditing,
  merging,
  setMerging,
  reassigning,
  setReassigning,
  deleting,
  setDeleting,
  onDelete,
  deletePending,
}: {
  editing: ProspectRow | null;
  setEditing: (value: ProspectRow | null) => void;
  merging: ProspectRow | null;
  setMerging: (value: ProspectRow | null) => void;
  reassigning: ProspectRow | null;
  setReassigning: (value: ProspectRow | null) => void;
  deleting: ProspectRow | null;
  setDeleting: (value: ProspectRow | null) => void;
  onDelete: (target: ProspectRow) => void;
  deletePending: boolean;
}) {
  return (
    <>
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
            <DialogDescription>{deleteSummary(deleting)}</DialogDescription>
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
              disabled={deletePending}
              onClick={() => {
                if (deleting !== null) onDelete(deleting);
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
