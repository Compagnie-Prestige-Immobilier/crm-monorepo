import { createFileRoute } from '@tanstack/react-router';

import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { RappelsView } from '@/components/rappels/rappels-view';
import { RepresentantsSuiviView } from '@/components/rappels/representants-suivi-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/rappels')({
  beforeLoad: guardPermission('fiches.tenir'),
  component: RappelsPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-12 w-52" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <GrandPublicTableSkeleton />
    </div>
  );
}

/** La page `(panel)/grand-public/rappels` de la v1. */
function RappelsPage() {
  const { user } = Route.useRouteContext();
  const canFilter = user.role !== 'COMMERCIAL';

  return (
    <Tabs defaultValue="representants">
      <TabsList>
        <TabsTrigger value="representants">Représentants</TabsTrigger>
        <TabsTrigger value="prospects">Prospects</TabsTrigger>
      </TabsList>
      <TabsContent value="representants">
        <RepresentantsSuiviView userId={user.id} canFilter={canFilter} />
      </TabsContent>
      <TabsContent value="prospects">
        <RappelsView canFilter={canFilter} />
      </TabsContent>
    </Tabs>
  );
}
