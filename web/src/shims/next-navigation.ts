import {
  notFound as routeurNotFound,
  redirect as routeurRedirect,
  useLocation,
  useMatches,
  useNavigate,
  useRouter as useRouteur,
} from '@tanstack/react-router';
import { useMemo } from 'react';

export function usePathname(): string {
  return useLocation({ select: (l) => l.pathname });
}

export function useSearchParams(): URLSearchParams {
  const searchStr = useLocation({ select: (l) => l.searchStr });
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export function useParams<
  T extends Record<string, string | string[]> = Record<string, string>,
>(): T {
  const matches = useMatches();
  return (matches.at(-1)?.params ?? {}) as T;
}

interface OptionsNavigation {
  scroll?: boolean;
}

export function useRouter() {
  const navigate = useNavigate();
  const routeur = useRouteur();
  return useMemo(
    () => ({
      push: (href: string, _options?: OptionsNavigation): void => void navigate({ href }),
      replace: (href: string, _options?: OptionsNavigation): void =>
        void navigate({ href, replace: true }),
      back: (): void => routeur.history.back(),
      forward: (): void => routeur.history.forward(),
      refresh: (): void => void routeur.invalidate(),
      prefetch: (_href: string): void => undefined,
    }),
    [navigate, routeur],
  );
}

export function redirect(href: string): never {
  throw routeurRedirect({ href });
}

export function notFound(): never {
  throw routeurNotFound();
}

export function unstable_rethrow(_error: unknown): void {
  return undefined;
}
