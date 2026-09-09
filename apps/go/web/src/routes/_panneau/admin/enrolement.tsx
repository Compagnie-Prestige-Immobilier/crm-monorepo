import { createFileRoute } from '@tanstack/react-router';

import { EnrolementView } from '@/components/admin/enrolement-view';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/enrolement')({
  beforeLoad: guardRoles(ADMIN_SEUL),
  component: EnrolementView,
});
