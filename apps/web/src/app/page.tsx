import { redirect } from 'next/navigation';

import { homePathForRole } from '@/components/layout/nav-items';
import { getSession } from '@/lib/session';

/**
 * La racine n'affiche rien : elle aiguille : et elle aiguille SELON LE RÔLE.
 * Un administrateur attend son tableau de bord ; un agent Banque & Finance
 * attend ses dossiers, et non un écran auquel l'API lui répondrait 403.
 */
export default async function RootPage() {
  const session = await getSession();
  redirect(session === null ? '/connexion' : homePathForRole(session.role));
}
