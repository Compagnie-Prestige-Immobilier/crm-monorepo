import { createFileRoute } from '@tanstack/react-router';

import { IssuesAppelView } from '@/components/admin/issues-appel-view';
import { guardRoles } from '@/lib/guard';
import { PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/referentiels/issues-appel')({
  beforeLoad: guardRoles(PILOTAGE),
  component: IssuesAppelView,
});
