import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { currentPathname, currentSearchParams, resetRouterMock, routerMock } from './router-mock';

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => currentPathname(),
  useSearchParams: () => currentSearchParams(),
}));

beforeEach(() => {
  resetRouterMock();
});

afterEach(() => {
  cleanup();
});

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
