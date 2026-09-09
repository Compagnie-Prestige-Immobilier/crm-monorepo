import { createFileRoute } from '@tanstack/react-router';

import { ImportRepresentants } from '@/components/representants/import';
import { guardProjet } from '@/lib/guard';
import { ADMIN_SEUL, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/representants/import')({
  beforeLoad: guardProjet({ chues: ADMIN_SEUL, 'grand-public': AUCUN }),
  component: EcranImportRepresentants,
});

function EcranImportRepresentants() {
  const { projet } = Route.useRouteContext();
  return <ImportRepresentants projet={projet} />;
}
