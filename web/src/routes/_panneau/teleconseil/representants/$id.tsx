import { createFileRoute } from '@tanstack/react-router';

import { RepresentantDetailView } from '@/components/representants/representant-detail-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';
import { peut, readsOnly } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/representants/$id')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: TeleconseilRepresentantPage,
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

/** La page `/teleconseil/representants/[id]` unifiée. */
function TeleconseilRepresentantPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();

  return (
    <RepresentantDetailView
      representantId={id}
      author={{ id: user.id, fullName: user.fullName }}
      canAdminister={peut(user, 'comptes.administrer')}
      readOnly={readsOnly(user.role)}
    />
  );
}
