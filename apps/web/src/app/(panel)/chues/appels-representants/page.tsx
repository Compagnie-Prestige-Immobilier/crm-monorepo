import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RepScript } from '@/components/console/rep-script';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchRepScriptQueue, repScriptKeys } from '@/lib/data/console';
import { getQueryClient } from '@/lib/query-client';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Qualifier un représentant' };

/** Étape 1 du projet CHUES : obtenir d'un enseignant les contacts de ses collègues. */
export default async function AppelsRepresentantsPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les appels aux représentants" />;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: repScriptKeys.queue,
    queryFn: () => fetchRepScriptQueue(getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepScript />
    </HydrationBoundary>
  );
}
