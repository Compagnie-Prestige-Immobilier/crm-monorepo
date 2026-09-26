import { createFileRoute } from '@tanstack/react-router';

import { ChiffresView } from '@/components/chiffres/vue';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/pilotage')({
  beforeLoad: guardPermission('chiffres.voir_montants'),
  component: TableauDePilotage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

function TableauDePilotage() {
  return <ChiffresView ecran="pilotage" />;
}
