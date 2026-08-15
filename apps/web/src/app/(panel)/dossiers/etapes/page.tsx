import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankStagesView } from '@/components/bank/bank-stages-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Étapes bancaires' };

/**
 * Configuration du flux : ADMIN seulement.
 *
 * Un agent BANQUE_FINANCE LIT les étapes (elles teintent ses pastilles) mais ne
 * les modifie pas : réordonner le flux change le parcours de tous les dossiers
 * en cours, y compris ceux des autres agents.
 */
export default async function EtapesBancairesPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La configuration du flux bancaire" />;
  }

  return <BankStagesView />;
}
