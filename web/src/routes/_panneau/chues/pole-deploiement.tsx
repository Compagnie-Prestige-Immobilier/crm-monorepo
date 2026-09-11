import { createFileRoute } from '@tanstack/react-router';

import { OngletsPilotage } from '@/components/pilotage/onglets';
import { PoleDeploiement } from '@/components/pilotage/pole-deploiement';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/pole-deploiement')({
  beforeLoad: guardRoles(['ADMIN']),
  component: PoleDeploiementPage,
});

function PoleDeploiementPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" role={user.role} />
      <PoleDeploiement />
    </div>
  );
}
