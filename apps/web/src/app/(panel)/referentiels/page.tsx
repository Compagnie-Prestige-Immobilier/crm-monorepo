import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { ShieldAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { ReferentielsView } from '@/components/referentiels/referentiels-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchBanques, fetchDepartements, fetchSyndicats } from '@/lib/data/reference';
import { fetchReferentielUsage } from '@/lib/data/referentiels';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { getAdminSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Référentiels' };

export default async function ReferentielsPage() {
  // Les écritures de référentiel sont réservées à l'ADMIN côté API. Ouvrir
  // l'écran en lecture à un COMMERCIAL lui montrerait des boutons qui échouent.
  const session = await getAdminSession();
  if (session === null) {
    return (
      <EmptyState
        icon={ShieldAlertIcon}
        title="Accès réservé aux administrateurs"
        description="Les référentiels descendent en lecture seule vers l’application mobile : leur modification est réservée aux administrateurs du siège."
      />
    );
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
