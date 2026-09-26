import { ApiError } from '@crm/api-client/query';
import { createFileRoute } from '@tanstack/react-router';
import { notFound } from 'next/navigation';

import { GrandPublicProspectDetail } from '@/components/grand-public/prospect-detail';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProspect } from '@/lib/data/prospects';
import { fetchOffers } from '@/lib/data/reference';
import { guardPermission } from '@/lib/guard';
import type { Offer, ProspectRow } from '@/lib/types';

type Chargement =
  { statut: 'ok'; prospect: ProspectRow; offers: Offer[] } | { statut: 'panne'; error: unknown };

export const Route = createFileRoute('/_panneau/grand-public/$id')({
  beforeLoad: guardPermission('prospects.lire'),
  loader: async ({ params }): Promise<Chargement> => {
    try {
      const [prospect, offers] = await Promise.all([fetchProspect(params.id), fetchOffers()]);
      return { statut: 'ok', prospect, offers };
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 404)) notFound();
      return { statut: 'panne', error };
    }
  },
  component: GrandPublicProspectPage,
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

/** La page `(panel)/grand-public/[id]` de la v1. */
function GrandPublicProspectPage() {
  const { user } = Route.useRouteContext();
  const chargement = Route.useLoaderData();

  if (chargement.statut === 'panne') {
    return (
      <QueryErrorState error={chargement.error} fallback="Cette fiche n’a pas pu être chargée." />
    );
  }

  return (
    <GrandPublicProspectDetail
      prospect={chargement.prospect}
      offers={chargement.offers}
      canEdit={user.role === 'ADMIN' || user.role === 'COMMERCIAL' || user.role === 'SUPERVISEUR'}
      role={user.role}
    />
  );
}
