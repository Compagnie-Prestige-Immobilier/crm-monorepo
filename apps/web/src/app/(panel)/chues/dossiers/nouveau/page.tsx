import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankCaseForm } from '@/components/bank/bank-case-form';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Nouveau dossier' };

export default async function NouveauDossierPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="L’ouverture d’un dossier bancaire" />;
  }

  return <BankCaseForm />;
}
