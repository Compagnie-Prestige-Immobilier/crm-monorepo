import { createFileRoute, redirect } from '@tanstack/react-router';

import { LotsExportView } from '@/components/lots-export/lots-export-view';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/_panneau/chues/campagnes/')({
  // La v1 renvoyait un rôle refusé vers l'accueil du projet, sans écran de refus.
  beforeLoad: ({ context }) => {
    if (!['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(context.user.role)) {
      throw redirect({ href: '/chues' });
    }
  },
  component: LotsExportPage,
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

/** La page `(panel)/chues/campagnes` de la v1. */
function LotsExportPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" role={user.role} />
      <LotsExportView
        canCreate={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
        canDelete={user.role === 'ADMIN'}
        projet="CHUES"
      />
    </div>
  );
}
