import { expect, test } from '@playwright/test';

/**
 * CHU-HUB-07. `/chues` RENVOIE l'agent Banque & Finance vers son tableau de
 * bord ; il ne lui oppose pas un refus. Un refus casserait la tuile « Projet
 * CHUES » du hub des espaces pour ce rôle.
 */
test.use({ storageState: 'v1/.auth/banque.json' });

test('CHU-HUB-07 un agent Banque & Finance est renvoyé, pas refusé', async ({ page }) => {
  await page.goto('/chues');

  await expect(page).toHaveURL(/\/chues\/banque$/);
  await expect(page).toHaveTitle(/Tableau de bord bancaire/);
  await expect(page.getByRole('heading', { name: 'Accès refusé' })).toHaveCount(0);
});
