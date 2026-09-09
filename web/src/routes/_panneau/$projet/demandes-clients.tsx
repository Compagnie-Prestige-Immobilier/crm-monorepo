import { createFileRoute } from '@tanstack/react-router';

import { DemandesClients } from '@/components/banque/demandes';
import { guardProjet } from '@/lib/guard';
import { AUCUN, BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/demandes-clients')({
  beforeLoad: guardProjet({ chues: BANQUE, 'grand-public': AUCUN }),
  component: DemandesClientsPage,
});

function DemandesClientsPage() {
  const { user } = Route.useRouteContext();
  return <DemandesClients role={user.role} />;
}
