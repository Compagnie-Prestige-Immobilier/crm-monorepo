import { createFileRoute } from '@tanstack/react-router';

import {
  GrandPublicProspectsView,
  GrandPublicTableSkeleton,
} from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';
import { canExportProspects } from '@/lib/types';

export const Route = createFileRoute('/_panneau/grand-public/')({
  beforeLoad: guardPermission('prospects.lire'),
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

  // Le superviseur travaille les fiches Grand Public ; seule la DIRECTION y lit.
  return (
    <GrandPublicProspectsView
      viewerId={user.id}
      canCreate={['ADMIN', 'SUPERVISEUR', 'DIRECTION', 'CHARGE_CLIENTELE'].includes(user.role)}
      canExport={canExportProspects(user.role)}
      campaignScoped={user.role === 'COMMERCIAL'}
      canFilterOrigine={user.role === 'COMMERCIAL' || user.role === 'CHARGE_CLIENTELE'}
    />
  );
}
