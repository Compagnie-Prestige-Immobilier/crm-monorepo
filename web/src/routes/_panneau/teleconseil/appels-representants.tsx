import { createFileRoute } from '@tanstack/react-router';

import { EtapeSkeleton } from '@/components/chues/etapes';
import { RepScript } from '@/components/console/rep-script';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/appels-representants')({
  beforeLoad: guardPermission('fiches.tenir'),
  component: TeleconseilAppelsRepresentantsPage,
  pendingComponent: Loading,
});

function Loading() {
  return <EtapeSkeleton />;
}

/** La page `/teleconseil/appels-representants` unifiée. */
function TeleconseilAppelsRepresentantsPage() {
  return <RepScript />;
}
