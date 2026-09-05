'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, CheckCheckIcon, CheckIcon, InboxIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useLive } from '@/components/live/use-live';
import { CATEGORY_LABELS } from '@/components/notifications/types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  bellLabel,
  fetchInbox,
  hasNewArrival,
  inboxSignature,
  markAllNotificationsRead,
  markNotificationRead,
  unreadBadgeLabel,
  webRouteFor,
  type InboxItem,
} from '@/lib/data/inbox';
import { formatDateTime } from '@/lib/format';
import { toastApiError } from '@/lib/mutation-feedback';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function NotificationBell({ href }: { href: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const live = useLive({ topic: 'notifications' });

  const [open, setOpen] = useState(false);
  const [swinging, setSwinging] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.inbox,
    queryFn: () => fetchInbox(),
    refetchInterval: live.refetchInterval,
    staleTime: 10_000,
  });

  const unreadCount = data?.unreadCount ?? 0;

  const previous = useRef<{ topId: string | null; unreadCount: number } | null>(null);
  useEffect(() => {
    const next = inboxSignature(data);
    const arrived = hasNewArrival(previous.current, next);
    previous.current = next;
    if (!arrived) return;

    setSwinging(true);
    const timer = setTimeout(() => {
      setSwinging(false);
    }, 700);
    return () => {
      clearTimeout(timer);
    };
  }, [data]);

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
          : `${String(count)} notification${count > 1 ? 's' : ''} marquée${count > 1 ? 's' : ''} comme lue${count > 1 ? 's' : ''}.`,
      );
    },
    onError: (error) => {
      toastApiError(error, 'Le marquage a échoué.');
    },
  });

  function activate(item: InboxItem): void {
    if (!item.isRead) markRead.mutate(item.notificationId);
    const target = webRouteFor(item.route);
    if (target === null) return;
    setOpen(false);
    router.push(target);
  }

  const items = data?.items ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={bellLabel(unreadCount)}
          />
        }
      >
        <BellIcon
          className={cn('size-5', swinging && 'motion-safe:animate-bell-swing')}
          aria-hidden="true"
        />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="motion-safe:animate-badge-pulse absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-[700] leading-4 text-destructive-foreground tabular-nums"
          >
            {unreadBadgeLabel(unreadCount)}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="font-display text-[0.9375rem] font-[700] tracking-[-0.02em]">
            Notifications
          </p>
          {unreadCount > 0 ? (
            <Badge variant="default" className="tabular-nums">
              {unreadBadgeLabel(unreadCount)} non lue{unreadCount > 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>

        {/* La liste défile DANS le menu : au-delà d'une dizaine de lignes, un
            menu qui pousse la page ferait disparaître son propre déclencheur.
            Au-delà de vingt, c'est le pied de panneau qui renvoie vers l'écran
            complet : voir `INBOX_PAGE_SIZE`. */}
        <div className="max-h-[26rem] overflow-y-auto scrollbar-thin">
          {(() => {
            if (isPending)
              return (
                <div className="flex flex-col gap-2 p-3" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-14 w-full" />
                  ))}
                </div>
              );
            return (() => {
              if (isError)
                return (
                  <p
                    role="status"
                    className="px-3 py-8 text-center text-[0.8125rem] text-destructive"
                  >
                    Les notifications n’ont pas pu être chargées.
                  </p>
                );
              return (() => {
                if (items.length === 0)
                  return (
                    <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                      <InboxIcon className="size-7 text-muted-foreground" aria-hidden="true" />
                      <p className="text-[0.875rem] font-[600]">Aucune annonce</p>
                      <p className="text-[0.75rem] text-muted-foreground">
                        Les rappels et les demandes à traiter apparaîtront ici.
                      </p>
                    </div>
                  );
                return (
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
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
                );
              })();
            })();
          })()}
        </div>

        {/*
          Le PIED DE PANNEAU, qui manquait.

          Le commentaire du composant promettait « un lien vers l'écran complet
          au-delà de vingt lignes » ; ce lien n'existait pas, et `/admin/notifications`
          était le composeur, réservé à l'ADMIN. La vingt-et-unième notification
          reçue était donc inatteignable, pour tous les rôles. Le panneau mène
          maintenant à une vraie boîte de réception, paginée, et permet de tout
          marquer d'un coup : sans quoi la pastille rouge finit par ne plus
          décrire qu'un arriéré qu'on ne peut pas solder.
        */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI
              poserait `role="button"` sur le `<a>`. */}
          <Link
            href={href}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            onClick={() => {
              setOpen(false);
            }}
          >
            Tout voir
          </Link>
          <Button
            type="button"
            variant="ghost"
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InboxRow({ item, onActivate }: { item: InboxItem; onActivate: () => void }) {
  const navigable = webRouteFor(item.route) !== null;

  return (
    <button
      type="button"
      onClick={onActivate}
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
        'hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        !item.isRead && 'bg-secondary/40',
      )}
    >
      {/* Point de non-lu à gauche : la seule marque qui tienne dans une liste
          dense sans recourir à la couleur du texte, qui sert déjà au contraste. */}
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          item.isRead ? 'bg-transparent' : 'bg-primary',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate', item.isRead ? '' : 'font-[700]')}>
            {item.title}
          </span>
          <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
            {CATEGORY_LABELS[item.category]}
          </span>
        </span>
        <span className="mt-0.5 block line-clamp-2 text-[0.8125rem] text-muted-foreground">
          {item.body}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
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
