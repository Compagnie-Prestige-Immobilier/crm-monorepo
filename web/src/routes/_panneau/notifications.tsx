import { createFileRoute, redirect } from '@tanstack/react-router';

import { NotificationsView } from '@/components/notifications/notifications-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/notifications')({
  beforeLoad: ({ context }) => {
    guardPermission('panneau.acceder')({ context });
    if (peut(context.user, 'notifications.administrer')) {
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
