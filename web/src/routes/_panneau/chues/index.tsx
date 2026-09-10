import { createFileRoute, redirect } from '@tanstack/react-router';

import { HubView } from '@/components/chues/hub-view';
import { LienFormulairePublic } from '@/components/chues/lien-formulaire-public';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/')({
  beforeLoad: ({ context }) => {
    guardRoles([
      'ADMIN',
      'COMMERCIAL',
      'CHARGE_CLIENTELE',
      'SUPERVISEUR',
      'DIRECTION',
      'BANQUE_FINANCE',
    ])({ context });
    if (context.user.role === 'BANQUE_FINANCE') throw redirect({ href: '/chues/banque' });
  },
  component: ProjetChuesPage,
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

/** La page `(panel)/chues` de la v1. */
function ProjetChuesPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <HubView prenom={user.fullName.split(' ')[0] ?? user.fullName} />
      <LienFormulairePublic lien={`${window.location.origin}/demande/${user.id}`} />
    </div>
  );
}
