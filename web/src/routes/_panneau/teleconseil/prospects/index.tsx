import { createFileRoute } from '@tanstack/react-router';

import { FiltersBarSkeleton } from '@/components/filters/filters-bar';
import { ProspectsTableSkeleton } from '@/components/prospects/prospects-table';
import { ProspectsView } from '@/components/prospects/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';
import { canExportProspects, readsOnly } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/prospects/')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: TeleconseilProspectsPage,
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

/** La page `/teleconseil/prospects` unifiée. */
function TeleconseilProspectsPage() {
  const { user } = Route.useRouteContext();

  return (
    <ProspectsView
      canAdminister={user.role === 'ADMIN'}
      canExport={canExportProspects(user.role)}
      readOnly={readsOnly(user.role)}
      canCreate={['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(user.role)}
      canCreateGrandPublic={['ADMIN', 'SUPERVISEUR', 'DIRECTION', 'CHARGE_CLIENTELE'].includes(
        user.role,
      )}
      campaignScoped={user.role === 'COMMERCIAL'}
    />
  );
}
