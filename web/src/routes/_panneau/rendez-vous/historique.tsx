import { createFileRoute } from '@tanstack/react-router';

import { RendezVousListe } from '@/components/accueil/rendez-vous-liste';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/rendez-vous/historique')({
  beforeLoad: guardPermission('rendez_vous.closer'),
  component: RendezVousHistoriquePage,
});

function RendezVousHistoriquePage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <RendezVousListe
        historique
        peutNoter={false}
        peutCloser
        peutExporter={peut(user, 'rendez_vous.exporter')}
        peutEnregistrerVisite={false}
      />
    </div>
  );
}
