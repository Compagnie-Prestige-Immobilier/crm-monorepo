'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ClockIcon, PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { SearchField } from '@/components/filters/search-field';
import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import {
  AnnulerRappel,
  rendezVousFixe,
  useAnnulationRappel,
} from '@/components/rappels/rappel-pop-up-intrusif';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ListeCartes, NumeroAppel } from '@/components/ui/liste-cartes';
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
  fetchCallbacks,
  formatCallbackAt,
  formatDelay,
  type Callback,
  type CallbackList,
  type CallbackScope,
} from '@/lib/data/console';
import { fetchUsers } from '@/lib/data/users';
import { formatNumber, formatPhone } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { matchesSearch } from '@/lib/search';
import type { Projet } from '@/lib/types';
import { EMPTY_USER_FILTERS, type UserFilters } from '@/lib/user-filters';

const TELECONSEILLERS_ACTIFS: UserFilters = {
  ...EMPTY_USER_FILTERS,
  role: 'COMMERCIAL',
  isActive: true,
  pageSize: 200,
};

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

interface FiltresRappels {
  scope: CallbackScope;
  projet: Projet | null;
  teleconseiller: string | null;
  search: string;
  page: number;
}

/** L'onglet et les filtres vivent dans l'URL : revenir d'une consignation retombe au même endroit. */
const FILTRES_RAPPELS: UrlFilterAdapter<FiltresRappels> = {
  parse: (params) => {
    const page = Number(params.get('page'));
    const projet = params.get('projet');
    return {
      scope: SCOPES.find((tab) => tab.value === params.get('onglet'))?.value ?? 'overdue',
      projet: projet === 'CHUES' || projet === 'GRAND_PUBLIC' ? projet : null,
      teleconseiller: params.get('teleconseiller'),
      search: params.get('search') ?? '',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    };
  },
  serialize: (filtres) => {
    const params = new URLSearchParams();
    if (filtres.scope !== 'overdue') params.set('onglet', filtres.scope);
    if (filtres.projet !== null) params.set('projet', filtres.projet);
    if (filtres.teleconseiller !== null) params.set('teleconseiller', filtres.teleconseiller);
    if (filtres.search !== '') params.set('search', filtres.search);
    if (filtres.page > 1) params.set('page', String(filtres.page));
    return params;
  },
  cleared: (filtres) => ({ ...filtres, projet: null, teleconseiller: null, search: '', page: 1 }),
};

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

