import { createFileRoute } from '@tanstack/react-router';

import { ConsoleView } from '@/components/console/console-view';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/plateforme')({
  beforeLoad: guardRoles(['CCP', 'ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: PlateformePage,
});

/** Les fiches venues des plateformes d'enrôlement : les CCP les appellent, l'encadrement les lit. */
function PlateformePage() {
  const { user } = Route.useRouteContext();
  return <ConsoleView viewerId={user.id} plateforme />;
}
