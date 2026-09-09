import { createFileRoute } from '@tanstack/react-router';

import { RappelsView } from '@/components/chues/rappels-view';
import { SuiviView } from '@/components/chues/suivi-view';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, ENCADREMENT, PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/rappels')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': APPELANTS }),
  component: Rappels,
});

function Rappels() {
  const { projet, user } = Route.useRouteContext();
  const peutFiltrer = PILOTAGE.includes(user.role);

  return (
    <div className="flex flex-col gap-8">
      <RappelsView
        projet={projet}
        peutFiltrer={peutFiltrer}
        peutAnnuler={!ENCADREMENT.includes(user.role)}
      />
      {projet === 'chues' ? (
        <SuiviView projet={projet} userId={user.id} peutFiltrer={peutFiltrer} />
      ) : null}
    </div>
  );
}
