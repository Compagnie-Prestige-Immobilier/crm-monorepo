import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord bancaire Grand Public' };

export default async function BanqueGrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le tableau de bord bancaire" />;
  }

  return <BankDashboardView projet="GRAND_PUBLIC" />;
}
