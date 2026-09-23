import { createFileRoute, redirect } from '@tanstack/react-router';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectsView } from '@/components/prospects/prospects-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefusPermission, type Contexte } from '@/lib/guard';
import { peut } from '@/lib/types';

/** Un rendez-vous téléphonique n'amène personne au comptoir : l'écran l'écarte. */
const RENDEZ_VOUS_TELEPHONIQUE = 'RDV_TELEPHONIQUE';

const TOUS = 'tous';

/** Les sous-motifs du motif « Rendez-vous », tels que la console les propose. */
const TYPES: readonly { value: string; label: string }[] = [
  { value: TOUS, label: 'Tous' },
  { value: 'RV_CPI', label: 'RV CPI' },
  { value: 'RV_SITE', label: 'RV site' },
  { value: 'RV_EXTERNE', label: 'RV externe' },
];

export const Route = createFileRoute('/_panneau/accueil/rendez-vous')({
  beforeLoad: (contexte: Contexte & { location: { searchStr: string } }) => {
    const { user } = contexte.context;
    if (!peut(user, 'rendez_vous.suivre')) {
      throw new RefusPermission(user.role);
    }
    const params = new URLSearchParams(contexte.location.searchStr);
    if (
      params.get('phase2Status') !== 'APPOINTMENT' ||
      params.get('sansMotif') !== RENDEZ_VOUS_TELEPHONIQUE
    ) {
      params.set('phase2Status', 'APPOINTMENT');
      params.set('sansMotif', RENDEZ_VOUS_TELEPHONIQUE);
      throw redirect({ href: `/accueil/rendez-vous?${params.toString()}` });
    }
  },
  component: RendezVousAccueilPage,
});

/** Les rendez-vous obtenus par les téléconseillers, à confirmer au comptoir. */
function RendezVousAccueilPage() {
  const { user } = Route.useRouteContext();
  const { filters, setFilters } = useProspectFilters();

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={filters.motif ?? TOUS}
        onValueChange={(value) => {
          setFilters({ motif: value === TOUS ? null : value });
        }}
      >
        <TabsList>
          {TYPES.map((type) => (
            <TabsTrigger key={type.value} value={type.value}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ProspectsView
        canAdminister={peut(user, 'fiches.ignorer_propriete')}
        canExport={peut(user, 'exports.prospects')}
        readOnly
      />
    </div>
  );
}
