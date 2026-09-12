import { createFileRoute } from '@tanstack/react-router';

import { ParametresChuesCard } from '@/components/settings/parametres-chues-card';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/parametres-chues')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: ParametresChuesPage,
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

/** La page `(panel)/chues/parametres-chues` de la v1. */
function ParametresChuesPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <ParametresChuesCard peutToutRegler={user.role === 'ADMIN'} />
    </div>
  );
}
