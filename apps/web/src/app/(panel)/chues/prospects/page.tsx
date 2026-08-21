import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProspectsView } from '@/components/prospects/prospects-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchProspects } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { parseProspectFilters, type RawSearchParams } from '@/lib/filters';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { getSession, guardRoles } from '@/lib/session';
import { readsOnly } from '@/lib/types';

export const metadata: Metadata = { title: 'Prospects' };

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des prospects" />;
  }

  const filters = parseProspectFilters(await searchParams);
  const session = await getSession();
  const client = getServerApiClient();

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.prospects(filters),
      queryFn: () => fetchProspects(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* La fusion et la réaffectation sont des opérations d'administration :
          l'API les refuse à un COMMERCIAL, l'écran ne les propose donc pas.
          Le SUPERVISEUR, lui, n'écrit rien du tout. */}
      <ProspectsView
        canAdminister={session?.role === 'ADMIN'}
        readOnly={readsOnly(session?.role)}
      />
    </HydrationBoundary>
  );
}
