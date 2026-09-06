import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { LotExportDetailView } from '@/components/lots-export/lot-export-detail-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchLotExport } from '@/lib/data/lots-export';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagne' };

export default async function LotExportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') redirect('/chues');
  const { id } = await params;
  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.lotsExportDetail(id),
      queryFn: () => fetchLotExport(id, getServerApiClient()),
    });
  } catch {
    notFound();
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LotExportDetailView
        id={id}
        peutRegler={guard.user.role === 'ADMIN' || guard.user.role === 'SUPERVISEUR'}
      />
    </HydrationBoundary>
  );
}