const filterCallbackBySearch = (cb: Callback, search: string): boolean =>
  matchesSearch(`${cb.prospectName} ${cb.phoneE164 ?? ''} ${cb.comment ?? ''}`, search);

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
        action={
          list.data.page > 1 ? (
            <Button variant="outline" size="sm" onClick={() => onPage(1)}>
              Revenir à la première page
            </Button>
          ) : undefined
        }
      />
    );
  }
  const serverTimeMs = Date.parse(list.data.serverTime);
  const actions = (callback: Callback) => (
    <>
      <Link
        href={`${racine}/console?fiche=${encodeURIComponent(callback.prospectId)}`}
        className={buttonVariants({ variant: 'default', size: 'sm' })}
      >
        <PhoneCallIcon aria-hidden="true" />
        Consigner l’appel
      </Link>
      {rendezVousFixe(callback) ? null : (
        <AnnulerRappel
          callback={callback}
          pending={cancelPending}
          onAnnuler={() => {
            onCancel(callback);
          }}
        />
      )}
    </>
  );
  return (
    <>
      <ListeCartes
        items={tri.lignes}
        libelle="Rappels promis"
        cle={(callback) => callback.id}
        titre={nomDuRappel}
        sousTitre={(callback) => (
          <>
            <ProjetBadge projet={callback.projet} />
            <time dateTime={callback.scheduledAt}>
              {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
            </time>
            <Retard callback={callback} serverTimeMs={serverTimeMs} />
            {canFilter ? <span>{callback.assignedToName}</span> : null}
          </>
        )}
        numero={(callback) => callback.phoneE164}
        action={actions}
      />
      <Table containerClassName="hidden md:block">
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
                  {nomDuRappel(callback)}
                </Link>
                <NumeroAppel
                  phoneE164={callback.phoneE164}
                  className="block w-fit text-[0.8125rem] text-muted-foreground"
                />
              </TableCell>
              <TableCell>
                <ProjetBadge projet={callback.projet} />
              </TableCell>
              <TableCell>
                <time dateTime={callback.scheduledAt}>
                  {formatCallbackAt(callback.scheduledAt, serverTimeMs)}
                </time>
              </TableCell>
              <TableCell>
                <Retard callback={callback} serverTimeMs={serverTimeMs} />
              </TableCell>
              <TableCell className="max-w-80 text-muted-foreground">
                {callback.comment ?? ''}
              </TableCell>
              {canFilter ? <TableCell>{callback.assignedToName}</TableCell> : null}
              <TableCell>
                <div className="flex justify-end gap-2">{actions(callback)}</div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <NoteListeTronquee affichees={list.data.items.length} total={list.data.total} />
      {list.data.pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={list.data.page <= 1}
            onClick={() => onPage(list.data.page - 1)}
          >
            Précédente
          </Button>
          <span>
            Page {list.data.page} sur {list.data.pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={list.data.page >= list.data.pageCount}
            onClick={() => onPage(list.data.page + 1)}
          >
            Suivante
          </Button>
        </div>
      ) : null}
    </>
  );
}

const nomDuRappel = (callback: Callback): string =>
  callback.prospectName === '' ? formatPhone(callback.phoneE164) : callback.prospectName;

function Retard({ callback, serverTimeMs }: { callback: Callback; serverTimeMs: number }) {
  if (!callback.overdue) return <Badge variant="secondary">À venir</Badge>;
  return (
    <Badge variant="destructive">
      {formatDelay(serverTimeMs - Date.parse(callback.scheduledAt))}
    </Badge>
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
        className="w-full sm:w-64"
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
  const { filters, setFilters } = useUrlFilters(FILTRES_RAPPELS);
  const { scope, projet, search, page } = filters;
  const assignedToId = canFilter ? filters.teleconseiller : null;

  const overdue = useQuery({
    queryKey: [...callbackKeys.list('overdue', assignedToId), projet, 1],
    queryFn: () => fetchCallbacks('overdue', assignedToId, undefined, projet ?? undefined, 1),
  });

  const list = useQuery({
    queryKey: [...callbackKeys.list(scope, assignedToId), projet, page],
    queryFn: () => fetchCallbacks(scope, assignedToId, undefined, projet ?? undefined, page),
  });

  const filteredItems = (list.data?.items ?? []).filter((cb) => filterCallbackBySearch(cb, search));

  const teleconseillers = useQuery({
    queryKey: queryKeys.commerciaux(TELECONSEILLERS_ACTIFS),
    queryFn: () => fetchUsers(TELECONSEILLERS_ACTIFS),
    enabled: canFilter,
    staleTime: 300_000,
  });

  const cancel = useAnnulationRappel();

  const overdueCount = overdue.data?.total ?? 0;

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
          setSearch={(value) => {
            setFilters({ search: value });
          }}
          projet={projet}
          setProjet={(value) => {
            setFilters({ projet: value });
          }}
          canFilter={canFilter}
          teleconseillers={teleconseillers.data?.items ?? []}
          assignedToId={assignedToId}
          setAssignedToId={(id) => {
            setFilters({ teleconseiller: id });
          }}
        />
      </div>

      <Tabs
        value={scope}
        onValueChange={(value) => {
          setFilters({ scope: value as CallbackScope });
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
                onPage={(value) => {
                  setFilters({ page: value });
                }}
                cancelPending={cancel.isPending}
                onCancel={(cb) => {
                  cancel.mutate(cb.id);
                }}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
