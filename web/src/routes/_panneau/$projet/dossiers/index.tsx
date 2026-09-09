import { createFileRoute } from '@tanstack/react-router';

import { ListeDossiers } from '@/components/banque/liste';
import { guardProjet } from '@/lib/guard';
import { BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/dossiers/')({
  beforeLoad: guardProjet({ chues: BANQUE, 'grand-public': BANQUE }),
  component: DossiersPage,
});

function DossiersPage() {
  const { projet } = Route.useRouteContext();
  return <ListeDossiers projet={projet} />;
}
