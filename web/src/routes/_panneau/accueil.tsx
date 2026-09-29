import { createFileRoute, Outlet } from '@tanstack/react-router';

import { VisitesTabs } from '@/components/accueil/visites-tabs';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil')({
  beforeLoad: guardPermission('accueil.registre'),
  component: AccueilLayout,
});

/** Le layout `(panel)/accueil` de la v1. */
function AccueilLayout() {
  return (
    <div className="flex w-full flex-col gap-6 md:pr-60">
      <VisitesTabs />
      <Outlet />
    </div>
  );
}
