import { createFileRoute, redirect } from '@tanstack/react-router';

import { HubView } from '@/components/chues/hub-view';
import { LienFormulairePublic } from '@/components/chues/lien-formulaire-public';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/')({
  beforeLoad: ({ context }) => {
    if (!peut(context.user, 'fiches.tenir') && peut(context.user, 'banque.lire')) {
      throw redirect({ href: '/finance' });
    }
    guardPermission('fiches.tenir')({ context });
    if (peut(context.user, 'analytics.superviser')) {
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
      <HubView prenom={user.fullName.split(' ')[0] ?? user.fullName} encadrement={encadrement} />
      <LienFormulairePublic />
    </div>
  );
}
