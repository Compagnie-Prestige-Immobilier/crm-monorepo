import { createFileRoute } from '@tanstack/react-router';

import { OngletsPilotage } from '@/components/pilotage/onglets';
import { VueActivite } from '@/components/supervision/activite';
import { FichesRestees } from '@/components/supervision/fiches';
import { VuePresence } from '@/components/supervision/presence';
import { guardProjet } from '@/lib/guard';
import { PILOTAGE } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/supervision')({
  beforeLoad: guardProjet({ chues: PILOTAGE, 'grand-public': PILOTAGE }),
  validateSearch: (search: Record<string, unknown>): { volet?: 'comptes' } =>
    search.volet === 'comptes' ? { volet: 'comptes' } : {},
  component: EcranSupervision,
});

function EcranSupervision() {
  const { projet, projetApi, user } = Route.useRouteContext();
  const { volet } = Route.useSearch();
  // La libération d'une fiche est fermée à la direction : lui montrer la liste
  // reviendrait à lui offrir un bouton que le serveur refuse.
  const peutLiberer = user.role === 'ADMIN' || user.role === 'SUPERVISEUR';

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage projet={projet} role={user.role} />
      {volet === 'comptes' ? (
        <div className="flex flex-col gap-6">
          {peutLiberer ? <FichesRestees /> : null}
          <VuePresence />
        </div>
      ) : (
        <VueActivite projet={projet} projetApi={projetApi} peutReglerLesCreneaux={peutLiberer} />
      )}
    </div>
  );
}
