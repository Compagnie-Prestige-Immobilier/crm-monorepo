import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GrandPublicProspectsView } from '@/components/grand-public/prospects-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import {
  fetchCanauxProvenance,
  fetchGrandPublicProspects,
  grandPublicKeys,
  parseGrandPublicFilters,
} from '@/lib/data/grand-public';
import { getQueryClient } from '@/lib/query-client';
import type { RawSearchParams } from '@/lib/search-params';
import { guardRoles } from '@/lib/session';
import { canExportProspects, readsOnly } from '@/lib/types';

export const metadata: Metadata = { title: 'Prospects Grand Public' };

export default async function GrandPublicPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles([
    'ADMIN',
    'DIRECTION',
    'SUPERVISEUR',
    'COMMERCIAL',
    'CHARGE_CLIENTELE',
  ]);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le projet Grand Public" />;
  }

  const filters = parseGrandPublicFilters(await searchParams);
  const client = getServerApiClient();

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: grandPublicKeys.prospects(filters),
      queryFn: () => fetchGrandPublicProspects(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: grandPublicKeys.canaux,
      queryFn: () => fetchCanauxProvenance(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GrandPublicProspectsView
        canCreate={!readsOnly(guard.user.role)}
        canExport={canExportProspects(guard.user.role)}
        campaignScoped={guard.user.role === 'COMMERCIAL'}
      />
    </HydrationBoundary>
  );
}
