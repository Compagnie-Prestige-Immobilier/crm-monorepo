import { createFileRoute, redirect } from '@tanstack/react-router';

import { INBOX_ROLES } from '@/components/layout/nav-items';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/notifications')({
  beforeLoad: ({ context }) => {
    guardRoles(INBOX_ROLES)({ context });
    if (context.user.role === 'ADMIN') {
      throw redirect({ href: '/admin/notifications?onglet=reception' });
    }
  },
  component: BoiteDeReceptionPage,
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

/** La page `(panel)/notifications` de la v1 : la boîte de réception hors coque. */
function BoiteDeReceptionPage() {
  return <NotificationsView isAdmin={false} />;
}
