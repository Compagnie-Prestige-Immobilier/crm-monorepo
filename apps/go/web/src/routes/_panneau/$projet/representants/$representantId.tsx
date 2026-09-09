import { createFileRoute } from '@tanstack/react-router';

import { FicheRepresentant } from '@/components/representants/fiche';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/representants/$representantId')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: EcranRepresentant,
});

function EcranRepresentant() {
  const { representantId } = Route.useParams();
  const { projet, user } = Route.useRouteContext();
  const encadrement = user.role === 'SUPERVISEUR' || user.role === 'DIRECTION';

  return (
    <FicheRepresentant
      projet={projet}
      representantId={representantId}
      utilisateur={user}
      peutAdministrer={user.role === 'ADMIN'}
      lectureSeule={encadrement}
    />
  );
}
