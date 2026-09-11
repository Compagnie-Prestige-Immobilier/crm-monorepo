import { createFileRoute } from '@tanstack/react-router';

import { EnrolementView } from '@/components/enrolement/enrolement-view';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/pole-enrolement')({
  beforeLoad: guardRoles(['ADMIN']),
  component: PoleEnrolementPage,
});

/** Le même écran que `/admin/enrolement`, dans la coque où le pilotage se lit. */
function PoleEnrolementPage() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" role={user.role} />
      <EnrolementView />
    </div>
  );
}
