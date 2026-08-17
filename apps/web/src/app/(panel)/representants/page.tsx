import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RepresentantsView } from '@/components/representants/representants-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchRepresentants } from '@/lib/data/representants';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { parseRepresentantFilters, type RawSearchParams } from '@/lib/representant-filters';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Représentants' };

export default async function RepresentantsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des représentants" />;
  }

  const filters = parseRepresentantFilters(await searchParams);
  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.representants(filters),
      queryFn: () => fetchRepresentants(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepresentantsView canAdminister={guard.user.role === 'ADMIN'} />
    </HydrationBoundary>
  );
}
