'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCheckIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { EmptyState } from '@/components/empty-state';
import { CATEGORY_LABELS } from '@/components/notifications/types';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchInboxPage,
  markAllNotificationsRead,
  markNotificationRead,
  webRouteFor,
  type InboxItem,
} from '@/lib/data/inbox';
import { formatDateTime, formatNumber } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function InboxView({
  page,
  unreadOnly,
  onPageChange,
  onUnreadOnlyChange,
}: {
  page: number;
  unreadOnly: boolean;
  onPageChange: (page: number) => void;
  onUnreadOnlyChange: (unreadOnly: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const inbox = useQuery({
    queryKey: queryKeys.inboxPage(page, unreadOnly),
    queryFn: () => fetchInboxPage({ page, unreadOnly }),
    placeholderData: (previous) => previous,
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxRoot });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxRoot });
      toast.success(
        count === 0
          ? 'Rien à marquer : tout était déjà lu.'
          : `${formatNumber(count)} notification${count > 1 ? 's' : ''} marquée${count > 1 ? 's' : ''} comme lue${count > 1 ? 's' : ''}.`,
      );
    },
    onError: (error) => {
      toastApiError(error, 'Le marquage a échoué.');
    },
  });

  function activate(item: InboxItem): void {
    if (!item.isRead) markRead.mutate(item.notificationId);
    const target = webRouteFor(item.route);
    if (target !== null) router.push(target);
  }

  const unreadCount = inbox.data?.unreadCount ?? 0;
  const meta = inbox.data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* `role="group"` et non `tablist` : ces boutons écrivent un filtre
              dans l'URL, et `aria-pressed` décrit exactement cet état. */}
          <div className="flex gap-2" role="group" aria-label="Filtrer la boîte de réception">
            <Button
              type="button"
              variant={unreadOnly ? 'outline' : 'default'}
              size="sm"
              aria-pressed={!unreadOnly}
              className="tap-target"
              onClick={() => {
                onUnreadOnlyChange(false);
              }}
            >
              Toutes
            </Button>
            <Button
              type="button"
              variant={unreadOnly ? 'default' : 'outline'}
              size="sm"
              aria-pressed={unreadOnly}
              className="tap-target"
              onClick={() => {
                onUnreadOnlyChange(true);
              }}
            >
              Non lues
            </Button>
          </div>
          {unreadCount > 0 ? (
            <Badge variant="default" className="tabular-nums">
              {formatNumber(unreadCount)} non lue{unreadCount > 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAll.isPending}
          onClick={() => {
            markAll.mutate();
          }}
        >
          <CheckCheckIcon aria-hidden="true" />
          Tout marquer comme lu
        </Button>
      </div>

      {(() => {
        if (inbox.isPending) return <InboxSkeleton />;
        return (() => {
          if (inbox.isError)
            return (
              <QueryErrorState
                error={inbox.error}
                onRetry={() => {
                  void inbox.refetch();
                }}
                fallback="Votre boîte de réception n’a pas pu être chargée."
              />
            );
          return (() => {
            if (inbox.data.items.length === 0)
              return (
                <EmptyState
                  icon={InboxIcon}
                  title={unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}
                  description={
                    unreadOnly
                      ? 'Tout est à jour.'
                      : 'Les annonces, les rappels et les demandes à traiter apparaîtront ici.'
                  }
                />
              );
            return (
              <>
                <Card className={cn('transition-opacity', inbox.isFetching && 'opacity-80')}>
                  <CardContent className="p-0">
                    <ul className="divide-y divide-border">
                      {inbox.data.items.map((item) => (
                        <li key={item.id}>
                          <InboxRow
                            item={item}
                            onActivate={() => {
                              activate(item);
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {meta === undefined ? null : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[0.8125rem] text-muted-foreground" role="status">
                      <span className="sr-only">Notifications affichées&nbsp;: </span>
                      {formatNumber(meta.total)} notification{meta.total > 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Page précédente"
                        disabled={meta.page <= 1}
                        onClick={() => {
                          onPageChange(meta.page - 1);
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
                          onPageChange(meta.page + 1);
                        }}
                      >
                        <ChevronRightIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })();
        })();
      })()}
    </div>
  );
}

function InboxRow({ item, onActivate }: { item: InboxItem; onActivate: () => void }) {
  const navigable = webRouteFor(item.route) !== null;

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
        'hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        !item.isRead && 'bg-secondary/40',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          item.isRead ? 'bg-transparent' : 'bg-primary',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate', item.isRead ? '' : 'font-[700]')}>
            {item.title}
          </span>
          <Badge variant="secondary">{CATEGORY_LABELS[item.category]}</Badge>
        </span>
        <span className="mt-0.5 block text-[0.875rem] text-muted-foreground">{item.body}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[0.75rem] text-muted-foreground">
          <time dateTime={item.createdAt} className="tabular-nums">
            {formatDateTime(item.createdAt)}
          </time>
          {item.isRead ? (
            <span className="inline-flex items-center gap-1">
              <CheckIcon className="size-3" aria-hidden="true" />
              Lue
            </span>
          ) : null}
          {!navigable ? <span className="sr-only">Aucun écran associé</span> : null}
        </span>
      </span>
    </button>
  );
}

function InboxSkeleton() {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}
