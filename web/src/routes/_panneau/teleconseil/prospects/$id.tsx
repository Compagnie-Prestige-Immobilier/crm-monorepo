import { createFileRoute } from '@tanstack/react-router';

import { GrandPublicProspectDetail } from '@/components/grand-public/prospect-detail';
import { ProspectDetailView } from '@/components/prospects/prospect-detail-view';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchProspect } from '@/lib/data/prospects';
import { fetchOffers } from '@/lib/data/reference';
import { guardRoles } from '@/lib/guard';
import type { Offer, ProspectRow } from '@/lib/types';

type Chargement =
  { statut: 'ok'; prospect: ProspectRow; offers: Offer[] } | { statut: 'panne'; error: unknown };

export const Route = createFileRoute('/_panneau/teleconseil/prospects/$id')({
  beforeLoad: guardRoles(['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL', 'CHARGE_CLIENTELE']),
  loader: async ({ params }): Promise<Chargement> => {
    try {
      const [prospect, offers] = await Promise.all([fetchProspect(params.id), fetchOffers()]);
      return { statut: 'ok', prospect, offers };
    } catch (error) {
      return { statut: 'panne', error };
    }
  },
  component: TeleconseilProspectDetailPage,
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
    </div>
  );
}

/** La page `/teleconseil/prospects/[id]` unifiée. */
function TeleconseilProspectDetailPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const chargement = Route.useLoaderData();

  if (chargement.statut === 'panne') {
    return (
      <QueryErrorState error={chargement.error} fallback="Cette fiche n’a pas pu être chargée." />
    );
  }

  const prospect = chargement.prospect;

  if (prospect.projet === 'GRAND_PUBLIC') {
    return (
      <GrandPublicProspectDetail
        prospect={prospect}
        offers={chargement.offers}
        canEdit={user.role === 'ADMIN' || user.role === 'COMMERCIAL' || user.role === 'SUPERVISEUR'}
      />
    );
  }

  return <ProspectDetailView prospectId={id} role={user.role} />;
}
