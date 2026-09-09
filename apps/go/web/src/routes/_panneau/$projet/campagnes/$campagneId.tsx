import { createFileRoute } from '@tanstack/react-router';

import { DetailCampagne } from '@/components/campagnes/detail';
import { guardProjet } from '@/lib/guard';
import { PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/campagnes/$campagneId')({
  beforeLoad: guardProjet({ chues: PILOTAGE, 'grand-public': PILOTAGE }),
  component: EcranCampagne,
});

function EcranCampagne() {
  const { campagneId } = Route.useParams();
  const { projet, user } = Route.useRouteContext();

  return (
    <DetailCampagne
      id={campagneId}
      projet={projet}
      peutRegler={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
    />
  );
}
