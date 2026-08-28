import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { ProspectCreateForm } from '@/components/prospects/prospect-create-form';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { readString, type RawSearchParams } from '@/lib/search-params';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Ajouter un prospect' };

export default async function NouveauProspectPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La saisie d’un prospect" />;
  }

  const representantId = readString(await searchParams, 'rep');

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.reference,
    queryFn: () => fetchReferenceData(getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProspectCreateForm representantId={representantId} />
    </HydrationBoundary>
  );
}
