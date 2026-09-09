import { createFileRoute } from '@tanstack/react-router';

import { ListesView } from '@/components/accueil/listes-view';
import { guardRoles } from '@/lib/guard';
import { ACCUEIL_ADMINISTRATION } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/accueil/listes')({
  beforeLoad: guardRoles(ACCUEIL_ADMINISTRATION),
  component: Listes,
});

function Listes() {
  const { user } = Route.useRouteContext();
  return <ListesView role={user.role} />;
}
