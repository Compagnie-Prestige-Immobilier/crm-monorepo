import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { RepresentantsImportView } from '@/components/representants/representants-import-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Import de représentants' };

/**
 * Import de masse depuis un classeur Excel.
 *
 * ADMIN seul, comme le reste de l'écran Représentants : l'API le ferme à un
 * BANQUE_FINANCE, et un écran qui se monte pour finir en 403 est un défaut de
 * conception, pas une protection.
 *
 * Aucun préchargement : la page n'a rien à afficher tant qu'aucun fichier n'a
 * été déposé, et le rapport ne peut naître que d'un envoi.
 */
export default async function RepresentantsImportPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="L’import de représentants" />;
  }

  return <RepresentantsImportView />;
}
