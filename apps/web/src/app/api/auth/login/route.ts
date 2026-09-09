import { ApiError } from '@crm/api-client/query';
import { NextResponse } from 'next/server';

import { ApiConfigurationError, configErrorBody } from '@/lib/api/config';
import { getAnonymousApiClient, setSessionCookies } from '@/lib/api/server';
import { authenticate } from '@/lib/data/auth';
import { loginSchema } from '@/lib/schemas';

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 400 });
  }

  let result;
  try {
    result = await authenticate(
      parsed.data.identifier,
      parsed.data.password,
      getAnonymousApiClient(),
    );
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    if (error instanceof ApiError && error.status === 429) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Patientez une minute avant de réessayer.' },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: 'Le serveur CPI est injoignable. Réessayez dans un instant.' },
      { status: 502 },
    );
  }

  if (result === null) {
    return NextResponse.json(
      { error: 'Identifiants incorrects ou compte non autorisé.' },
      { status: 401 },
    );
  }

  await setSessionCookies(result.tokens);
  return NextResponse.json({ user: result.user });
}
