import 'server-only';

import { ApiError } from '@crm/api-client/query';
import { unstable_rethrow } from 'next/navigation';

import { SessionExpiredError, getServerApiClient } from '@/lib/api/server';
import { fetchSessionUser } from '@/lib/data/auth';
import type { SessionUser } from '@/lib/types';

export type SessionResult =
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous' }
  | { status: 'unavailable'; error: unknown };

export async function readSession(): Promise<SessionResult> {
  try {
    return { status: 'authenticated', user: await fetchSessionUser(getServerApiClient()) };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { status: 'anonymous' };
    }
    if (error instanceof SessionExpiredError) return { status: 'anonymous' };
    return { status: 'unavailable', error };
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const result = await readSession();
  return result.status === 'authenticated' ? result.user : null;
}

export type RoleGuard =
  | { status: 'anonymous' }
  | { status: 'denied'; user: SessionUser }
  | { status: 'allowed'; user: SessionUser };

export async function guardRoles(allowed: readonly SessionUser['role'][]): Promise<RoleGuard> {
  const session = await getSession();
  if (session === null) return { status: 'anonymous' };
  return allowed.includes(session.role)
    ? { status: 'allowed', user: session }
    : { status: 'denied', user: session };
}
