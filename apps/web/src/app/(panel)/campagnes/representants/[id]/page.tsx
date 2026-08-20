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
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
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
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.repCampaign(id),
      queryFn: () => fetchRepCampaign(id, getServerApiClient()),
    });
  } catch (error) {
    unstable_rethrow(error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepCampaignDetailView campaignId={id} canManage={guard.user.role === 'ADMIN'} />
    </HydrationBoundary>
  );
}
