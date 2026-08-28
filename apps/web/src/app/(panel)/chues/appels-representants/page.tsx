import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EtapeBanner } from '@/components/chues/etape-banner';
import { RepScript } from '@/components/console/rep-script';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchRepScriptQueue, repScriptKeys } from '@/lib/data/console';
import { getQueryClient } from '@/lib/query-client';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Appeler les représentants' };

/** Étape 1 du projet CHUES : obtenir d'un enseignant les contacts de ses collègues. */
export default async function AppelsRepresentantsPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL']);
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
      <div className="flex flex-col gap-5">
        <EtapeBanner n={1} />
        <RepScript />
      </div>
    </HydrationBoundary>
  );
}
