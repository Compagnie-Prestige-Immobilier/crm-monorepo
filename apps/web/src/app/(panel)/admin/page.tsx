import { redirect } from 'next/navigation';

import { coqueHomePath } from '@/components/layout/nav-items';
import { getSession } from '@/lib/session';

/** La racine d'une coque n'a pas d'écran à elle : elle mène au premier du rôle. */
export default async function CoqueRoot() {
  const user = await getSession();
  redirect(user === null ? '/connexion' : coqueHomePath(user.role, 'admin'));
}
