import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { CampaignsView } from '@/components/phase2/campaigns-view';
import { getServerApiClient } from '@/lib/api/server';
import { parseCampaignFilters, type RawSearchParams } from '@/lib/campaign-filters';
import { fetchCampaigns } from '@/lib/data/phase2';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagnes' };

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Les campagnes montrent la répartition du travail entre commerciaux :
  // l'API les réserve à l'ADMIN, et l'écran coupe en amont plutôt que de se
  // construire puis d'échouer en 403 sur chaque requête.
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des campagnes d’appels" />;
  }

  // Filtres lus dans l'URL côté serveur : un lien partagé s'ouvre directement
  // sur la bonne liste, sans état vide intermédiaire.
  const filters = parseCampaignFilters(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.campaigns(filters),
    queryFn: () => fetchCampaigns(filters, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignsView />
    </HydrationBoundary>
  );
}
