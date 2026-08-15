import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

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
 */
if (!('matchMedia' in window)) {
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
