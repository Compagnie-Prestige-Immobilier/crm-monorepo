import { createFileRoute } from '@tanstack/react-router';

import { ApercuBanque } from '@/components/banque/apercu';
import { guardProjet } from '@/lib/guard';
import { BANQUE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/banque')({
  beforeLoad: guardProjet({ chues: BANQUE, 'grand-public': BANQUE }),
  component: BanquePage,
});

function BanquePage() {
  const { projet } = Route.useRouteContext();
  return <ApercuBanque projet={projet} />;
}
