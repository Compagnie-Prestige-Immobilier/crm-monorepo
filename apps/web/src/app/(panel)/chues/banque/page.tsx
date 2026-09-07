import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { PermissionDenied } from '@/components/permission-denied';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord bancaire' };

export default async function BanqueDashboardPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le tableau de bord bancaire" />;
  }

  if (guard.user.role !== 'ADMIN') return <BankDashboardView projet="CHUES" />;

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" role={guard.user.role} />
      <BankDashboardView projet="CHUES" />
    </div>
  );
}
