import { createFileRoute, Navigate } from '@tanstack/react-router';

import { HubVue } from '@/components/chues/hub-vue';
import { ProspectsVue } from '@/components/grand-public/prospects-vue';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, APPELANTS_ET_BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/')({
  beforeLoad: guardProjet({ chues: APPELANTS_ET_BANQUE, 'grand-public': APPELANTS }),
  component: Accueil,
});

function Accueil() {
  const { projet } = Route.useParams();
  const { user } = Route.useRouteContext();

  if (projet !== 'chues') return <ProspectsVue role={user.role} />;

  // L'agent bancaire n'a rien à lire dans les trois étapes : son travail
  // commence là où celui-ci finit.
  if (user.role === 'BANQUE_FINANCE') {
    return <Navigate to="/$projet/banque" params={{ projet: 'chues' }} replace />;
  }

  const prenom = user.fullName.split(' ')[0] ?? user.fullName;
  return <HubVue prenom={prenom} jetonPublic={user.id} />;
}
