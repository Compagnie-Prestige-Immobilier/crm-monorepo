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

export const metadata: Metadata = { title: 'Campagne d’appels prospects' };

export default async function CampagnePage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied role={guard.user.role} what="Le détail d’une campagne d’appels prospects" />
    );
  }

  const { id } = await params;

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.campaign(id),
      queryFn: () => fetchCampaign(id, getServerApiClient()),
    });
  } catch (error) {
    unstable_rethrow(error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CampaignDetailView campaignId={id} />
    </HydrationBoundary>
  );
}
