import { createFileRoute } from '@tanstack/react-router';

import { ChampsConversionView } from '@/components/admin/champs-conversion-view';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/champs-conversion')({
  beforeLoad: guardRoles(ADMIN_SEUL),
  component: ChampsConversionView,
});
