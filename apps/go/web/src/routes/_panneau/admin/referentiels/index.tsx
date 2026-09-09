import { createFileRoute } from '@tanstack/react-router';

import { ReferentielsView } from '@/components/admin/referentiels-view';
import { guardRoles } from '@/lib/guard';
import { PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/referentiels/')({
  beforeLoad: guardRoles(PILOTAGE),
  component: ReferentielsView,
});
