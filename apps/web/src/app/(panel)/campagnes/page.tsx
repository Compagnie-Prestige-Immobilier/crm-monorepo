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

export const metadata: Metadata = { title: 'Campagnes d’appels prospects' };

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied role={guard.user.role} what="Le suivi des campagnes d’appels prospects" />
    );
  }

  const filters = parseCampaignFilters(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.campaigns(filters),
    queryFn: () => fetchCampaigns(filters, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignsView canManage={guard.user.role === 'ADMIN'} />
    </HydrationBoundary>
  );
}
