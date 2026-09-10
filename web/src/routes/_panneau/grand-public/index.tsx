import { createFileRoute } from '@tanstack/react-router';

import {
  GrandPublicProspectsView,
  GrandPublicTableSkeleton,
} from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';
import { canExportProspects, readsOnly } from '@/lib/types';

export const Route = createFileRoute('/_panneau/grand-public/')({
  beforeLoad: guardRoles(['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE']),
  component: GrandPublicPage,
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

/** La page `(panel)/grand-public` de la v1. */
function GrandPublicPage() {
  const { user } = Route.useRouteContext();

  return (
    <GrandPublicProspectsView
      canCreate={!readsOnly(user.role)}
      canExport={canExportProspects(user.role)}
      campaignScoped={user.role === 'COMMERCIAL'}
    />
  );
}
