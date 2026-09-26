import { createFileRoute } from '@tanstack/react-router';

import { MesContactsView } from '@/components/contacts/mes-contacts-view';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/mes-contacts')({
  beforeLoad: guardPermission('fiches.tenir'),
  component: MesContactsGrandPublicPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-12 w-52" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <GrandPublicTableSkeleton />
    </div>
  );
}

/** La page `(panel)/grand-public/mes-contacts` de la v1. */
function MesContactsGrandPublicPage() {
  const { user } = Route.useRouteContext();

  return (
    <MesContactsView
      projet="GRAND_PUBLIC"
      userId={user.id}
      canFilter={user.role !== 'COMMERCIAL'}
    />
  );
}
