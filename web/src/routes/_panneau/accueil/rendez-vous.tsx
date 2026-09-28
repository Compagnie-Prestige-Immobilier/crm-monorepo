import { createFileRoute } from '@tanstack/react-router';

import { RendezVousComptoir } from '@/components/accueil/rendez-vous-comptoir';
import { RefusPermission, type Contexte } from '@/lib/guard';
import { peut } from '@/lib/types';

export const Route = createFileRoute('/_panneau/accueil/rendez-vous')({
  beforeLoad: ({ context }: Contexte) => {
    if (!peut(context.user, 'rendez_vous.voir')) {
      throw new RefusPermission(context.user.role);
    }
  },
  component: RendezVousAccueilPage,
});

/** Les rendez-vous obtenus au téléphone : confirmation, présence, closing. */
function RendezVousAccueilPage() {
  const { user } = Route.useRouteContext();
  return (
    <RendezVousComptoir
      peutNoter={peut(user, 'rendez_vous.suivre')}
      peutCloser={peut(user, 'rendez_vous.closer')}
      peutExporter={peut(user, 'rendez_vous.exporter')}
      peutEnregistrerVisite={peut(user, 'accueil.registre')}
    />
  );
}
