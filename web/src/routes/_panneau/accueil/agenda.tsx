import { createFileRoute } from '@tanstack/react-router';

import { RendezVousAgenda } from '@/components/accueil/rendez-vous-agenda';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/accueil/agenda')({
  beforeLoad: guardPermission('rendez_vous.closer'),
  component: AgendaPage,
});

function AgendaPage() {
  const { user } = Route.useRouteContext();
  return <RendezVousAgenda peutExporter={peut(user, 'rendez_vous.exporter')} />;
}
