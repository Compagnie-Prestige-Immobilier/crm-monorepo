import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { ChampsConversionView } from '@/components/settings/champs-conversion-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Champs de la conversion' };

export default async function ChampsConversionPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied role={guard.user.role} what="Les champs du formulaire de conversion" />
    );
  }

  return <ChampsConversionView />;
}
