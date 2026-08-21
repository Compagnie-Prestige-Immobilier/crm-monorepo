import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ClientRequestsView } from '@/components/client-requests/client-requests-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { parseClientRequestFilters, type RawSearchParams } from '@/lib/client-request-filters';
import { fetchClientRequests } from '@/lib/data/client-requests';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Demandes clients' };

export default async function DemandesClientsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des demandes de création" />;
  }

  const filters = parseClientRequestFilters(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.clientRequests(filters),
    queryFn: () => fetchClientRequests(filters, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientRequestsView role={guard.user.role} />
    </HydrationBoundary>
  );
}
