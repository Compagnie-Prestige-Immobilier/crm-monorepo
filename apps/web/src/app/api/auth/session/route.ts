import { NextResponse } from 'next/server';

import { getSession } from '@/lib/session';

export async function GET(): Promise<NextResponse> {
  const user = await getSession();
  if (user === null) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
