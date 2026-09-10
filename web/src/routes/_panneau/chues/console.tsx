import { createFileRoute } from '@tanstack/react-router';

import { EtapeSkeleton } from '@/components/chues/etapes';
import { ConsoleView } from '@/components/console/console-view';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/console')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE', 'SUPERVISEUR', 'DIRECTION']),
  component: ConsolePage,
  pendingComponent: Loading,
});

function Loading() {
  return <EtapeSkeleton />;
}

/** La page `(panel)/chues/console` de la v1. */
function ConsolePage() {
  return <ConsoleView projet="CHUES" />;
}
