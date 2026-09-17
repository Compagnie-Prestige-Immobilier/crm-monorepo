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
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <VisitesTabs />
      <Outlet />
    </div>
  );
}
