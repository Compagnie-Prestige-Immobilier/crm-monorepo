import { createFileRoute, redirect } from '@tanstack/react-router';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { ProspectsView } from '@/components/prospects/prospects-view';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefusPermission, type Contexte } from '@/lib/guard';
import { peut, type Phase2Status } from '@/lib/types';

const SUIVIS: readonly { value: Phase2Status; label: string }[] = [
  { value: 'INTERESTED', label: 'Intéressés' },
  { value: 'HESITANT', label: 'Hésitants' },
];

export const Route = createFileRoute('/_panneau/accueil/interesses')({
  beforeLoad: (contexte: Contexte & { location: { searchStr: string } }) => {
    const { user } = contexte.context;
    if (!peut(user, 'rendez_vous.closer')) throw new RefusPermission(user.role);
    const statut = new URLSearchParams(contexte.location.searchStr).get('phase2Status');
    if (!SUIVIS.some((suivi) => suivi.value === statut)) {
      throw redirect({ href: '/accueil/interesses?phase2Status=INTERESTED' });
    }
  },
  component: InteressesPage,
});

/** Les fiches à relancer vers un rendez-vous, tous téléconseillers confondus. */
function InteressesPage() {
  const { user } = Route.useRouteContext();
  const { filters, setFilters } = useProspectFilters();
  return (
    <div className="flex flex-col gap-6">
      <Tabs
        value={filters.phase2Status}
        onValueChange={(value) => {
          setFilters({ phase2Status: value as Phase2Status });
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
        canExport={peut(user, 'exports.prospects')}
        readOnly={false}
      />
    </div>
  );
}
