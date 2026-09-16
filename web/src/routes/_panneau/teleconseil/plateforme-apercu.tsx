import { createFileRoute } from '@tanstack/react-router';

import { PlateformeOverview } from '@/components/console/plateforme-overview';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/plateforme-apercu')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION', 'CCP']),
  component: PlateformeOverviewPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-16 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

function PlateformeOverviewPage() {
  const { user } = Route.useRouteContext();
  return <PlateformeOverview encadrement={user.role !== 'CCP'} />;
}
