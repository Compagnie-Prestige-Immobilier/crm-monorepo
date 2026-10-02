import { createFileRoute, redirect } from '@tanstack/react-router';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectsView } from '@/components/prospects/prospects-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefusPermission, type Contexte } from '@/lib/guard';
import { peut, readsOnly, type Phase2Status, type SessionUser } from '@/lib/types';

const SUIVIS: readonly { value: Phase2Status | 'TOUT'; label: string }[] = [
  { value: 'TOUT', label: 'Tout' },
  { value: 'INTERESTED', label: 'Intéressés' },
  { value: 'HESITANT', label: 'Hésitants' },
  { value: 'APPOINTMENT', label: 'Rendez-vous' },
];

// Le CC suit les rendez-vous sans superviser : il ne voit que cet onglet.
const suivisDe = (user: SessionUser): typeof SUIVIS =>
  peut(user, 'prospects.superviser')
    ? SUIVIS
    : SUIVIS.filter((suivi) => suivi.value === 'APPOINTMENT');

export const Route = createFileRoute('/_panneau/teleconseil/interesses')({
  beforeLoad: (contexte: Contexte & { location: { searchStr: string } }) => {
    const { user } = contexte.context;
    if (!peut(user, 'prospects.superviser') && !peut(user, 'rendez_vous.suivre')) {
      throw new RefusPermission(user);
    }
    const params = new URLSearchParams(contexte.location.searchStr);
    const statut = params.get('phase2Status');
    if (!suivisDe(user).some((suivi) => suivi.value === statut)) {
      throw redirect({
        href: `/teleconseil/interesses?phase2Status=${suivisDe(user)[0]?.value ?? 'APPOINTMENT'}`,
      });
    }
    if (params.has('sansMotif')) {
      params.delete('sansMotif');
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
          const statut = value as Phase2Status | 'TOUT';
          setFilters({ phase2Status: statut, sansMotif: null });
        }}
      >
        <TabsList>
          {suivisDe(user).map((suivi) => (
            <TabsTrigger key={suivi.value} value={suivi.value}>
              {suivi.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ProspectsView
        canAdminister={peut(user, 'fiches.ignorer_propriete')}
        canReassign={peut(user, 'prospects.reaffecter_tout')}
        canExport={peut(user, 'exports.prospects')}
        readOnly={readsOnly(user)}
        viewerId={peut(user, 'portefeuille.voir_tout') ? user.id : undefined}
      />
    </div>
  );
}
