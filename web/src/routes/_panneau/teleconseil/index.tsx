import { createFileRoute, redirect } from '@tanstack/react-router';

import { HubView } from '@/components/chues/hub-view';
import { LienFormulairePublic } from '@/components/chues/lien-formulaire-public';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/')({
  beforeLoad: ({ context }) => {
    guardRoles([
      'ADMIN',
      'COMMERCIAL',
      'CHARGE_CLIENTELE',
      'SUPERVISEUR',
      'DIRECTION',
      'BANQUE_FINANCE',
    ])({ context });
    if (context.user.role === 'BANQUE_FINANCE') throw redirect({ href: '/finance' });
    if (['ADMIN', 'SUPERVISEUR', 'DIRECTION'].includes(context.user.role)) {
      throw redirect({ href: '/teleconseil/tableau-de-bord' });
    }
  },
  component: TeleconseilPage,
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

/** Écran Mon travail de la coque Téléconseil. */
function TeleconseilPage() {
  const { user } = Route.useRouteContext();
  const encadrement = peut(user, 'portefeuille.voir_tout');

  return (
    <div className="flex flex-col gap-6">
      <HubView
        prenom={user.fullName.split(' ')[0] ?? user.fullName}
        canCreateProspect={encadrement}
        encadrement={encadrement}
      />
      <LienFormulairePublic />
    </div>
  );
}
