import { createFileRoute } from '@tanstack/react-router';

import { ParametresChuesCard } from '@/components/settings/parametres-chues-card';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/parametres-chues')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: ParametresChuesPage,
});

function ParametresChuesPage() {
  const { user } = Route.useRouteContext();
  return <ParametresChuesCard peutToutRegler={user.role === 'ADMIN'} />;
}
