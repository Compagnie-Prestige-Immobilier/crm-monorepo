import { createFileRoute, Outlet } from '@tanstack/react-router';

import { VisitesTabs } from '@/components/accueil/visites-tabs';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil')({
  beforeLoad: guardRoles(['ADMIN', 'DIRECTION', 'ACCUEIL']),
  component: AccueilLayout,
});

/** Le layout `(panel)/accueil` de la v1. */
function AccueilLayout() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <VisitesTabs role={user.role} />
      <Outlet />
    </div>
  );
}
