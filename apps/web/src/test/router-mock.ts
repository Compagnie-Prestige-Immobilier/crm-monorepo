import { vi } from 'vitest';

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export const historyMock = {
  pushState: vi.fn<History['pushState']>(),
  replaceState: vi.fn<History['replaceState']>(),
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
  historyMock.pushState.mockClear();
  historyMock.replaceState.mockClear();
  // restoreMocks détache les espions après chaque test : on les repose ici.
  vi.spyOn(window.history, 'pushState').mockImplementation(historyMock.pushState);
  vi.spyOn(window.history, 'replaceState').mockImplementation(historyMock.replaceState);
  setUrl('/');
}
