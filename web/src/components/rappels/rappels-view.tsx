'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { ClockIcon, PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { QueryErrorState } from '@/components/query-error-state';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { Badge } from '@/components/ui/badge';
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
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useTriLocal } from '@/components/ui/tri-local';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  callbackKeys,
  cancelCallback,
  fetchCallbacks,
  formatCallbackAt,
  formatDelay,
  type Callback,
  type CallbackList,
  type CallbackScope,
} from '@/lib/data/console';
import { fetchUsers } from '@/lib/data/users';
import { formatNumber, formatPhone } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import type { Projet } from '@/lib/types';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

/** La liste s'arrête à 500 rappels : le reste se dit, il ne se devine pas. */
function NoteListeTronquee({ affichees, total }: { affichees: number; total: number | undefined }) {
  if (total === undefined || total <= affichees) return null;
  return (
    <p className="text-[0.875rem] text-muted-foreground">
      {formatNumber(total)} rappels au total, les {formatNumber(affichees)} plus proches affichés.
      Réduisez la liste avec les filtres.
    </p>
  );
}

const PROJET_OPTIONS = [
  { value: 'CHUES', label: 'CHUES' },
  { value: 'GRAND_PUBLIC', label: 'Grand Public' },
];

const SCOPES: readonly { value: CallbackScope; label: string }[] = [
  { value: 'overdue', label: 'En retard' },
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'week', label: 'Cette semaine' },
];

const EMPTY_TEXT: Record<CallbackScope, { title: string; description: string }> = {
  overdue: {
    title: 'Aucun rappel en retard',
    description: 'Les échéances promises sont tenues.',
  },
  today: {
    title: 'Aucun rappel aujourd’hui',
    description: 'Une échéance se promet en consignant un appel.',
  },
  week: {
    title: 'Aucun rappel cette semaine',
    description: 'Une échéance se promet en consignant un appel.',
  },
  all: {
    title: 'Aucun rappel promis',
    description: 'Aucun rappel ne correspond aux critères sélectionnés.',
  },
};

function filterCallbackBySearch(cb: Callback, search: string): boolean {
  if (search.trim() === '') return true;
  const q = search.trim().toLowerCase();
  return (
    cb.prospectName.toLowerCase().includes(q) ||
    (cb.phoneE164 ?? '').toLowerCase().includes(q) ||
    (cb.comment ?? '').toLowerCase().includes(q)
  );
}

const COLONNES_RAPPELS = {
  prospect: (cb: Callback) => (cb.prospectName === '' ? cb.phoneE164 : cb.prospectName),
  projet: (cb: Callback) => cb.projet,
  echeance: (cb: Callback) => cb.scheduledAt,
  retard: (cb: Callback) => cb.overdue,
  commentaire: (cb: Callback) => cb.comment,
  teleconseiller: (cb: Callback) => cb.assignedToName,
};

