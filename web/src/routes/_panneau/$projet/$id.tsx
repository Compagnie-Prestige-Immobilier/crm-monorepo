import { createFileRoute } from '@tanstack/react-router';

import { ProspectFiche } from '@/components/grand-public/prospect-fiche';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/$id')({
  beforeLoad: guardProjet({ chues: AUCUN, 'grand-public': APPELANTS }),
  component: Fiche,
});

function Fiche() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  return <ProspectFiche id={id} role={user.role} />;
}
