import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CheckIcon, InboxIcon } from 'lucide-react';
import { useState } from 'react';

import { formatCountLabel, PaginationFooter } from '@/components/notifications/pagination-footer';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  CATEGORY_LABELS,
  fetchInboxPage,
  markNotificationRead,
  type NotificationRecue,
} from '@/lib/data/notifications';
import { lien } from '@/lib/nav';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function InboxView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

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

  const unreadCount = inbox.data?.unreadCount ?? 0;
  const meta = inbox.data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="group" aria-label="Filtrer la boîte de réception">
          <Button
            type="button"
            variant={unreadOnly ? 'outline' : 'default'}
            size="sm"
            aria-pressed={!unreadOnly}
            onClick={() => {
              setUnreadOnly(false);
              setPage(1);
            }}
          >
            Toutes
          </Button>
          <Button
            type="button"
            variant={unreadOnly ? 'default' : 'outline'}
            size="sm"
            aria-pressed={unreadOnly}
            onClick={() => {
              setUnreadOnly(true);
              setPage(1);
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

      {(() => {
        if (inbox.isPending) return <InboxSkeleton />;
        if (inbox.isError) {
          return (
            <QueryErrorState
              error={inbox.error}
              onRetry={() => {
                void inbox.refetch();
              }}
              fallback="Votre boîte de réception n’a pas pu être chargée."
            />
          );
        }
        if ((inbox.data.items ?? []).length === 0) {
          return (
            <Card className="items-center gap-3 px-6 py-16 text-center">
              <InboxIcon className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="font-[600]">
                {unreadOnly ? 'Aucune notification non lue' : 'Aucune notification'}
              </p>
              <p className="max-w-md text-[0.875rem] text-muted-foreground">
                {unreadOnly ? 'Tout est à jour.' : 'Les annonces et les rappels apparaîtront ici.'}
              </p>
            </Card>
          );
        }
        return (
          <>
            <Card className={cn('transition-opacity', inbox.isFetching && 'opacity-80')}>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {(inbox.data.items ?? []).map((item) => (
                    <li key={item.id}>
                      <InboxRow
                        item={item}
                        onActivate={() => {
                          if (!item.isRead) markRead.mutate(item.notificationId);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {meta === undefined ? null : (
              <PaginationFooter
                page={meta.page}
                pageCount={meta.pageCount}
                total={meta.total}
                label={(total) => formatCountLabel(total, 'notification')}
                onPage={setPage}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}

function InboxRow({ item, onActivate }: { item: NotificationRecue; onActivate: () => void }) {
  const classes = cn(
    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
    'hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
    !item.isRead && 'bg-secondary/40',
  );

  const contenu = (
    <>
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
        </span>
      </span>
    </>
  );

  if (item.route !== null) {
    return (
      <Link {...lien(item.route)} onClick={onActivate} className={classes}>
        {contenu}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onActivate} className={classes}>
      {contenu}
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
