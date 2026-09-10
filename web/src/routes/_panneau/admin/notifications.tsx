import { createFileRoute, redirect } from '@tanstack/react-router';

import { hasInbox, INBOX_PATH } from '@/components/layout/nav-items';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/notifications')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'ADMIN' && hasInbox(context.user.role)) {
      throw redirect({ href: INBOX_PATH });
    }
    guardRoles(['ADMIN'])({ context });
  },
  component: NotificationsPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

/** La page `(panel)/admin/notifications` de la v1 : le composeur, et rien d'autre. */
function NotificationsPage() {
  return <NotificationsView isAdmin />;
}
