'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClockIcon, PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { QueryErrorState } from '@/components/query-error-state';
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
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';

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
};

export function RappelsView({ canFilter }: { canFilter: boolean }) {
  const pathname = usePathname();
  const grandPublic = pathname.startsWith('/grand-public');
  const projet = grandPublic ? 'GRAND_PUBLIC' : 'CHUES';
  const racine = grandPublic ? '/grand-public' : '/chues';
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<CallbackScope>('overdue');
  const [assignedToId, setAssignedToId] = useState<string | null>(null);

  const overdue = useQuery({
    queryKey: [...callbackKeys.list('overdue', assignedToId), projet],
    queryFn: () => fetchCallbacks('overdue', assignedToId, undefined, projet),
  });

  const list = useQuery({
    queryKey: [...callbackKeys.list(scope, assignedToId), projet],
    queryFn: () => fetchCallbacks(scope, assignedToId, undefined, projet),
  });

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
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
                  {list.data.items.map((callback) => (
                    <TableRow key={callback.id}>
                      <TableCell>
                        <span className="font-[600]">{formatPhone(callback.phoneE164)}</span>
                        <span className="block text-[0.75rem] text-muted-foreground">
                          Fiche {callback.shortCode}
                        </span>
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
            );
          })();
        })();
      })()}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[0.9375rem]" role="status">
          {overdue.isSuccess ? (
            <>
              <span className="font-display text-[2rem] font-[700] tracking-[-0.02em] tabular-nums">
                {formatNumber(overdueCount)}
              </span>{' '}
              rappel{overdueCount > 1 ? 's' : ''} en retard
            </>
          ) : (
            <span className="text-muted-foreground">Retards en cours de lecture.</span>
          )}
        </p>

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
