import { createFileRoute } from '@tanstack/react-router';

import { ImportView } from '@/components/accueil/import-view';
import { guardRoles } from '@/lib/guard';
import { ACCUEIL_ADMINISTRATION } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/accueil/import')({
  beforeLoad: guardRoles(ACCUEIL_ADMINISTRATION),
  component: ImportRegistre,
});

function ImportRegistre() {
  const { user } = Route.useRouteContext();
  return <ImportView role={user.role} />;
}
