import { createFileRoute, redirect } from '@tanstack/react-router';

import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { LotsExportView } from '@/components/lots-export/lots-export-view';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/_panneau/grand-public/campagnes/')({
  // La v1 renvoyait un rôle refusé vers l'accueil du projet, sans écran de refus.
  beforeLoad: ({ context }) => {
    if (!['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(context.user.role)) {
      throw redirect({ href: '/grand-public' });
    }
  },
  component: LotsExportGrandPublicPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-12 w-52" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <GrandPublicTableSkeleton />
    </div>
  );
}

/** La page `(panel)/grand-public/campagnes` de la v1. */
function LotsExportGrandPublicPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="grand-public" role={user.role} />
      <LotsExportView
        canCreate={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
        canDelete={user.role === 'ADMIN'}
        projet="GRAND_PUBLIC"
      />
    </div>
  );
}
