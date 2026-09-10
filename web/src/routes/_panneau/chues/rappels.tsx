import { createFileRoute } from '@tanstack/react-router';

import { RappelsView } from '@/components/rappels/rappels-view';
import { RepresentantsSuiviView } from '@/components/rappels/representants-suivi-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/rappels')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: RappelsPage,
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

/** La page `(panel)/chues/rappels` de la v1. */
function RappelsPage() {
  const { user } = Route.useRouteContext();
  const canFilter = user.role !== 'COMMERCIAL';

  return (
    <div className="flex flex-col gap-10">
      <RepresentantsSuiviView userId={user.id} canFilter={canFilter} />
      <RappelsView canFilter={canFilter} />
    </div>
  );
}
