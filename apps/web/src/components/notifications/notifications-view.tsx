'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  BellIcon,
  BellOffIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { InboxView } from '@/components/notifications/inbox-view';
import { useNotificationFilters } from '@/components/notifications/use-notification-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toastApiError } from '@/lib/mutation-feedback';
import {
  countActiveNotificationFilters,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_STATUSES,
  type NotificationTab,
} from '@/lib/notification-filters';
import { cn } from '@/lib/utils';
import { describeAudience } from './audience';
import {
  cancelNotification,
  fetchNotification,
  fetchNotifications,
  notificationKeys,
} from '@/lib/data/notifications';
import { NotificationComposer } from './notification-composer';
import { TemplateManager } from './template-manager';
import {
  CATEGORY_LABELS,
  DELIVERY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  type NotificationCategory,
  type NotificationDeliveryStatus,
  type NotificationRow,
  type NotificationStatus,
} from './types';

const STATUS_VARIANT: Record<
  NotificationStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline'
> = {
  SCHEDULED: 'info',
  SENDING: 'warning',
  SENT: 'success',
  CANCELLED: 'outline',
};

const DELIVERY_VARIANT: Record<
  NotificationDeliveryStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline'
> = {
  PENDING: 'secondary',
  SENT: 'info',
  DELIVERED: 'success',
  FAILED: 'destructive',
  READ: 'success',
};

const ALL = 'tous';

const STATUS_ITEMS = [
  { value: ALL, label: 'Tous les états' },
  ...NOTIFICATION_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

const CATEGORY_ITEMS = [
  { value: ALL, label: 'Toutes les catégories' },
  ...NOTIFICATION_CATEGORIES.map((category) => ({
    value: category,
    label: CATEGORY_LABELS[category],
  })),
];

const dateTime = (value: string | null): string =>
  value === null ? '–' : new Date(value).toLocaleString('fr-SN');

export function NotificationsView({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { filters, setFilters } = useNotificationFilters(isAdmin);
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<NotificationRow | null>(null);

  const listQuery = {
    page: filters.page,
    pageSize: NOTIFICATION_PAGE_SIZE,
    ...(filters.status === null ? {} : { status: filters.status }),
    ...(filters.category === null ? {} : { category: filters.category }),
  };

  const list = useQuery({
    queryKey: notificationKeys.list(listQuery),
    queryFn: () => fetchNotifications(listQuery),
    placeholderData: (previous) => previous,
    enabled: isAdmin && filters.tab === 'historique',
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });
      setCancelling(null);
      toast.success('Envoi annulé.');
    },
    onError: (error) => {
      toastApiError(error, 'L’annulation a échoué.');
    },
  });

  const activeFilterCount = countActiveNotificationFilters(filters);
  const meta = list.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={filters.tab}
        onValueChange={(value) => {
          setFilters({ tab: value as NotificationTab });
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="reception">Boîte de réception</TabsTrigger>
            {isAdmin ? <TabsTrigger value="historique">Historique</TabsTrigger> : null}
            {isAdmin ? <TabsTrigger value="gabarits">Gabarits</TabsTrigger> : null}
          </TabsList>
          {isAdmin ? (
            <Button
              type="button"
              onClick={() => {
                setComposerOpen(true);
              }}
            >
              <PlusIcon aria-hidden="true" />
              Nouvelle notification
            </Button>
          ) : null}
        </div>

        <TabsContent value="reception" className="mt-4">
          <InboxView
            page={filters.inboxPage}
            unreadOnly={filters.unreadOnly}
            onPageChange={(page) => {
              setFilters({ inboxPage: page });
            }}
            onUnreadOnlyChange={(unreadOnly) => {
              setFilters({ unreadOnly });
            }}
          />
        </TabsContent>

        {isAdmin ? (
          <TabsContent value="historique" className="mt-4 flex flex-col gap-4">
            {/* Les critères que l'API expose depuis le début, et que l'écran
                n'offrait pas : sans eux, retrouver « l'annonce de mardi » se
                faisait à l'œil sur une seule page de vingt. */}
            <section
              aria-label="Filtres des envois"
              className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
            >
              <div className="flex w-48 flex-col gap-1.5">
                <Label htmlFor="statut-envoi">État</Label>
                <Select
                  items={STATUS_ITEMS}
                  value={filters.status ?? ALL}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setFilters({ status: value === ALL ? null : (value as NotificationStatus) });
                  }}
                >
                  <SelectTrigger id="statut-envoi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-48 flex-col gap-1.5">
                <Label htmlFor="categorie-envoi">Catégorie</Label>
                <Select
                  items={CATEGORY_ITEMS}
                  value={filters.category ?? ALL}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setFilters({
                      category: value === ALL ? null : (value as NotificationCategory),
                    });
                  }}
                >
                  <SelectTrigger id="categorie-envoi">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeFilterCount > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilters({ status: null, category: null });
                  }}
                >
                  <RotateCcwIcon aria-hidden="true" />
                  Tout effacer
                </Button>
              ) : null}
            </section>

            <HistoriqueEnvois
              list={list}
              activeFilterCount={activeFilterCount}
              meta={meta}
              cancel={cancel}
              onDetail={setDetailId}
              onCancelRow={setCancelling}
              onComposer={() => {
                setComposerOpen(true);
              }}
              onPage={(page) => {
                setFilters({ page });
              }}
            />
          </TabsContent>
        ) : null}

        {isAdmin ? (
          <TabsContent value="gabarits" className="mt-4">
            <TemplateManager />
          </TabsContent>
        ) : null}
      </Tabs>

      {isAdmin ? (
        <>
          <NotificationComposer open={composerOpen} onOpenChange={setComposerOpen} />
          <CancelSendDialog
            row={cancelling}
            pending={cancel.isPending}
            onOpenChange={(open) => {
              if (!open) setCancelling(null);
            }}
            onConfirm={() => {
              if (cancelling !== null) cancel.mutate(cancelling.id);
            }}
          />
        </>
      ) : null}

      <NotificationDetailDialog
        id={detailId}
        onClose={() => {
          setDetailId(null);
        }}
      />
    </div>
  );
}

