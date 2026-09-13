import { createFileRoute } from '@tanstack/react-router';
import { useSearchParams } from 'next/navigation';

import { FiltersBarSkeleton } from '@/components/filters/filters-bar';
import { ProspectsTableSkeleton } from '@/components/prospects/prospects-table';
import { ProspectsView } from '@/components/prospects/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { parseProspectFilters } from '@/lib/filters';
import { guardRoles } from '@/lib/guard';
import { canExportProspects, readsOnly } from '@/lib/types';

export const Route = createFileRoute('/_panneau/chues/prospects/')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: ProspectsPage,
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

/** La page `(panel)/chues/prospects` de la v1. */
function ProspectsPage() {
  const { user } = Route.useRouteContext();
  const filters = parseProspectFilters(useSearchParams());
  filters.projet = 'CHUES';

  return (
    <ProspectsView
      canAdminister={user.role === 'ADMIN'}
      canExport={canExportProspects(user.role)}
      readOnly={readsOnly(user.role)}
      campaignScoped={user.role === 'COMMERCIAL'}
    />
  );
}
