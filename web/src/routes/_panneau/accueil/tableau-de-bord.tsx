import { createFileRoute } from '@tanstack/react-router';

import { DashboardVisitesView } from '@/components/accueil/tableau-de-bord/vue';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil/tableau-de-bord')({
  beforeLoad: guardPermission('accueil.registre'),
  component: TableauDeBordVisitesPage,
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

/** La page `(panel)/accueil/tableau-de-bord` de la v1. */
function TableauDeBordVisitesPage() {
  const { user } = Route.useRouteContext();

  return <DashboardVisitesView role={user.role} />;
}
