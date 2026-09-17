import { createFileRoute } from '@tanstack/react-router';

import { ConsoleView } from '@/components/console/console-view';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/plateforme')({
  beforeLoad: guardPermission('plateforme.saisir'),
  component: PlateformePage,
});

/** Les fiches venues des plateformes d'enrôlement : seuls les CCP les appellent. */
function PlateformePage() {
  const { user } = Route.useRouteContext();
  return <ConsoleView viewerId={user.id} role={user.role} plateforme />;
}
