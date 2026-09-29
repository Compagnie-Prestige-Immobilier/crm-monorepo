import { createFileRoute } from '@tanstack/react-router';

import { RendezVousAgenda } from '@/components/accueil/rendez-vous-agenda';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil/agenda')({
  beforeLoad: guardPermission('rendez_vous.closer'),
  component: RendezVousAgenda,
});
