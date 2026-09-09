import { createFileRoute } from '@tanstack/react-router';

import { MesContactsView } from '@/components/chues/mes-contacts-view';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/mes-contacts')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': APPELANTS }),
  component: MesContacts,
});

function MesContacts() {
  const { projet, user } = Route.useRouteContext();
  return (
    <MesContactsView projet={projet} userId={user.id} peutFiltrer={PILOTAGE.includes(user.role)} />
  );
}
