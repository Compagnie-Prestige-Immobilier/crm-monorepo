import type { DemoVisibilityService } from './demo-visibility.service.js';

/**
 * Double d'essai de `DemoVisibilityService`.
 *
 * Même convention que `modules/sync/fake-prisma.ts` : le double vit à côté de
 * ce qu'il imite, pas dans un dossier `__mocks__` que personne ne relit.
 *
 * Par défaut le mode est ÉTEINT — l'état d'une plateforme en service, et celui
 * qu'un test doit exercer sauf mention contraire.
 */
export const fakeDemoVisibility = (enabled = false): DemoVisibilityService =>
  ({
    enabled: () => Promise.resolve(enabled),
    invalidate: () => undefined,
  }) as unknown as DemoVisibilityService;
