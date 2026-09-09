import { createFileRoute } from '@tanstack/react-router';

import { FormulaireDossier } from '@/components/banque/formulaire';
import { guardProjet } from '@/lib/guard';
import { BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/dossiers/nouveau')({
  beforeLoad: guardProjet({ chues: BANQUE, 'grand-public': BANQUE }),
  component: NouveauDossierPage,
});

function NouveauDossierPage() {
  const { projet } = Route.useRouteContext();
  return <FormulaireDossier projet={projet} />;
}
