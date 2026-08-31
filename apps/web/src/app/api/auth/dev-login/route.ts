import { ApiError } from '@crm/api-client/query';
import { NextResponse } from 'next/server';

import { ApiConfigurationError, configErrorBody } from '@/lib/api/config';
import { getAnonymousApiClient, setSessionCookies } from '@/lib/api/server';
import { authenticate, PANEL_ROLES } from '@/lib/data/auth';
import type { Role } from '@/lib/types';

const FIXTURE_IDENTIFIERS: Record<Exclude<Role, 'ADMIN'>, string> = {
  COMMERCIAL: 'fixture.awa@cpi.sn',
  BANQUE_FINANCE: 'fixture.banque@cpi.sn',
  SUPERVISEUR: 'fixture.superviseur@cpi.sn',
  DIRECTION: 'fixture.direction@cpi.sn',
  ACCUEIL: 'fixture.accueil@cpi.sn',
};

function accountForRole(role: Role): { identifier: string; password: string } {
  if (role === 'ADMIN') {
    const identifier = process.env.SEED_ADMIN_EMAIL ?? 'admin@cpi.sn';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMoiEnProd2026';
    return { identifier, password };
  }

  const identifier = FIXTURE_IDENTIFIERS[role];
  const password = process.env.SEED_FIXTURE_PASSWORD ?? 'ChangeMoi123456';
  return { identifier, password };
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Route indisponible.' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  if (typeof body?.role !== 'string' || !PANEL_ROLES.includes(body.role as Role)) {
    return NextResponse.json({ error: 'Rôle dev invalide.' }, { status: 400 });
  }

  const role = body.role as Role;
  try {
    const account = accountForRole(role);
    const result = await authenticate(
      account.identifier,
      account.password,
      getAnonymousApiClient(),
    );
    if (result === null) {
      return NextResponse.json({ error: 'Compte dev absent. Lancez le seed.' }, { status: 503 });
    }

    await setSessionCookies(result.tokens);
    return NextResponse.json({ user: result.user });
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    if (error instanceof ApiError && error.status === 429) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans un instant.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }
}
