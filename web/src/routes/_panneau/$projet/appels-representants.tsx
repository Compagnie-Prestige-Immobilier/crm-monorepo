import { createFileRoute } from '@tanstack/react-router';

import { RepAnnuaire } from '@/components/chues/rep-annuaire';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/appels-representants')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: RepAnnuaire,
});
