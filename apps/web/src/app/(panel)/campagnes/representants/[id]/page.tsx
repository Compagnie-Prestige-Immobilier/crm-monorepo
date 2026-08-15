import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { RepCampaignDetailView } from '@/components/phase2/rep-campaign-detail-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchRepCampaign } from '@/lib/data/rep-campaigns';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagne d’appels représentants' };

export default async function CampagneRepresentantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied
        role={guard.user.role}
        what="Le détail d’une campagne d’appels représentants"
      />
    );
  }

  const { id } = await params;

  const queryClient = getQueryClient();
  // Comme sur le détail des campagnes prospects : une campagne introuvable
  // doit se présenter comme une erreur DANS la vue, avec un message et un
  // retour, et non comme une exception de rendu serveur qui emporte l'écran.
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.repCampaign(id),
      queryFn: () => fetchRepCampaign(id, getServerApiClient()),
    });
  } catch (error) {
    // `unstable_rethrow` d'abord : un `catch` nu avale aussi les erreurs de
    // contrôle de Next (redirection, `notFound()`, bascule en rendu dynamique).
    unstable_rethrow(error);
    /* La vue rejouera la requête côté client et affichera l'état d'erreur. */
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepCampaignDetailView campaignId={id} />
    </HydrationBoundary>
  );
}
