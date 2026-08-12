import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord bancaire' };

/**
 * Tableau de bord de Banque & Finance.
 *
 * Pas de préchargement serveur ici, à la différence des autres écrans : les
 * agrégats dépendent des filtres d'URL ET du fuseau, et le graphique est de
 * toute façon monté côté client (Chart.js peint dans un `<canvas>`). Précharger
 * ferait une requête de plus pour une seule frame gagnée.
 */
export default async function BanqueDashboardPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le tableau de bord bancaire" />;
  }

  return <BankDashboardView />;
}
