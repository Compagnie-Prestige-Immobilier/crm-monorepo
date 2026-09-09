import { createFileRoute } from '@tanstack/react-router';

import { FicheProspect } from '@/components/prospects/fiche';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/prospects/$prospectId')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: EcranProspect,
});

function EcranProspect() {
  const { prospectId } = Route.useParams();
  const { projet, user } = Route.useRouteContext();

  return <FicheProspect projet={projet} prospectId={prospectId} role={user.role} />;
}
