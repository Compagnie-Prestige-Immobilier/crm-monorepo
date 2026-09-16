import { createFileRoute } from '@tanstack/react-router';

import { VentesView } from '@/components/ventes/ventes-view';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/ventes/')({
  beforeLoad: guardRoles(['ADMIN', 'DIRECTION']),
  component: VentesView,
});
