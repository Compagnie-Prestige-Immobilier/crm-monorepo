import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BankExportView } from '@/components/bank/bank-export-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Export des dossiers' };

export default async function ExportDossiersPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="L’export des dossiers bancaires" />;
  }

  return <BankExportView />;
}