function RappelsTable({
  list,
  filteredItems,
  canFilter,
  racine,
  scope,
  cancelPending,
  onCancel,
  onPage,
}: {
  list: UseQueryResult<CallbackList>;
  filteredItems: Callback[];
  canFilter: boolean;
  racine: string;
  scope: CallbackScope;
  cancelPending: boolean;
  onCancel: (callback: Callback) => void;
  onPage: (page: number) => void;
}) {
  const tri = useTriLocal(filteredItems, COLONNES_RAPPELS);
  if (list.isPending) return <Skeleton className="h-64" />;
  if (list.isError) {
    return (
      <QueryErrorState
        error={list.error}
        fallback="Les rappels n’ont pas pu être lus."
        onRetry={() => {
          void list.refetch();
        }}
      />
    );
  }
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        icon={ClockIcon}
        title={EMPTY_TEXT[scope].title}
        description={EMPTY_TEXT[scope].description}
      />
    );
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column={{ id: 'prospect', label: 'Prospect' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            <SortableTableHead
              column={{ id: 'projet', label: 'Projet' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            <SortableTableHead
              column={{ id: 'echeance', label: 'Échéance' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            <SortableTableHead
              column={{ id: 'retard', label: 'Retard' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            <SortableTableHead
              column={{ id: 'commentaire', label: 'Commentaire' }}
              sortBy={tri.sortBy}
              sortDir={tri.sortDir}
              onToggle={tri.toggle}
            />
            {canFilter ? (
              <SortableTableHead
                column={{ id: 'teleconseiller', label: 'Téléconseiller' }}
                sortBy={tri.sortBy}
                sortDir={tri.sortDir}
                onToggle={tri.toggle}
              />
            ) : null}
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tri.lignes.map((callback) => (
            <TableRow key={callback.id}>
              <TableCell>
                <Link
                  href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
                  className="font-[600] underline-offset-4 hover:underline"
                >
                  {callback.prospectName === ''
                    ? formatPhone(callback.phoneE164)
                    : callback.prospectName}
                </Link>
                <span className="block text-[0.8125rem] tabular-nums text-muted-foreground">
                  {formatPhone(callback.phoneE164)}
                </span>
              </TableCell>
              <TableCell>
                <ProjetBadge projet={callback.projet} />
              </TableCell>
              <TableCell>
                <time dateTime={callback.scheduledAt}>
                  {formatCallbackAt(callback.scheduledAt, Date.parse(list.data.serverTime))}
                </time>
              </TableCell>
              <TableCell>
                {callback.overdue ? (
                  <Badge variant="destructive">
                    {formatDelay(
                      Date.parse(list.data.serverTime) - Date.parse(callback.scheduledAt),
                    )}
                  </Badge>
                ) : (
                  <Badge variant="secondary">À venir</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-80 text-muted-foreground">
                {callback.comment ?? ''}
              </TableCell>
              {canFilter ? <TableCell>{callback.assignedToName}</TableCell> : null}
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Link
                    href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
                    className={buttonVariants({ variant: 'default', size: 'sm' })}
                  >
                    <PhoneCallIcon aria-hidden="true" />
                    Consigner l’appel
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={cancelPending}
                    onClick={() => {
                      onCancel(callback);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <NoteListeTronquee affichees={list.data.items.length} total={list.data.total} />
      {list.data.pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={list.data.page <= 1} onClick={() => onPage(list.data.page - 1)}>
            Précédente
          </Button>
          <span>Page {list.data.page} sur {list.data.pageCount}</span>
          <Button variant="outline" size="sm" disabled={list.data.page >= list.data.pageCount} onClick={() => onPage(list.data.page + 1)}>
            Suivante
          </Button>
        </div>
      ) : null}
    </>
  );
}

function OverdueStatusCount({
  isSuccess,
  count,
  canFilter,
}: {
  isSuccess: boolean;
  count: number;
  canFilter: boolean;
}) {
  if (!isSuccess)
    return <span className="text-muted-foreground">Retards en cours de lecture.</span>;
  return (
    <>
      <span className="font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
        {formatNumber(count)}
      </span>{' '}
      rappel{count > 1 ? 's' : ''} en retard
      {canFilter ? ' chez les téléconseillers' : ''}
    </>
  );
}

function RappelsFilterControls({
  search,
  setSearch,
  projet,
  setProjet,
  canFilter,
  teleconseillers,
  assignedToId,
  setAssignedToId,
}: {
  search: string;
  setSearch: (search: string) => void;
  projet: Projet | null;
  setProjet: (projet: Projet | null) => void;
  canFilter: boolean;
  teleconseillers: { id: string; fullName: string }[];
  assignedToId: string | null;
  setAssignedToId: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Nom, téléphone…"
        className="w-64"
      />
      <FilterCombobox
        label="Projet"
        placeholder="Tous les projets"
        options={PROJET_OPTIONS}
        value={projet}
        onChange={(value) => {
          setProjet((value as Projet) || null);
        }}
      />
      {canFilter ? (
        <FilterCombobox
          label="Téléconseiller"
          placeholder="Tous les téléconseillers"
          className="w-72"
          options={teleconseillers.map((user) => ({
            value: user.id,
            label: user.fullName,
          }))}
          value={assignedToId}
          onChange={setAssignedToId}
        />
      ) : null}
    </div>
  );
}

export function RappelsView({ canFilter }: { canFilter: boolean }) {
  const racine = '/teleconseil';
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<CallbackScope>('overdue');
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [projet, setProjet] = useState<Projet | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const overdue = useQuery({
    queryKey: [...callbackKeys.list('overdue', assignedToId), projet, page],
    queryFn: () => fetchCallbacks('overdue', assignedToId, undefined, projet ?? undefined, page),
  });

  const list = useQuery({
    queryKey: [...callbackKeys.list(scope, assignedToId), projet, page],
    queryFn: () => fetchCallbacks(scope, assignedToId, undefined, projet ?? undefined, page),
  });

  const filteredItems = (list.data?.items ?? []).filter((cb) => filterCallbackBySearch(cb, search));

  const teleconseillers = useQuery({
    queryKey: callbackKeys.teleconseillers,
    queryFn: () =>
      fetchUsers({ ...EMPTY_USER_FILTERS, role: 'COMMERCIAL', isActive: true, pageSize: 200 }),
    enabled: canFilter,
    staleTime: 300_000,
  });

  const cancel = useMutation({
    mutationFn: (callback: Callback) => cancelCallback(callback.id),
    onSuccess: () => {
      toast.success('Rappel annulé.');
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error) => {
      toastApiError(error, 'Le rappel n’a pas été annulé.');
    },
  });

  const overdueCount = overdue.data?.items.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.9375rem]" role="status">
          <OverdueStatusCount
            isSuccess={overdue.isSuccess}
            count={overdueCount}
            canFilter={canFilter}
          />
        </p>

        <RappelsFilterControls
          search={search}
          setSearch={setSearch}
          projet={projet}
          setProjet={setProjet}
          canFilter={canFilter}
          teleconseillers={teleconseillers.data?.items ?? []}
          assignedToId={assignedToId}
          setAssignedToId={setAssignedToId}
        />
      </div>

      <Tabs
        value={scope}
        onValueChange={(value) => {
          setScope(value as CallbackScope);
        }}
        className="gap-6"
      >
        <TabsList>
          {SCOPES.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.value === 'overdue' && overdueCount > 0 ? (
                <Badge variant="destructive">{formatNumber(overdueCount)}</Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {SCOPES.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {scope === tab.value ? (
              <RappelsTable
                list={list}
                filteredItems={filteredItems}
                canFilter={canFilter}
                racine={racine}
                scope={scope}
                onPage={setPage}
                cancelPending={cancel.isPending}
                onCancel={(cb) => {
                  cancel.mutate(cb);
                }}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
