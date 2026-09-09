import { createFileRoute } from '@tanstack/react-router';

import { VueChiffres } from '@/components/chiffres/vue';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardProjet } from '@/lib/guard';
import { PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/statistiques')({
  beforeLoad: guardProjet({ chues: PILOTAGE, 'grand-public': PILOTAGE }),
  component: EcranStatistiques,
});

function EcranStatistiques() {
  const { projet, projetApi, user } = Route.useRouteContext();

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage projet={projet} role={user.role} />
      <VueChiffres projet={projet} projetApi={projetApi} role={user.role} />
    </div>
  );
}
