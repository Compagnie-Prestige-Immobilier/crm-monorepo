import { createFileRoute } from '@tanstack/react-router';

import { LotExportDetailView } from '@/components/lots-export/lot-export-detail-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/campagnes/$id')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: TeleconseilCampagneDetailPage,
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

/** La page `/teleconseil/campagnes/$id` unifiée. */
function TeleconseilCampagneDetailPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();

  return (
    <LotExportDetailView
      id={id}
      peutRegler={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
    />
  );
}
