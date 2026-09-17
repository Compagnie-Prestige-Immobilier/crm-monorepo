import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { AppelProspect } from '@/components/grand-public/appel-prospect';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProspect } from '@/lib/data/prospects';
import { guardPermission } from '@/lib/guard';
import { queryKeys } from '@/lib/query-keys';

export const Route = createFileRoute('/_panneau/teleconseil/appel/$id')({
  beforeLoad: guardPermission('prospects.convertir'),
  component: AppelProspectPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de la fiche">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function AppelProspectPage() {
  const { id } = Route.useParams();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.prospect(id),
    queryFn: () => fetchProspect(id),
  });

  if (isPending) return <Loading />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => {
          void refetch();
        }}
        fallback="Le prospect n’a pas pu être chargé."
      />
    );
  }

  return <AppelProspect prospect={data} />;
}
