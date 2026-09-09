import { createFileRoute } from '@tanstack/react-router';

import { ComptesView } from '@/components/admin/comptes-view';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/commerciaux')({
  beforeLoad: guardRoles(ADMIN_SEUL),
  component: ComptesView,
});
