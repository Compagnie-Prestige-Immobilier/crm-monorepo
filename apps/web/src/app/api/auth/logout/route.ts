import { NextResponse } from 'next/server';

import { clearSessionCookies, getAnonymousApiClient, getRefreshToken } from '@/lib/api/server';
import { revokeSession } from '@/lib/data/auth';

/**
 * `POST /api/auth/logout`
 *
 * Les cookies sont effacés dans tous les cas, même si la révocation côté
 * backend échoue : un utilisateur qui clique « Déconnexion » doit être
 * déconnecté de ce navigateur, quoi qu'il arrive sur le réseau.
 */
export async function POST(): Promise<NextResponse> {
  const refreshToken = await getRefreshToken();
  if (refreshToken !== null && refreshToken !== '') {
    try {
      // `POST /auth/logout` révoque toute la FAMILLE de jetons, pas seulement
      // celui-ci : les rotations antérieures encore en vol meurent avec.
      await revokeSession(refreshToken, getAnonymousApiClient());
    } catch {
      // Révocation serveur en échec : le jeton expirera de lui-même.
    }
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
