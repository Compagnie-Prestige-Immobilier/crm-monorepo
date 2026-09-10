import { createFileRoute } from '@tanstack/react-router';

import { EtapeSkeleton } from '@/components/chues/etapes';
import { RepScript } from '@/components/console/rep-script';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/appels-representants')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: AppelsRepresentantsPage,
  pendingComponent: Loading,
});

function Loading() {
  return <EtapeSkeleton />;
}

/** La page `(panel)/chues/appels-representants` de la v1. */
function AppelsRepresentantsPage() {
  return <RepScript />;
}
