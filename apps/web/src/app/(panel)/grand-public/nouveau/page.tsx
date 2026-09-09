import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { GrandPublicProspectForm } from '@/components/grand-public/prospect-form';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchCanauxProvenance, grandPublicKeys } from '@/lib/data/grand-public';
import { fetchReferenceData } from '@/lib/data/reference';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Nouveau prospect Grand Public' };

export default async function NouveauGrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La saisie d’un prospect Grand Public" />;
  }

  const client = getServerApiClient();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
    queryClient.prefetchQuery({
      queryKey: grandPublicKeys.canaux,
      queryFn: () => fetchCanauxProvenance(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GrandPublicProspectForm />
    </HydrationBoundary>
  );
}
