import { createFileRoute } from '@tanstack/react-router';

import { VentesView } from '@/components/ventes/ventes-view';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/ventes/')({
  beforeLoad: guardPermission('ventes.lire'),
  component: VentesView,
});
