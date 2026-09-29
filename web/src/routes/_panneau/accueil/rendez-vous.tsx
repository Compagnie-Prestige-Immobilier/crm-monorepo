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
  component: RendezVousPage,
});

/** Même liste pour tous : le chargé de clientèle y remplit le closing, le comptoir y enregistre la visite. */
function RendezVousPage() {
  const { user } = Route.useRouteContext();
  const [historique, setHistorique] = useState(false);
  const closing = peut(user, 'rendez_vous.closer');
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
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
        peutCloser={closing}
        peutExporter={peut(user, 'rendez_vous.exporter')}
        peutEnregistrerVisite={!closing && peut(user, 'accueil.registre')}
      />
    </div>
  );
}
