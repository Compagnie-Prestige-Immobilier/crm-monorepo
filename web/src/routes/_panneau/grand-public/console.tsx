import { createFileRoute } from '@tanstack/react-router';

import { ConsoleView } from '@/components/console/console-view';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/console')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: GrandPublicConsolePage,
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

/** La page `(panel)/grand-public/console` de la v1. */
function GrandPublicConsolePage() {
  const { user } = Route.useRouteContext();
  const canCreateProspect = ['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(user.role);

  return <ConsoleView projet="GRAND_PUBLIC" viewerId={user.id} canCreateProspect={canCreateProspect} />;
}
