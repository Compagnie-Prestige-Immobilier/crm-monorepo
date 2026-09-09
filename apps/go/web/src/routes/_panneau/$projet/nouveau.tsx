import { createFileRoute } from '@tanstack/react-router';

import { ProspectFormulaire } from '@/components/grand-public/prospect-formulaire';
import { guardProjet } from '@/lib/guard';
import { AUCUN, SAISIE_GRAND_PUBLIC } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/nouveau')({
  beforeLoad: guardProjet({ chues: AUCUN, 'grand-public': SAISIE_GRAND_PUBLIC }),
  component: () => <ProspectFormulaire />,
});
