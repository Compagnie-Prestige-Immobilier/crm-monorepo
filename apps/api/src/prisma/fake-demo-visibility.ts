import type { DemoVisibilityService } from './demo-visibility.service.js';

/**
 * Double d'essai de `DemoVisibilityService`.
 *
 * Même convention que `modules/sync/fake-prisma.ts` : le double vit à côté de
 * ce qu'il imite, pas dans un dossier `__mocks__` que personne ne relit.
 *
 * Par défaut le mode est ÉTEINT, l'état d'une plateforme en service, et celui
 * qu'un test doit exercer sauf mention contraire.
 */
export const fakeDemoVisibility = (enabled: boolean | 'unknown' = false): DemoVisibilityService =>
  ({
    // `unknown` représente une lecture du réglage qui a ÉCHOUÉ. Il compte comme
    // « pas allumé » pour la visibilité, qui masque dans le doute, et comme
    // « pas éteint » pour la garde d'écriture, qui refuse dans le doute. Les
    // deux repliements sont opposés, et c'est précisément pourquoi le service
    // rend trois états et non un booléen.
    enabled: () => Promise.resolve(enabled === true),
    state: () => Promise.resolve(enabled === 'unknown' ? 'unknown' : enabled ? 'on' : 'off'),
    invalidate: () => undefined,
  }) as unknown as DemoVisibilityService;
