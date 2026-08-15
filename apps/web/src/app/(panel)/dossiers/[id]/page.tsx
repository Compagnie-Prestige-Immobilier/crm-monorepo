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

export const metadata: Metadata = { title: 'Dossier bancaire' };

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le détail d’un dossier bancaire" />;
  }

  const { id } = await params;

  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.bankCase(id),
      queryFn: () => fetchBankCase(id, getServerApiClient()),
    });
  } catch (error) {
    // `unstable_rethrow` d'abord : un `catch` nu avale aussi les erreurs de
    // contrôle de Next (redirection, `notFound()`, bascule en rendu dynamique).
    unstable_rethrow(error);
    // Un dossier introuvable doit se présenter comme une erreur DANS la vue -
    // qui sait la rendre avec un message et un retour : et non comme une
    // exception de rendu serveur qui ferait tomber l'écran entier.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BankCaseDetailView caseId={id} role={guard.user.role} />
    </HydrationBoundary>
  );
}
