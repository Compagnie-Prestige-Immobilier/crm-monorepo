import { createFileRoute } from '@tanstack/react-router';

import { ListeRepresentants } from '@/components/representants/liste';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/representants/')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: EcranRepresentants,
});

function EcranRepresentants() {
  const { projet, user } = Route.useRouteContext();
  const encadrement = user.role === 'SUPERVISEUR' || user.role === 'DIRECTION';

  return (
    <ListeRepresentants
      projet={projet}
      peutAdministrer={user.role === 'ADMIN'}
      lectureSeule={encadrement}
      porteeCampagne={user.role === 'COMMERCIAL' || user.role === 'CHARGE_CLIENTELE'}
    />
  );
}
