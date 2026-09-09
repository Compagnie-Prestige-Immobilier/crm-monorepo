import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CommerciauxView } from '@/components/commerciaux/commerciaux-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchUsers } from '@/lib/data/users';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';
import { parseUserFilters, type RawSearchParams } from '@/lib/user-filters';

export const metadata: Metadata = { title: 'Téléconseillers' };

export default async function CommerciauxPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des comptes" />;
  }

  const filters = parseUserFilters(await searchParams);
  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.commerciaux(filters),
      queryFn: () => fetchUsers(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommerciauxView currentUserId={guard.user.id} />
    </HydrationBoundary>
  );
}
