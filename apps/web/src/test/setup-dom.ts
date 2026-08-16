import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { currentPathname, currentSearchParams, resetRouterMock, routerMock } from './router-mock';

/**
 * Le routeur d'application de Next, remplacé pour TOUS les tests de rendu.
 *
 * Déclaré ici plutôt que fichier par fichier : `useRouter()` lève hors du
 * serveur de Next, et presque tout écran du panel l'appelle, directement ou par
 * ses filtres d'URL. Le répéter dans chaque test en ferait un rite recopié, donc
 * un rite qu'on finit par oublier, et l'échec serait alors un « invariant
 * expected app router to be mounted » sans rapport avec ce qu'on éprouve.
 *
 * Voir `router-mock.ts` pour le détail, et `setUrl()` pour poser une URL.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => currentPathname(),
  useSearchParams: () => currentSearchParams(),
}));

beforeEach(() => {
  resetRouterMock();
});

/**
 * Amorce du projet `dom` de Vitest (voir `vitest.config.ts`).
 *
 * Trois choses, et rien d'autre : jsdom n'est pas un navigateur, et tout ce qui
 * suit comble un manque qui ferait échouer un test pour une raison SANS RAPPORT
 * avec ce qu'il éprouve.
 */

/**
 * Sans démontage, les arbres rendus s'empilent dans le même `document` : le
 * deuxième test d'un fichier verrait DEUX boutons « Enregistrer » et
 * `getByRole` lèverait « found multiple elements ». L'échec n'aurait rien à voir
 * avec le composant.
 */
afterEach(() => {
  cleanup();
});

/**
 * `matchMedia` n'existe pas dans jsdom. `use-prefers-reduced-motion` et
 * `next-themes` l'appellent au montage : sans lui, tout écran qui les traverse
 * lève avant d'avoir rendu la moindre ligne.
 *
 * On répond « ne correspond pas » : c'est le défaut de l'écran (animations
 * actives, thème clair), donc le rendu éprouvé est celui que voit la majorité.
 *
 * ═══ LA GARDE PORTE SUR `typeof`, ET C'EST TOUT L'ENJEU ═══
 *
 * Elle s'écrivait `if (!('matchMedia' in window))`, et ce test était FAUX :
 * jsdom DÉCLARE `matchMedia` comme un accesseur non implémenté. Mesuré ici
 * même, sur jsdom tel qu'installé :
 *
 *     'matchMedia' in window            → true
 *     typeof window.matchMedia          → 'undefined'
 *     descripteur                       → { enumerable: false, configurable: true }
 *                                         (un accesseur, donc sans `value`)
 *
 * `in` répond donc « présent », la garde conclut « rien à combler », et le
 * remplacement ci-dessous n'était JAMAIS installé. Tout composant traversant
 * `usePrefersReducedMotion` — les six graphiques du tableau de bord, les blocs
 * de portefeuille — mourait sur « window.matchMedia is not a function », pour
 * une raison sans aucun rapport avec ce qu'il éprouvait. C'est précisément ce
 * que l'en-tête de ce fichier promet d'éviter.
 *
 * Le défaut est resté invisible parce qu'aucun test de rendu n'avait encore
 * monté de graphique : la seule chose qui manquait à ce bloc, c'était quelqu'un
 * pour l'utiliser.
 *
 * `typeof … !== 'function'` couvre l'absence ET la présence inerte, qui sont
 * la même chose pour l'appelant.
 */
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

/**
 * `ResizeObserver` manque aussi, et les primitives Radix (Popover, Select,
 * DropdownMenu) l'instancient pour se positionner. Un observateur inerte suffit :
 * jsdom ne fait de toute façon aucune mise en page, donc aucune mesure ne serait
 * juste.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
