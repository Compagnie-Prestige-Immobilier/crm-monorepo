import { createFileRoute } from '@tanstack/react-router';

import { FiltersBarSkeleton } from '@/components/filters/filters-bar';
import { ProspectDetailView } from '@/components/prospects/prospect-detail-view';
import { ProspectsTableSkeleton } from '@/components/prospects/prospects-table';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/prospects/$id')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: ProspectPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-11 w-44" />
      </div>
      <FiltersBarSkeleton />
      <ProspectsTableSkeleton />
    </div>
  );
}

/** La page `(panel)/chues/prospects/[id]` de la v1. */
function ProspectPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();

  return <ProspectDetailView prospectId={id} role={user.role} />;
}
