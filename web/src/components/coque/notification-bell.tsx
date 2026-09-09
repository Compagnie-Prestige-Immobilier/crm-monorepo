import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BellIcon, InboxIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchInboxPage, markNotificationRead } from '@/lib/data/notifications';
import { lien } from '@/lib/nav';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const PREVIEW_PAGE_SIZE = 6;
const BADGE_MAX = 99;

export function NotificationBell({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const inbox = useQuery({
    queryKey: queryKeys.inboxPage(1, false),
    queryFn: () => fetchInboxPage({ page: 1, unreadOnly: false }, PREVIEW_PAGE_SIZE),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxRoot });
    },
  });

  const unreadCount = inbox.data?.unreadCount ?? 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${String(unreadCount)} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Notifications'
            }
          />
        }
      >
        <BellIcon className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[0.625rem]"
          >
            {unreadCount > BADGE_MAX ? `${String(BADGE_MAX)}+` : unreadCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="font-display text-[0.9375rem] font-[700] tracking-[-0.02em]">
            Notifications
          </p>
        </div>

        {(() => {
          if (inbox.isPending) {
            return (
              <div className="flex flex-col gap-2 p-3" aria-hidden="true">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            );
          }
          if (inbox.isError || (inbox.data.items ?? []).length === 0) {
            return (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                <InboxIcon className="size-7 text-muted-foreground" aria-hidden="true" />
                <p className="text-[0.875rem] font-[600]">Aucune annonce</p>
                <p className="text-[0.75rem] text-muted-foreground">
                  Les rappels et les demandes à traiter apparaîtront ici.
                </p>
              </div>
            );
          }
          return (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {(inbox.data.items ?? []).map((item) => {
                const classes = cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary',
                  !item.isRead && 'bg-secondary/40',
                );
                const contenu = (
                  <>
                    <span
                      className={cn('truncate text-[0.8125rem]', item.isRead ? '' : 'font-[700]')}
                    >
                      {item.title}
                    </span>
                    <span className="truncate text-[0.75rem] text-muted-foreground">
                      {item.body}
                    </span>
                  </>
                );
                const activer = (): void => {
                  if (!item.isRead) markRead.mutate(item.notificationId);
                  setOpen(false);
                };

                return (
                  <li key={item.id}>
                    {item.route === null ? (
                      <button type="button" onClick={activer} className={classes}>
                        {contenu}
                      </button>
                    ) : (
                      <Link {...lien(item.route)} onClick={activer} className={classes}>
                        {contenu}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        })()}

        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          {/* Un lien habillé en bouton : `Button` poserait `role="button"` sur le `<a>`. */}
          <Link
            {...lien(href)}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            onClick={() => {
              setOpen(false);
            }}
          >
            Tout voir
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
