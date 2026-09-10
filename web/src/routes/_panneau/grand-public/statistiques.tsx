import { createFileRoute } from '@tanstack/react-router';

import { ChiffresView } from '@/components/chiffres/vue';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/statistiques')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: ChiffresGrandPublicPage,
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

/** La page `(panel)/grand-public/statistiques` de la v1. */
function ChiffresGrandPublicPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="grand-public" role={user.role} />
      <ChiffresView ecran="grand-public" role={user.role} />
    </div>
  );
}
