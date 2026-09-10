import { createFileRoute } from '@tanstack/react-router';

import { RepresentantsView } from '@/components/representants/representants-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';
import { canExportRepresentants, readsOnly } from '@/lib/types';

export const Route = createFileRoute('/_panneau/chues/representants/')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: RepresentantsPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

/** La page `(panel)/chues/representants` de la v1. */
function RepresentantsPage() {
  const { user } = Route.useRouteContext();

  return (
    <RepresentantsView
      canAdminister={user.role === 'ADMIN'}
      readOnly={readsOnly(user.role)}
      canExport={canExportRepresentants(user.role)}
      campaignScoped={user.role === 'COMMERCIAL'}
    />
  );
}
