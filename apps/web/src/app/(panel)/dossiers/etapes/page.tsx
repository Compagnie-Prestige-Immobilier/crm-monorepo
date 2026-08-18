import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankStagesView } from '@/components/bank/bank-stages-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Étapes bancaires' };

export default async function EtapesBancairesPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La configuration du flux bancaire" />;
  }

  return <BankStagesView />;
}
