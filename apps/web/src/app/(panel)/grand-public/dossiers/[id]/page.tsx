import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { BankCaseDetailView } from '@/components/bank/bank-case-detail-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchBankCase } from '@/lib/data/bank-cases';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Dossier bancaire Grand Public' };

export default async function DossierGrandPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le détail d’un dossier bancaire" />;
  }

  const { id } = await params;

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.bankCase(id, 'GRAND_PUBLIC'),
      queryFn: () => fetchBankCase(id, 'GRAND_PUBLIC', getServerApiClient()),
    });
  } catch (error) {
    unstable_rethrow(error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BankCaseDetailView caseId={id} role={guard.user.role} projet="GRAND_PUBLIC" />
    </HydrationBoundary>
  );
}
