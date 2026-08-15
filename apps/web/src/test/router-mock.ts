import { vi } from 'vitest';

/**
 * Le routeur de Next, sous test.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Il n'est pas montable : il faut donc le remplacer, pas le contourner.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `useRouter()` du routeur d'application lit un contexte posé par le serveur de
 * Next. Hors de ce serveur, il lève « invariant expected app router to be
 * mounted » avant même le premier rendu. Presque tout écran du panel l'appelle,
 * directement ou par ses filtres d'URL : sans ce doublet, aucun ne serait
 * éprouvable.
 *
 * Les fonctions sont des ESPIONS et non des inertes : « la navigation part-elle,
 * et vers où » est précisément ce que plusieurs correctifs promettent.
 *
 * `restoreMocks: true` remet les implémentations, pas l'historique d'appels ni
 * l'URL : `resetRouterMock()` s'en charge, appelé avant chaque test par
 * `setup-dom.ts`.
 */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

/** Chemin et paramètres courants, réglables par le test qui en dépend. */
let pathname = '/';
let searchParams = new URLSearchParams();

export const currentPathname = (): string => pathname;
export const currentSearchParams = (): URLSearchParams => searchParams;

/**
 * Place l'écran sur une URL donnée.
 *
 * Les vues filtrées LISENT leurs critères dans l'URL : éprouver « l'état vide
 * diffère selon qu'un filtre est actif » suppose de pouvoir poser ce filtre, et
 * le seul endroit où il vit est la barre d'adresse.
 */
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
