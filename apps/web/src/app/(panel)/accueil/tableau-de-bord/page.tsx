import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { VisitesDashboard } from '@/components/accueil/dashboard-visites';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord des visites' };

export default async function TableauDeBordVisitesPage() {
  const guard = await guardRoles(['ADMIN', 'DIRECTION', 'ACCUEIL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le tableau de bord des visites" />;
  }

  return <VisitesDashboard />;
}
