import { createFileRoute } from '@tanstack/react-router';

import { MesContactsView } from '@/components/contacts/mes-contacts-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/mes-contacts')({
  beforeLoad: guardPermission('prospects.lire'),
  component: MesContactsPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function MesContactsPage() {
  const { user } = Route.useRouteContext();
  return <MesContactsView userId={user.id} canFilter={peut(user, 'comptes.lister')} />;
}
