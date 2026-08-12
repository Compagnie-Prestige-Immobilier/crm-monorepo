import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { CampaignsView } from '@/components/phase2/campaigns-view';
import { getServerApiClient } from '@/lib/api/server';
import { DEFAULT_CAMPAIGN_FILTERS, fetchCampaigns } from '@/lib/data/phase2';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagnes' };

export default async function CampagnesPage() {
  // Les campagnes montrent la répartition du travail entre commerciaux :
  // l'API les réserve à l'ADMIN, et l'écran coupe en amont plutôt que de se
  // construire puis d'échouer en 403 sur chaque requête.
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des campagnes d’appels" />;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.campaigns(DEFAULT_CAMPAIGN_FILTERS),
    queryFn: () => fetchCampaigns(DEFAULT_CAMPAIGN_FILTERS, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignsView />
    </HydrationBoundary>
  );
}
