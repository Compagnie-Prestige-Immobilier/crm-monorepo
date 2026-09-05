import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LotsExportView } from '@/components/lots-export/lots-export-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchLotsExport } from '@/lib/data/lots-export';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagnes' };

export default async function LotsExportPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') redirect('/chues');

  // La même requête que l'état initial de la vue, sinon la clé diffère et
  // l'écran repart en chargement après l'hydratation.
  const requete = { page: 1, projet: 'CHUES' } as const;
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.lotsExport(requete),
    queryFn: () => fetchLotsExport(requete, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LotsExportView         canCreate={guard.user.role === 'ADMIN' || guard.user.role === 'SUPERVISEUR'}
        canDelete={guard.user.role === 'ADMIN'}
        projet="CHUES" />
    </HydrationBoundary>
  );
}
