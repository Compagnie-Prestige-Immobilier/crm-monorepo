import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { RendezVousComptoir } from '@/components/accueil/rendez-vous-comptoir';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefusPermission, type Contexte } from '@/lib/guard';
import { peut } from '@/lib/types';

const TOUS = 'tous';

/** Les sous-motifs du motif « Rendez-vous » qui amènent quelqu'un au comptoir. */
const TYPES: readonly { value: string; label: string }[] = [
  { value: TOUS, label: 'Tous' },
  { value: 'RV_CPI', label: 'RV CPI' },
  { value: 'RV_SITE', label: 'RV site' },
  { value: 'RV_EXTERNE', label: 'RV externe' },
];

export const Route = createFileRoute('/_panneau/accueil/rendez-vous')({
  beforeLoad: ({ context }: Contexte) => {
    if (!peut(context.user, 'rendez_vous.voir')) {
      throw new RefusPermission(context.user.role);
    }
  },
  component: RendezVousAccueilPage,
});

/** Les rendez-vous obtenus par les téléconseillers, à confirmer au comptoir. */
function RendezVousAccueilPage() {
  const { user } = Route.useRouteContext();
  const [type, setType] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={type ?? TOUS}
        onValueChange={(value) => {
          setType(value === TOUS ? null : value);
        }}
      >
        <TabsList>
          {TYPES.map((choix) => (
            <TabsTrigger key={choix.value} value={choix.value}>
              {choix.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <RendezVousComptoir
        type={type}
        peutNoter={peut(user, 'rendez_vous.suivre')}
        peutExporter={peut(user, 'rendez_vous.exporter')}
        peutEnregistrerVisite={peut(user, 'accueil.registre')}
      />
    </div>
  );
}
