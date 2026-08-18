import { NextResponse } from 'next/server';

import { clearSessionCookies, getAnonymousApiClient, getRefreshToken } from '@/lib/api/server';
import { revokeSession } from '@/lib/data/auth';

export async function POST(): Promise<NextResponse> {
  const refreshToken = await getRefreshToken();
  if (refreshToken !== null && refreshToken !== '') {
    try {
      await revokeSession(refreshToken, getAnonymousApiClient());
    } catch {}
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
