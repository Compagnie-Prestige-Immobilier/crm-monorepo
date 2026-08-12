import { NextResponse } from 'next/server';

import { getSession } from '@/lib/session';

/**
 * `GET /api/auth/session`
 *
 * Le client ne peut pas lire le cookie `httpOnly` ; c'est le point d'entrée
 * qui lui dit qui il est. Ne renvoie jamais de jeton.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getSession();
  if (user === null) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
