import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { ReferentielsView } from '@/components/referentiels/referentiels-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchBanques, fetchDepartements, fetchSyndicats } from '@/lib/data/reference';
import { fetchReferentielUsage } from '@/lib/data/referentiels';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Référentiels' };

export default async function ReferentielsPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des référentiels" />;
  }

  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.banques,
      queryFn: () => fetchBanques(client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.syndicats,
      queryFn: () => fetchSyndicats(client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.departements,
      queryFn: () => fetchDepartements(client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.referentielUsage,
      queryFn: () => fetchReferentielUsage(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReferentielsView />
    </HydrationBoundary>
  );
}
