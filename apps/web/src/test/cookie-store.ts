import { vi } from 'vitest';

export interface StoredCookie {
  value: string;
  httpOnly?: boolean;
  sameSite?: string;
  secure?: boolean;
  path?: string;
  maxAge?: number;
}

export class FakeCookieStore {
  private readonly jar = new Map<string, StoredCookie>();

  get(name: string): { name: string; value: string } | undefined {
    const entry = this.jar.get(name);
    return entry === undefined ? undefined : { name, value: entry.value };
  }

  set(name: string, value: string, options: Omit<StoredCookie, 'value'> = {}): void {
    this.jar.set(name, { value, ...options });
  }

  raw(name: string): StoredCookie | undefined {
    return this.jar.get(name);
  }

  isCleared(name: string): boolean {
    const entry = this.jar.get(name);
    return entry !== undefined && entry.value === '' && entry.maxAge === 0;
  }

  seed(name: string, value: string): void {
    this.jar.set(name, { value });
  }
}

export function mockCookies(): FakeCookieStore {
  vi.doUnmock('next/headers');
  const store = new FakeCookieStore();
  vi.doMock('next/headers', () => ({
    cookies: () => Promise.resolve(store),
  }));
  return store;
}
