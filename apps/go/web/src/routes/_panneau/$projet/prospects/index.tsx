import { createFileRoute } from '@tanstack/react-router';

import { ListeProspects } from '@/components/prospects/liste';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/prospects/')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: EcranProspects,
});

function EcranProspects() {
  const { projet, user } = Route.useRouteContext();
  const encadrement = user.role === 'SUPERVISEUR' || user.role === 'DIRECTION';

  return (
    <ListeProspects
      projet={projet}
      peutAdministrer={user.role === 'ADMIN'}
      lectureSeule={encadrement}
      porteeCampagne={user.role === 'COMMERCIAL' || user.role === 'CHARGE_CLIENTELE'}
    />
  );
}