interface HistoriqueEnvoisProps {
  list: UseQueryResult<Awaited<ReturnType<typeof fetchNotifications>>>;
  activeFilterCount: number;
  meta: Awaited<ReturnType<typeof fetchNotifications>>['meta'] | undefined;
  cancel: { isPending: boolean; variables: string | undefined };
  onDetail: (id: string) => void;
  onCancelRow: (row: NotificationRow) => void;
  onComposer: () => void;
  onPage: (page: number) => void;
}

function HistoriqueEnvois({
  list,
  activeFilterCount,
  meta,
  cancel,
  onDetail,
  onCancelRow,
  onComposer,
  onPage,
}: HistoriqueEnvoisProps) {
  if (list.isPending) return <TableSkeleton />;

  if (list.isError) {
    return (
      <QueryErrorState
        error={list.error}
        onRetry={() => {
          void list.refetch();
        }}
        fallback="L’historique des notifications n’a pas pu être chargé."
      />
    );
  }

  if (list.data.items.length === 0) {
    return (
      <EmptyState
        icon={BellOffIcon}
        title={
          activeFilterCount === 0
            ? 'Aucune notification envoyée'
            : 'Aucun envoi ne correspond à ces critères'
        }
        description={
          activeFilterCount === 0
            ? 'Un envoi part en push vers les destinataires choisis, et reste dans leur boîte de réception.'
            : 'Changez d’état ou de catégorie.'
        }
        action={
          activeFilterCount === 0 ? (
            <Button type="button" className="mt-1" onClick={onComposer}>
              <PlusIcon aria-hidden="true" />
              Composer la première
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card shadow-elev-sm transition-opacity',
          list.isFetching && 'opacity-80',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Notification</TableHead>
              <TableHead>Destinataires</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Livraison</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-xs">
                  <button
                    type="button"
                    className="min-h-11 text-left"
                    onClick={() => {
                      onDetail(row.id);
                    }}
                  >
                    <span className="block font-[600]">{row.title}</span>
                    <span className="block truncate text-[0.8125rem] text-muted-foreground">
                      {row.body}
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <span className="block">{describeAudience(row)}</span>
                  <span className="block text-[0.75rem] text-muted-foreground">
                    {CATEGORY_LABELS[row.category]}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  {row.transportStatus === 'NOT_CONFIGURED' ? (
                    <Badge variant="warning" className="mt-1 block w-fit">
                      Aucun push remis
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <DeliverySummary row={row} />
                </TableCell>
                <TableCell className="text-[0.8125rem] text-muted-foreground">
                  {dateTime(row.sentAt ?? row.scheduledFor ?? row.createdAt)}
                </TableCell>
                <TableCell>
                  {row.status === 'SCHEDULED' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={cancel.isPending && cancel.variables === row.id}
                      onClick={() => {
                        onCancelRow(row);
                      }}
                    >
                      {cancel.isPending && cancel.variables === row.id ? (
                        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <XIcon aria-hidden="true" />
                      )}
                      Annuler l’envoi
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta === undefined ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.8125rem] text-muted-foreground" role="status">
            <span className="sr-only">Envois affichés&nbsp;: </span>
            {meta.total} envoi{meta.total > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Page précédente"
              disabled={meta.page <= 1}
              onClick={() => {
                onPage(meta.page - 1);
              }}
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </Button>
            <span className="min-w-20 text-center text-[0.8125rem] tabular-nums">
              {meta.page} / {Math.max(1, meta.pageCount)}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Page suivante"
              disabled={meta.page >= meta.pageCount}
              onClick={() => {
                onPage(meta.page + 1);
              }}
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function CancelSendDialog({
  row,
  pending,
  onOpenChange,
  onConfirm,
}: {
  row: NotificationRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open && pending) return;
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {row === null ? null : (
          <>
            <DialogHeader>
              <DialogTitle>Annuler l’envoi «&nbsp;{row.title}&nbsp;» ?</DialogTitle>
              <DialogDescription>
                Programmé pour le {dateTime(row.scheduledFor)}. Il ne partira pas, et cela ne se
                défait pas&nbsp;: il faudra le recomposer.
              </DialogDescription>
            </DialogHeader>

            <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-[0.875rem]">
              Destinataires prévus&nbsp;: <strong>{describeAudience(row)}</strong>.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Revenir
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
                {pending ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
                Annuler l’envoi
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeliverySummary({ row }: { row: NotificationRow }) {
  const { counts } = row;
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary">{String(counts.total)} au total</Badge>
      {counts.sent > 0 ? <Badge variant="info">{String(counts.sent)} remises</Badge> : null}
      {counts.read > 0 ? <Badge variant="success">{String(counts.read)} lues</Badge> : null}
      {counts.failed > 0 ? (
        <Badge variant="destructive">{String(counts.failed)} échecs</Badge>
      ) : null}
      {counts.pending > 0 ? (
        <Badge variant="warning">{String(counts.pending)} en attente</Badge>
      ) : null}
    </div>
  );
}

function NotificationDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: notificationKeys.detail(id ?? ''),
    queryFn: () => fetchNotification(id ?? ''),
    enabled: id !== null,
  });

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail.data?.notification.title ?? 'Détail de l’envoi'}</DialogTitle>
          <DialogDescription>Une ligne par destinataire.</DialogDescription>
        </DialogHeader>

        {(() => {
          if (detail.isPending && id !== null)
            return (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            );
          return (() => {
            if (detail.isError)
              return (
                <QueryErrorState
                  error={detail.error}
                  onRetry={() => {
                    void detail.refetch();
                  }}
                  fallback="Le détail n’a pas pu être chargé."
                />
              );
            return (() => {
              if (detail.data)
                return (
                  <>
                    <p className="text-[0.9375rem] text-muted-foreground">
                      {detail.data.notification.body}
                    </p>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Destinataire</TableHead>
                            <TableHead>État</TableHead>
                            <TableHead>Lue le</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.data.recipients.map((recipient) => (
                            <TableRow key={recipient.userId}>
                              <TableCell>
                                <span className="block font-[600]">{recipient.fullName}</span>
                                <span className="block text-[0.75rem] text-muted-foreground">
                                  {ROLE_LABELS[recipient.role]}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={DELIVERY_VARIANT[recipient.status]}>
                                  {DELIVERY_LABELS[recipient.status]}
                                </Badge>
                                {recipient.error !== null ? (
                                  <span className="mt-1 block font-mono text-[0.6875rem] text-muted-foreground">
                                    {recipient.error}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-[0.8125rem] text-muted-foreground">
                                {dateTime(recipient.readAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              return null;
            })();
          })();
        })()}
      </DialogContent>
    </Dialog>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export { BellIcon };
