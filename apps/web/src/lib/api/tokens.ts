import { API_PREFIX, REFRESH_SKEW_SECONDS } from '@/lib/api/config';

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const inFlightRotations = new Map<string, Promise<RefreshRotationResult>>();

export type RefreshRotationResult =
  { ok: true; tokens: RotatedTokens } | { ok: false; reason: 'invalid' | 'unavailable' };

function readJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (payload === undefined || payload === '') return null;
  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    const claims: unknown = JSON.parse(json);
    if (typeof claims !== 'object' || claims === null) return null;
    const { exp } = claims as { exp?: unknown };
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export function isAccessTokenStale(token: string | null | undefined, now = Date.now()): boolean {
  if (token === null || token === undefined || token === '') return true;
  const exp = readJwtExpiry(token);
  if (exp === null) return true;
  return exp - REFRESH_SKEW_SECONDS <= Math.floor(now / 1000);
}

export async function rotateRefreshTokenDetailed(
  origin: string,
  refreshToken: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<RefreshRotationResult> {
  if (refreshToken === '') return { ok: false, reason: 'invalid' };

  const running = inFlightRotations.get(refreshToken);
  if (running !== undefined) return running;

  const rotation = rotateRefreshTokenOnce(origin, refreshToken, fetchImpl);
  inFlightRotations.set(refreshToken, rotation);
  try {
    return await rotation;
  } finally {
    inFlightRotations.delete(refreshToken);
  }
}

function refusalReason(status: number): 'invalid' | 'unavailable' {
  if (status === 429) return 'unavailable';
  return status >= 500 ? 'unavailable' : 'invalid';
}

async function rotateRefreshTokenOnce(
  origin: string,
  refreshToken: string,
  fetchImpl: typeof globalThis.fetch,
): Promise<RefreshRotationResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${origin}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (!response.ok) return { ok: false, reason: refusalReason(response.status) };

  try {
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) {
      return { ok: false, reason: 'unavailable' };
    }
    const { accessToken, refreshToken: next, expiresIn } = body as Record<string, unknown>;
    if (typeof accessToken !== 'string' || typeof next !== 'string') {
      return { ok: false, reason: 'unavailable' };
    }
    return {
      ok: true,
      tokens: {
        accessToken,
        refreshToken: next,
        expiresIn: typeof expiresIn === 'number' ? expiresIn : 900,
      },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
