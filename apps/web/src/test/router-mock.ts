import { vi } from 'vitest';

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

let pathname = '/';
let searchParams = new URLSearchParams();

export const currentPathname = (): string => pathname;
export const currentSearchParams = (): URLSearchParams => searchParams;

export function setUrl(url: string): void {
  const [path, query = ''] = url.split('?');
  pathname = path ?? '/';
  searchParams = new URLSearchParams(query);
}

export function resetRouterMock(): void {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.refresh.mockClear();
  routerMock.back.mockClear();
  routerMock.forward.mockClear();
  routerMock.prefetch.mockClear();
  setUrl('/');
}
