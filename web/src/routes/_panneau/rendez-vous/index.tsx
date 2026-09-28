import { createFileRoute } from '@tanstack/react-router';

import { RendezVousListe } from '@/components/accueil/rendez-vous-liste';
import { guardPermission } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/rendez-vous/')({
  beforeLoad: guardPermission('rendez_vous.closer'),
  component: RendezVousATraiterPage,
});

function RendezVousATraiterPage() {
  const { user } = Route.useRouteContext();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <RendezVousListe
        historique={false}
        peutNoter={peut(user, 'rendez_vous.suivre')}
        peutCloser
        peutExporter={peut(user, 'rendez_vous.exporter')}
        peutEnregistrerVisite={false}
      />
    </div>
  );
}
