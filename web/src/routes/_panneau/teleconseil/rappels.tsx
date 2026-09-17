import { createFileRoute } from '@tanstack/react-router';

import { RappelsView } from '@/components/rappels/rappels-view';
import { RepresentantsSuiviView } from '@/components/rappels/representants-suivi-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/rappels')({
  beforeLoad: guardPermission('fiches.tenir'),
  component: TeleconseilRappelsPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

/** La page `/teleconseil/rappels` unifiée. */
function TeleconseilRappelsPage() {
  const { user } = Route.useRouteContext();
  const canFilter = user.role !== 'COMMERCIAL';

  return (
    <Tabs defaultValue="prospects">
      <TabsList>
        <TabsTrigger value="prospects">Prospects</TabsTrigger>
        <TabsTrigger value="representants">Représentants</TabsTrigger>
      </TabsList>
      <TabsContent value="prospects">
        <RappelsView canFilter={canFilter} />
      </TabsContent>
      <TabsContent value="representants">
        <RepresentantsSuiviView userId={user.id} canFilter={canFilter} />
      </TabsContent>
    </Tabs>
  );
}
