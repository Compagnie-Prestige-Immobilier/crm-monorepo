import { createFileRoute, redirect } from '@tanstack/react-router';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectsView } from '@/components/prospects/prospects-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { guardPermission, type Contexte } from '@/lib/guard';
import { canExportProspects, peut, readsOnly, type Phase2Status } from '@/lib/types';

const SUIVIS: readonly { value: Phase2Status; label: string }[] = [
  { value: 'INTERESTED', label: 'Intéressés' },
  { value: 'HESITANT', label: 'Hésitants' },
  { value: 'APPOINTMENT', label: 'Rendez-vous (hors téléphonique)' },
];

/** Un rendez-vous téléphonique n'est pas un rendez-vous : l'onglet l'écarte. */
const RENDEZ_VOUS_TELEPHONIQUE = 'RDV_TELEPHONIQUE';

const sansMotifDe = (statut: Phase2Status): string | null =>
  statut === 'APPOINTMENT' ? RENDEZ_VOUS_TELEPHONIQUE : null;

export const Route = createFileRoute('/_panneau/teleconseil/interesses')({
  beforeLoad: (contexte: Contexte & { location: { searchStr: string } }) => {
    guardPermission('prospects.superviser')(contexte);
    const params = new URLSearchParams(contexte.location.searchStr);
    const statut = params.get('phase2Status');
    if (!SUIVIS.some((suivi) => suivi.value === statut)) {
      throw redirect({ href: '/teleconseil/interesses?phase2Status=INTERESTED' });
    }
    if (statut === 'APPOINTMENT' && params.get('sansMotif') !== RENDEZ_VOUS_TELEPHONIQUE) {
      params.set('sansMotif', RENDEZ_VOUS_TELEPHONIQUE);
      throw redirect({ href: `/teleconseil/interesses?${params.toString()}` });
    }
  },
  component: TeleconseilInteressesPage,
});

/** Les fiches fermées en intéressé, hésitant ou rendez-vous, pour l'encadrement. */
function TeleconseilInteressesPage() {
  const { user } = Route.useRouteContext();
  const { filters, setFilters } = useProspectFilters();

  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={filters.phase2Status}
        onValueChange={(value) => {
          const statut = value as Phase2Status;
          setFilters({ phase2Status: statut, sansMotif: sansMotifDe(statut) });
        }}
      >
        <TabsList>
          {SUIVIS.map((suivi) => (
            <TabsTrigger key={suivi.value} value={suivi.value}>
              {suivi.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ProspectsView
        canAdminister={peut(user, 'fiches.ignorer_propriete')}
        canReassign={peut(user, 'prospects.reaffecter_tout')}
        canExport={canExportProspects(user.role)}
        readOnly={readsOnly(user.role)}
        viewerId={['ADMIN', 'DIRECTION'].includes(user.role) ? user.id : undefined}
      />
    </div>
  );
}
