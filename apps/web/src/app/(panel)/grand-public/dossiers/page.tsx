import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankCasesView } from '@/components/bank/bank-cases-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Dossiers bancaires Grand Public' };

export default async function DossiersGrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des dossiers bancaires" />;
  }

  return <BankCasesView projet="GRAND_PUBLIC" />;
}
