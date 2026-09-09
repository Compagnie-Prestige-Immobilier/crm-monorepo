import { createFileRoute } from '@tanstack/react-router';

import { ImportsView } from '@/components/admin/imports-view';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/imports')({
  beforeLoad: guardRoles(ADMIN_SEUL),
  component: ImportsView,
});
