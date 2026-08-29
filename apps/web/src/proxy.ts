import { NextResponse, type NextProxy } from 'next/server';

import {
  ACCESS_COOKIE,
  ApiConfigurationError,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  serverApiOrigin,
} from '@/lib/api/config';
import { isAccessTokenStale, rotateRefreshTokenDetailed } from '@/lib/api/tokens';

const proxy: NextProxy = async (request) => {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refresh === undefined || refresh === '') return NextResponse.next();
  if (!isAccessTokenStale(access)) return NextResponse.next();

  let origin: string;
  try {
    origin = serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) return NextResponse.next();
    throw error;
  }

  const rotation = await rotateRefreshTokenDetailed(origin, refresh);

  if (!rotation.ok && rotation.reason === 'unavailable') {
    return NextResponse.next();
  }

  if (!rotation.ok) {
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  request.cookies.set(ACCESS_COOKIE, rotation.tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, rotation.tokens.refreshToken);

  const response = NextResponse.next({ request });
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  } as const;

  response.cookies.set(ACCESS_COOKIE, rotation.tokens.accessToken, {
    ...options,
    maxAge: rotation.tokens.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, rotation.tokens.refreshToken, {
    ...options,
    maxAge: REFRESH_TTL_SECONDS,
  });

  return response;
};

export default proxy;

export const config = {
  // api/app-updates relaie des APK de plus de 10 Mo : le proxy Next tronque tout corps au-delà.
  matcher: ['/((?!_next/static|_next/image|api/auth|api/app-updates|brand|favicon.ico).*)'],
};
