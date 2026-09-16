'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  callbackKeys,
  cancelCallback,
  fetchCallbacks,
  formatCallbackAt,
  formatDelay,
  type Callback,
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
  { value: 'all', label: 'Tous' },
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
    description: 'Une échéance se promet en consignant un appel.',
  },
};

export function RappelsView({ canFilter }: { canFilter: boolean }) {
  const racine = '/teleconseil';
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<CallbackScope>('overdue');
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [projet, setProjet] = useState<Projet | null>(null);
  const [search, setSearch] = useState('');

  const overdue = useQuery({
    queryKey: [...callbackKeys.list('overdue', assignedToId), projet],
    queryFn: () => fetchCallbacks('overdue', assignedToId, undefined, projet ?? undefined),
  });

  const list = useQuery({
    queryKey: [...callbackKeys.list(scope, assignedToId), projet],
    queryFn: () => fetchCallbacks(scope, assignedToId, undefined, projet ?? undefined),
  });

  const filteredItems = (list.data?.items ?? []).filter((cb) => {
    if (search.trim() === '') return true;
    const q = search.trim().toLowerCase();
    const nameMatch = cb.prospectName.toLowerCase().includes(q);
    const phoneMatch = (cb.phoneE164 ?? '').toLowerCase().includes(q);
    const commentMatch = (cb.comment ?? '').toLowerCase().includes(q);
    return nameMatch || phoneMatch || commentMatch;
  });

  // Les CCP promettent aussi des rappels, sur les fiches plateforme.
  const teleconseillers = useQuery({
    queryKey: callbackKeys.teleconseillers,
    queryFn: async () => {
      const pages = await Promise.all(
        (['COMMERCIAL', 'CCP'] as const).map((role) =>
          fetchUsers({ ...EMPTY_USER_FILTERS, role, isActive: true, pageSize: 200 }),
        ),
      );
      return { items: pages.flatMap((page) => page.items) };
    },
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

  const body = (
    <>
      {(() => {
        if (list.isPending) return <Skeleton className="h-64" />;
        return (() => {
          if (list.isError)
            return (
              <QueryErrorState
                error={list.error}
                fallback="Les rappels n’ont pas pu être lus."
                onRetry={() => {
                  void list.refetch();
                }}
              />
            );
          return (() => {
            if (list.data.items.length === 0)
              return (
                <EmptyState
                  icon={ClockIcon}
                  title={EMPTY_TEXT[scope].title}
                  description={EMPTY_TEXT[scope].description}
                />
              );
            return (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Projet</TableHead>
                      <TableHead>Qualification</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Retard</TableHead>
                      <TableHead>Commentaire</TableHead>
                      {canFilter ? <TableHead>Téléconseiller</TableHead> : null}
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((callback) => (
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
                          {callback.reasonLabel === null ? null : (
                            <Badge variant="secondary">{callback.reasonLabel}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <time dateTime={callback.scheduledAt}>
                            {formatCallbackAt(
                              callback.scheduledAt,
                              Date.parse(list.data.serverTime),
                            )}
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
                              disabled={cancel.isPending}
                              onClick={() => {
                                cancel.mutate(callback);
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
              </>
            );
          })();
        })();
      })()}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        {canFilter
          ? 'Ces rappels sont ceux que les téléconseillers ont promis : chacun rappelle les siens, vous suivez les retards. Filtrez par téléconseiller ou par projet.'
          : 'Tous vos rappels promis sont ici. Utilisez « Projet » pour distinguer CHUES et Grand Public.'}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.9375rem]" role="status">
          {overdue.isSuccess ? (
            <>
              <span className="font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
                {formatNumber(overdueCount)}
              </span>{' '}
              rappel{overdueCount > 1 ? 's' : ''} en retard
              {canFilter ? ' chez les téléconseillers' : ''}
            </>
          ) : (
            <span className="text-muted-foreground">Retards en cours de lecture.</span>
          )}
        </p>

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
            onChange={(value) => setProjet((value as Projet) || null)}
          />
          {canFilter ? (
            <FilterCombobox
              label="Téléconseiller"
              placeholder="Tous les téléconseillers"
              className="w-72"
              options={(teleconseillers.data?.items ?? []).map((user) => ({
                value: user.id,
                label: user.fullName,
              }))}
              value={assignedToId}
              onChange={setAssignedToId}
            />
          ) : null}
        </div>
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
            {scope === tab.value ? body : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
