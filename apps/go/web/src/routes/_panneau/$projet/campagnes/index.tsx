import { createFileRoute } from '@tanstack/react-router';

import { ListeCampagnes } from '@/components/campagnes/liste';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardProjet } from '@/lib/guard';
import { PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/campagnes/')({
  beforeLoad: guardProjet({ chues: PILOTAGE, 'grand-public': PILOTAGE }),
  component: EcranCampagnes,
});

function EcranCampagnes() {
  const { projet, projetApi, user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage projet={projet} role={user.role} />
      <ListeCampagnes
        projet={projet}
        projetApi={projetApi}
        peutCreer={user.role === 'ADMIN' || user.role === 'SUPERVISEUR'}
        peutSupprimer={user.role === 'ADMIN'}
      />
    </div>
  );
}
