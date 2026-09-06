import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { EnrolementView } from '@/components/enrolement/enrolement-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Plateformes d’enrôlement' };

export default async function EnrolementPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des plateformes d’enrôlement" />;
  }

  // Aucun préchargement serveur : le panneau tire ses trois requêtes par projet
  // et l'onglet n'est connu qu'au rendu client.
  return <EnrolementView />;
}
