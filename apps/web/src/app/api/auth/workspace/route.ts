import { unwrap } from '@crm/api-client/query';
import { NextResponse } from 'next/server';

import { getServerApiClient, setSessionCookies, toAuthTokens } from '@/lib/api/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { workspace?: unknown } | null;
  if (body?.workspace !== 'public' && body?.workspace !== 'demo') {
    return NextResponse.json({ error: 'Espace invalide.' }, { status: 400 });
  }

  const result = unwrap(
    await getServerApiClient().POST('/api/v1/auth/workspace', {
      params: { header: { 'user-agent': 'cpi-go-admin-panel' } },
      body: { workspace: body.workspace },
    }),
  );
  await setSessionCookies(toAuthTokens(result));
  return NextResponse.json({ user: result.user });
}
