import { createFileRoute } from '@tanstack/react-router';

import { OngletsPilotage } from '@/components/pilotage/onglets';
import { PoleMarketing } from '@/components/pilotage/pole-marketing';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/pole-marketing')({
  beforeLoad: guardRoles(['ADMIN']),
  component: PoleMarketingPage,
});

function PoleMarketingPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" role={user.role} />
      <PoleMarketing />
    </div>
  );
}
