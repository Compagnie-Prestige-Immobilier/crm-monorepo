import { createFileRoute } from '@tanstack/react-router';

import { ConsoleView } from '@/components/console/console-view';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/console')({
  beforeLoad: guardPermission('prospects.convertir'),
  component: ConsolePage,
});

function ConsolePage() {
  const { user } = Route.useRouteContext();
  return <ConsoleView viewerId={user.id} canCreateProspect={peut(user, 'prospects.superviser')} />;
}
