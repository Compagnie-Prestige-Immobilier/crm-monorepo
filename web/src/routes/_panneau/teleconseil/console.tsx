import { createFileRoute } from '@tanstack/react-router';

import { ConsoleView } from '@/components/console/console-view';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/console')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE']),
  component: ConsolePage,
});

function ConsolePage() {
  const { user } = Route.useRouteContext();
  return (
    <ConsoleView
      viewerId={user.id}
      role={user.role}
      canCreateProspect={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
    />
  );
}
