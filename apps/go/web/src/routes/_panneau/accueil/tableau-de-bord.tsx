import { createFileRoute } from '@tanstack/react-router';

import { TableauDeBordVisitesView } from '@/components/accueil/tableau-de-bord-view';
import { guardRoles } from '@/lib/guard';
import { ACCUEIL_LECTURE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/accueil/tableau-de-bord')({
  beforeLoad: guardRoles(ACCUEIL_LECTURE),
  component: TableauDeBordVisites,
});

function TableauDeBordVisites() {
  const { user } = Route.useRouteContext();
  return <TableauDeBordVisitesView role={user.role} />;
}
