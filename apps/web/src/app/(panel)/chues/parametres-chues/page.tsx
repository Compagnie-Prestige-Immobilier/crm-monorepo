import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { ParametresChuesCard } from '@/components/settings/parametres-chues-card';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Paramètres CHUES' };

/**
 * EB-29. Distincte de `/admin/parametres`, qui porte la purge et l'export
 * intégral : la supervision et la direction règlent les deux textes envoyés aux
 * prospects, et n'ont rien à faire devant une commande de suppression.
 */
export default async function ParametresChuesPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied')
    return <PermissionDenied role={guard.user.role} what="Les paramètres CHUES" />;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <ParametresChuesCard peutToutRegler={guard.user.role === 'ADMIN'} />
    </div>
  );
}
