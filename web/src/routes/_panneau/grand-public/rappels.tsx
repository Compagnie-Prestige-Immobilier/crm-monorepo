import { createFileRoute } from '@tanstack/react-router';

import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { RappelsView } from '@/components/rappels/rappels-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/rappels')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: RappelsPage,
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

/** Les rappels de prospects seuls : les représentants sont une notion CHUES. */
function RappelsPage() {
  const { user } = Route.useRouteContext();
  return <RappelsView canFilter={user.role !== 'COMMERCIAL'} />;
}
