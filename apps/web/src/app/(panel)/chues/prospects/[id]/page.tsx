import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { ProspectDetailView } from '@/components/prospects/prospect-detail-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchProspect } from '@/lib/data/prospects';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Prospect' };

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La fiche d’un prospect" />;
  }

  const { id } = await params;
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.prospect(id),
      queryFn: () => fetchProspect(id, getServerApiClient()),
    });
  } catch (error) {
    unstable_rethrow(error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProspectDetailView prospectId={id} role={guard.user.role} />
    </HydrationBoundary>
  );
}
