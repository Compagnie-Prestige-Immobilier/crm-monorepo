import { createFileRoute } from '@tanstack/react-router';

import { FormulaireParametresChues } from '@/components/parametres-chues/formulaire';
import { guardProjet } from '@/lib/guard';
import { AUCUN, PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/parametres-chues')({
  beforeLoad: guardProjet({ chues: PILOTAGE, 'grand-public': AUCUN }),
  component: EcranParametresChues,
});

function EcranParametresChues() {
  const { user } = Route.useRouteContext();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <FormulaireParametresChues peutToutRegler={user.role === 'ADMIN'} />
    </div>
  );
}
