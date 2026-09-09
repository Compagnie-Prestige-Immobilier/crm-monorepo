import { createFileRoute } from '@tanstack/react-router';

import { DetailDossierBancaire } from '@/components/banque/detail';
import { guardProjet } from '@/lib/guard';
import { BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/dossiers/$dossierId')({
  beforeLoad: guardProjet({ chues: BANQUE, 'grand-public': BANQUE }),
  component: DossierPage,
});

function DossierPage() {
  const { dossierId } = Route.useParams();
  const { projet, user } = Route.useRouteContext();
  return <DetailDossierBancaire dossierId={dossierId} projet={projet} role={user.role} />;
}
