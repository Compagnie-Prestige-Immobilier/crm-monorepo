'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, BellOffIcon, LoaderIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { describeAudience } from './audience';
import {
  DEFAULT_NOTIFICATION_FILTERS,
  cancelNotification,
  fetchNotification,
  fetchNotifications,
  notificationKeys,
} from './api';
import { NotificationComposer } from './notification-composer';
import { TemplateManager } from './template-manager';
import {
  CATEGORY_LABELS,
  DELIVERY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
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

const dateTime = (value: string | null): string =>
  value === null ? '–' : new Date(value).toLocaleString('fr-SN');

export function NotificationsView() {
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: notificationKeys.list(DEFAULT_NOTIFICATION_FILTERS),
    queryFn: () => fetchNotifications(DEFAULT_NOTIFICATION_FILTERS),
    placeholderData: (previous) => previous,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelNotification(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.root });
      toast.success('Notification annulée.');
    },
    onError: (error) => {
      toastApiError(error, 'L’annulation a échoué.');
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="historique">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="historique">Historique</TabsTrigger>
            <TabsTrigger value="gabarits">Gabarits</TabsTrigger>
          </TabsList>
          <Button
            type="button"
            onClick={() => {
              setComposerOpen(true);
            }}
          >
            <PlusIcon aria-hidden="true" />
            Nouvelle notification
          </Button>
        </div>

        <TabsContent value="historique" className="mt-4">
          {list.isPending ? (
            <TableSkeleton />
          ) : list.isError ? (
            <QueryErrorState
              error={list.error}
              onRetry={() => {
                void list.refetch();
              }}
              fallback="L’historique des notifications n’a pas pu être chargé."
            />
          ) : list.data.items.length === 0 ? (
            <EmptyState
              icon={BellOffIcon}
              title="Aucune notification envoyée"
              description="Les envois apparaissent ici."
              action={
                <Button
                  type="button"
                  className="mt-1"
                  onClick={() => {
                    setComposerOpen(true);
                  }}
                >
                  <PlusIcon aria-hidden="true" />
                  Composer la première
                </Button>
              }
            />
          ) : (
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
                            setDetailId(row.id);
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
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {STATUS_LABELS[row.status]}
                        </Badge>
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
                            disabled={cancel.isPending}
                            onClick={() => {
                              cancel.mutate(row.id);
                            }}
                          >
                            {cancel.isPending ? (
                              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <XIcon aria-hidden="true" />
                            )}
                            Annuler
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="gabarits" className="mt-4">
          <TemplateManager />
        </TabsContent>
      </Tabs>

      <NotificationComposer open={composerOpen} onOpenChange={setComposerOpen} />
      <NotificationDetailDialog
        id={detailId}
        onClose={() => {
          setDetailId(null);
        }}
      />
    </div>
  );
}

/**
 * Résumé de livraison.
 *
 * Les échecs et les non-remis sont montrés MÊME À ZÉRO... non : seulement quand
 * ils existent, mais toujours de façon distincte du total. Un « 340 envoyées »
 * sans mention des 60 échecs laisse croire à un envoi complet.
 */
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

        {detail.isPending && id !== null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : detail.isError ? (
          <QueryErrorState
            error={detail.error}
            onRetry={() => {
              void detail.refetch();
            }}
            fallback="Le détail n’a pas pu être chargé."
          />
        ) : detail.data ? (
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
        ) : null}
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
