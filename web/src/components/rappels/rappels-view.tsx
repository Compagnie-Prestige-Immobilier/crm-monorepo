'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClockIcon, PhoneCallIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { FilterCombobox } from '@/components/filters/filter-combobox';
import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import { LienTelephone } from '@/components/lien-telephone';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { readEnum, readString } from '@/lib/search-params';
import { EMPTY_USER_FILTERS } from '@/lib/user-filters';
import { cn } from '@/lib/utils';

const SCOPES: readonly { value: CallbackScope; label: string }[] = [
  { value: 'overdue', label: 'En retard' },
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'week', label: 'Cette semaine' },
];

interface FiltresRappels {
  portee: CallbackScope;
  teleconseiller: string | null;
}

const FILTRES_RAPPELS: UrlFilterAdapter<FiltresRappels> = {
  parse: (params) => ({
    portee:
      readEnum<CallbackScope>(
        params,
        'portee',
        SCOPES.map((tab) => tab.value),
      ) ?? 'overdue',
    teleconseiller: readString(params, 'teleconseiller'),
  }),
  serialize: ({ portee, teleconseiller }) => {
    const params = new URLSearchParams();
    if (portee !== 'overdue') params.set('portee', portee);
    if (teleconseiller !== null) params.set('teleconseiller', teleconseiller);
    return params;
  },
  cleared: () => ({ portee: 'overdue', teleconseiller: null }),
};

/** Sous `md`, la ligne garde le prospect, l'échéance et les actions. */
const SECONDAIRE = 'hidden md:table-cell';

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

/** L'heure du serveur à la lecture de la liste : l'échéance se dit comme dans le tableau. */
interface RappelAAnnuler {
  rappel: Callback;
  maintenant: number;
}

/** Grand Public consigne sur son écran d'appel, puis y revient ; CHUES passe par sa console. */
const consignerHref = (grandPublic: boolean, prospectId: string): string =>
  grandPublic
    ? `/grand-public/appel/${encodeURIComponent(prospectId)}?retour=rappels`
    : `/chues/console?fiche=${encodeURIComponent(prospectId)}`;

const ficheHref = (grandPublic: boolean, prospectId: string): string =>
  grandPublic
    ? `/grand-public/${encodeURIComponent(prospectId)}`
    : `/chues/prospects/${encodeURIComponent(prospectId)}`;

const nomDuRappel = (rappel: Callback): string =>
  rappel.prospectName === '' ? `Fiche ${rappel.shortCode}` : rappel.prospectName;

export function RappelsView({ canFilter }: { canFilter: boolean }) {
  const pathname = usePathname();
  const grandPublic = pathname.startsWith('/grand-public');
  const projet = grandPublic ? 'GRAND_PUBLIC' : 'CHUES';
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters(FILTRES_RAPPELS);
  const { portee: scope, teleconseiller: assignedToId } = filters;
  const [aAnnuler, setAAnnuler] = useState<RappelAAnnuler | null>(null);

  const overdue = useQuery({
    queryKey: [...callbackKeys.list('overdue', assignedToId), projet],
    queryFn: () => fetchCallbacks('overdue', assignedToId, undefined, projet),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: true,
  });

  const list = useQuery({
    queryKey: [...callbackKeys.list(scope, assignedToId), projet],
    queryFn: () => fetchCallbacks(scope, assignedToId, undefined, projet),
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: true,
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
      setAAnnuler(null);
      toast.success('Rappel annulé.');
      void queryClient.invalidateQueries({ queryKey: callbackKeys.root });
    },
    onError: (error) => {
      setAAnnuler(null);
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
              <Table className={cn(list.isPlaceholderData && 'opacity-80')}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className={SECONDAIRE}>Retard</TableHead>
                    <TableHead className={SECONDAIRE}>Commentaire</TableHead>
                    {canFilter ? (
                      <TableHead className={SECONDAIRE}>Téléconseiller</TableHead>
                    ) : null}
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.items.map((callback) => (
                    <TableRow key={callback.id}>
                      <TableCell>
                        <Link
                          href={ficheHref(grandPublic, callback.prospectId)}
                          className="font-[600] underline underline-offset-4"
                        >
                          {nomDuRappel(callback)}
                        </Link>
                        <span className="block text-[0.8125rem] text-muted-foreground">
                          <LienTelephone phoneE164={callback.phoneE164} />
                        </span>
                      </TableCell>
                      <TableCell>
                        <time dateTime={callback.scheduledAt}>
                          {formatCallbackAt(callback.scheduledAt, Date.parse(list.data.serverTime))}
                        </time>
                      </TableCell>
                      <TableCell className={SECONDAIRE}>
                        {callback.overdue ? (
                          <Badge variant="destructive">
                            {formatDelay(
                              Date.parse(list.data.serverTime) - Date.parse(callback.scheduledAt),
                            )}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Sans objet</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(SECONDAIRE, 'max-w-80 text-muted-foreground')}>
                        {callback.comment ?? ''}
                      </TableCell>
                      {canFilter ? (
                        <TableCell className={SECONDAIRE}>{callback.assignedToName}</TableCell>
                      ) : null}
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={consignerHref(grandPublic, callback.prospectId)}
                            className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          >
                            <PhoneCallIcon aria-hidden="true" />
                            Consigner l’appel
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAAnnuler({
                                rappel: callback,
                                maintenant: Date.parse(list.data.serverTime),
                              });
                            }}
                          >
                            Annuler le rappel
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
            className="w-full sm:w-72"
            options={(teleconseillers.data?.items ?? []).map((user) => ({
              value: user.id,
              label: user.fullName,
            }))}
            value={assignedToId}
            onChange={(teleconseiller) => {
              setFilters({ teleconseiller });
            }}
          />
        ) : null}
      </div>

      <Tabs
        value={scope}
        onValueChange={(value) => {
          setFilters({ portee: value as CallbackScope });
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

      <ConfirmerAnnulation
        cible={aAnnuler}
        pending={cancel.isPending}
        onFermer={() => {
          setAAnnuler(null);
        }}
        onConfirmer={(rappel) => {
          cancel.mutate(rappel);
        }}
      />
    </div>
  );
}

function ConfirmerAnnulation({
  cible,
  pending,
  onFermer,
  onConfirmer,
}: {
  cible: RappelAAnnuler | null;
  pending: boolean;
  onFermer: () => void;
  onConfirmer: (rappel: Callback) => void;
}) {
  if (cible === null) return null;
  const { rappel, maintenant } = cible;
  return (
    <ConfirmDialog
      open
      onOpenChange={(ouvert) => {
        if (!ouvert) onFermer();
      }}
      title={`Annuler le rappel de la fiche ${rappel.shortCode} ?`}
      description={`Promis pour ${formatCallbackAt(rappel.scheduledAt, maintenant)}, au ${formatPhone(rappel.phoneE164)}.`}
      confirmLabel="Annuler le rappel"
      cancelLabel="Garder le rappel"
      pending={pending}
      onConfirm={() => {
        onConfirmer(rappel);
      }}
    />
  );
}
