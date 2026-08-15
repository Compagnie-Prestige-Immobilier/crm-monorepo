import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { CampaignDetailView } from '@/components/phase2/campaign-detail-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchCampaign } from '@/lib/data/phase2';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagne' };

export default async function CampagnePage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le détail d’une campagne" />;
  }

  const { id } = await params;

  const queryClient = getQueryClient();
  // Le préchargement n'est PAS `await`é en dehors d'un try : une campagne
  // introuvable doit se présenter comme une erreur dans la vue : qui sait la
  // rendre avec un message et un retour : et non comme une exception de rendu
  // serveur qui ferait tomber l'écran entier.
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.campaign(id),
      queryFn: () => fetchCampaign(id, getServerApiClient()),
    });
  } catch (error) {
    // `unstable_rethrow` d'abord : un `catch` nu avale aussi les erreurs de
    // contrôle de Next (redirection, `notFound()`, bascule en rendu dynamique).
    unstable_rethrow(error);
    /* La vue rejouera la requête côté client et affichera l'état d'erreur. */
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignDetailView campaignId={id} />
    </HydrationBoundary>
  );
}
