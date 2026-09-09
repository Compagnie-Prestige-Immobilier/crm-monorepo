import { createFileRoute } from '@tanstack/react-router';

import { ExportDossiers } from '@/components/banque/export';
import { guardProjet } from '@/lib/guard';
import { BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/dossiers/export')({
  beforeLoad: guardProjet({ chues: BANQUE, 'grand-public': BANQUE }),
  component: ExportPage,
});

function ExportPage() {
  const { projet } = Route.useRouteContext();
  return <ExportDossiers projet={projet} />;
}
