import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';

import { OngletsPilotage } from '@/components/pilotage/onglets';
import { SupervisionTabs } from '@/components/supervision/supervision-tabs';
import { SupervisionSkeleton } from '@/components/supervision/supervision-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/supervision')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: SupervisionPage,
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

/** La page `(panel)/chues/supervision` de la v1. */
function SupervisionPage() {
  const { user } = Route.useRouteContext();

  return (
    <Suspense fallback={<SupervisionSkeleton />}>
      <div className="flex flex-col gap-6">
        <OngletsPilotage coque="chues" role={user.role} />
        <SupervisionTabs projet="CHUES" role={user.role} />
      </div>
    </Suspense>
  );
}
