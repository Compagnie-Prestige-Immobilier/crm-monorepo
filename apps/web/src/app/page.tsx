import { redirect } from 'next/navigation';

import { homePathForRole } from '@/components/layout/nav-items';
import { getSession } from '@/lib/session';

export default async function RootPage() {
  const session = await getSession();
  redirect(session === null ? '/connexion' : homePathForRole(session.role));
}
