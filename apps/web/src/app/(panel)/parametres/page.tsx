import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { DemoModeCard } from '@/components/settings/demo-mode-card';
import { getServerApiClient } from '@/lib/api/server';
import { fetchDemoStatus } from '@/lib/data/demo';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Paramètres' };

export default async function ParametresPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les paramètres de la plateforme" />;
  }

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.demoStatus,
      queryFn: () => fetchDemoStatus(getServerApiClient()),
    });
  } catch {
    // La carte rejouera la requête et affichera son état d'erreur.
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <p className="text-[0.9375rem] text-muted-foreground">
        Réglages de la plateforme. Ces actions portent sur l’ensemble des données visibles par tous
        les utilisateurs.
      </p>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <DemoModeCard />
      </HydrationBoundary>
    </div>
  );
}
