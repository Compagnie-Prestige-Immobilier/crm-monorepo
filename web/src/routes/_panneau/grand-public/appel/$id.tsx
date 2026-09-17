import { ApiError } from '@crm/api-client/query';
import { createFileRoute } from '@tanstack/react-router';
import { notFound } from 'next/navigation';

import { AppelProspect } from '@/components/grand-public/appel-prospect';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProspect } from '@/lib/data/prospects';
import { guardPermission } from '@/lib/guard';
import type { ProspectRow } from '@/lib/types';

type Chargement = { statut: 'ok'; prospect: ProspectRow } | { statut: 'panne'; error: unknown };

export const Route = createFileRoute('/_panneau/grand-public/appel/$id')({
  beforeLoad: guardPermission('prospects.convertir'),
  loader: async ({ params }): Promise<Chargement> => {
    try {
      return { statut: 'ok', prospect: await fetchProspect(params.id) };
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 404)) notFound();
      return { statut: 'panne', error };
    }
  },
  component: AppelProspectPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

/** L'appel d'un prospect Grand Public, ouvert d'un clic depuis la liste. */
function AppelProspectPage() {
  const chargement = Route.useLoaderData();

  if (chargement.statut === 'panne') {
    return (
      <QueryErrorState error={chargement.error} fallback="Cette fiche n’a pas pu être chargée." />
    );
  }

  return <AppelProspect prospect={chargement.prospect} />;
}
