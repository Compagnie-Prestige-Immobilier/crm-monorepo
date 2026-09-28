import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { RendezVousListe } from '@/components/accueil/rendez-vous-liste';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/** Le comptoir voit arriver les rendez-vous et note qui vient ; le closing se tient dans l'espace Rendez-vous. */
function RendezVousAccueilPage() {
  const { user } = Route.useRouteContext();
  const [historique, setHistorique] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={historique ? 'historique' : 'a-traiter'}
        onValueChange={(valeur) => {
          setHistorique(valeur === 'historique');
        }}
      >
        <TabsList>
          <TabsTrigger value="a-traiter">À traiter</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>
      </Tabs>
      <RendezVousListe
        key={String(historique)}
        historique={historique}
        peutNoter={peut(user, 'rendez_vous.suivre')}
        peutCloser={false}
        peutExporter={peut(user, 'rendez_vous.exporter')}
        peutEnregistrerVisite={peut(user, 'accueil.registre')}
      />
    </div>
  );
}
