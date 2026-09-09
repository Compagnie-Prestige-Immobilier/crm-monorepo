import { createFileRoute } from '@tanstack/react-router';

import { RegistreView } from '@/components/accueil/registre-view';
import { guardRoles } from '@/lib/guard';
import { ACCUEIL_LECTURE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/accueil/')({
  beforeLoad: guardRoles(ACCUEIL_LECTURE),
  component: Registre,
});

function Registre() {
  const { user } = Route.useRouteContext();
  return <RegistreView role={user.role} />;
}
