import { createFileRoute } from '@tanstack/react-router';

import { InteressesListe } from '@/components/accueil/interesses-liste';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil/interesses')({
  beforeLoad: guardPermission('rendez_vous.closer'),
  component: InteressesListe,
});
