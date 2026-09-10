import { Link as RouterLink } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'a'>, 'href'> & {
  href: string;
  prefetch?: boolean | null | undefined;
  replace?: boolean | undefined;
  scroll?: boolean | undefined;
};

/** `href` complet (chemin, critères, ancre) vers les trois champs du routeur. */
export function decomposer(href: string): {
  to: string;
  search: Record<string, string> | undefined;
  hash: string | undefined;
} {
  const url = new URL(href, 'http://x');
  const search = Object.fromEntries(url.searchParams);
  return {
    to: url.pathname,
    search: url.search === '' ? undefined : search,
    hash: url.hash === '' ? undefined : url.hash.slice(1),
  };
}

export default function Link({
  href,
  prefetch: _prefetch,
  scroll: _scroll,
  replace,
  ...rest
}: Props) {
  const { to, search, hash } = decomposer(href);
  return (
    <RouterLink
      to={to}
      {...(search === undefined ? {} : { search })}
      {...(hash === undefined ? {} : { hash })}
      {...(replace === undefined ? {} : { replace })}
      {...(rest as Record<string, never>)}
    />
  );
}
