import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { GrandPublicProspectDetail } from '@/components/grand-public/prospect-detail';
import { PermissionDenied } from '@/components/permission-denied';
import { QueryErrorState } from '@/components/query-error-state';
import { getServerApiClient } from '@/lib/api/server';
import { fetchProspect } from '@/lib/data/prospects';
import { fetchOffers } from '@/lib/data/reference';
import { guardRoles } from '@/lib/session';
import type { ProspectRow } from '@/lib/types';

export const metadata: Metadata = { title: 'Fiche Grand Public' };

export default async function GrandPublicProspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await guardRoles(['ADMIN', 'DIRECTION', 'SUPERVISEUR', 'COMMERCIAL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La fiche d’un prospect" />;
  }

  const { id } = await params;

  let prospect: ProspectRow;
  let offers;
  try {
    const client = getServerApiClient();
    [prospect, offers] = await Promise.all([fetchProspect(id, client), fetchOffers(client)]);
  } catch (error) {
    unstable_rethrow(error);
    return <QueryErrorState error={error} fallback="Cette fiche n’a pas pu être chargée." />;
  }

  return (
    <GrandPublicProspectDetail
      prospect={prospect}
      offers={offers}
      canEdit={guard.user.role === 'ADMIN' || guard.user.role === 'COMMERCIAL'}
    />
  );
}
