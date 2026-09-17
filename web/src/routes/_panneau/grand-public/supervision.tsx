import { createFileRoute } from '@tanstack/react-router';

import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { ActivityView } from '@/components/supervision/activity-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/supervision')({
  beforeLoad: guardPermission('analytics.superviser'),
  component: SupervisionGrandPublicPage,
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

/** La page `(panel)/grand-public/supervision` de la v1. */
function SupervisionGrandPublicPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="grand-public" role={user.role} />
      <ActivityView projet="GRAND_PUBLIC" />
    </div>
  );
}
