import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOffIcon, LoaderIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { NotificationDetailDialog } from '@/components/notifications/notification-detail-dialog';
import { formatCountLabel, PaginationFooter } from '@/components/notifications/pagination-footer';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  cancelNotification,
  describeAudience,
  fetchNotifications,
  notificationKeys,
  type NotificationCategory,
  type NotificationRow,
  type NotificationStatus,
} from '@/lib/data/notifications';

const PAGE_SIZE = 20;
const ALL = 'tous';

const STATUS_ITEMS = [
  { value: ALL, label: 'Tous les états' },
  ...(['SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'] as NotificationStatus[]).map((value) => ({
    value,
    label: STATUS_LABELS[value],
  })),
];

const CATEGORY_ITEMS = [
  { value: ALL, label: 'Toutes les catégories' },
  ...(['ANNONCE', 'RAPPEL', 'DOSSIER', 'SYSTEME'] as NotificationCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  })),
];

const STATUS_VARIANT: Record<NotificationStatus, 'info' | 'warning' | 'success' | 'outline'> = {
  SCHEDULED: 'info',
  SENDING: 'warning',
  SENT: 'success',
  CANCELLED: 'outline',
};

export function NotificationHistory() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [category, setCategory] = useState<NotificationCategory | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<NotificationRow | null>(null);

  const filters = {
    page,
    pageSize: PAGE_SIZE,
    ...(status === null ? {} : { status }),
    ...(category === null ? {} : { category }),
  };

  const list = useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => fetchNotifications(filters),
    placeholderData: (previous) => previous,
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

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-elev-sm">
        <Select
          items={STATUS_ITEMS}
          value={status ?? ALL}
          onValueChange={(value) => {
            if (value !== null) {
              setStatus(value === ALL ? null : (value as NotificationStatus));
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-48">
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

        <Select
          items={CATEGORY_ITEMS}
          value={category ?? ALL}
          onValueChange={(value) => {
            if (value !== null) {
              setCategory(value === ALL ? null : (value as NotificationCategory));
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-48">
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
      </section>

      {(() => {
        if (list.isPending) return <HistorySkeleton />;
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
        if ((list.data.items ?? []).length === 0) {
          return (
            <Card className="items-center gap-3 px-6 py-16 text-center">
              <BellOffIcon className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="font-[600]">Aucun envoi ne correspond à ces critères</p>
            </Card>
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
                    <TableHead>Date</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(list.data.items ?? []).map((row) => (
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
                      </TableCell>
                      <TableCell className="text-[0.8125rem] text-muted-foreground">
                        {formatDateTime(row.sentAt ?? row.scheduledFor ?? row.createdAt)}
                      </TableCell>
                      <TableCell>
                        {row.status === 'SCHEDULED' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={cancel.isPending && cancel.variables === row.id}
                            onClick={() => {
                              setCancelling(row);
                            }}
                          >
                            {cancel.isPending && cancel.variables === row.id ? (
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

            <PaginationFooter
              page={list.data.meta.page}
              pageCount={list.data.meta.pageCount}
              total={list.data.meta.total}
              label={(total) => formatCountLabel(total, 'envoi')}
              onPage={setPage}
            />
          </>
        );
      })()}

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title={`Annuler l’envoi « ${cancelling?.title ?? ''} » ?`}
        description="Il ne partira pas, et cela ne se défait pas : il faudra le recomposer."
        confirmLabel="Annuler l’envoi"
        pending={cancel.isPending}
        onConfirm={() => {
          if (cancelling !== null) cancel.mutate(cancelling.id);
        }}
      />

      <NotificationDetailDialog
        id={detailId}
        onClose={() => {
          setDetailId(null);
        }}
      />
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
