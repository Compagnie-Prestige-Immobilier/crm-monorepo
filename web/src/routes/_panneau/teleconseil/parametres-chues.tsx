import { createFileRoute } from '@tanstack/react-router';

import { ParametresChuesCard } from '@/components/settings/parametres-chues-card';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/teleconseil/parametres-chues')({
  beforeLoad: guardPermission('prospects.superviser'),
  component: ParametresChuesPage,
});

function ParametresChuesPage() {
  const { user } = Route.useRouteContext();
  return <ParametresChuesCard peutToutRegler={peut(user, 'fiches.parametres_reserves')} />;
}
