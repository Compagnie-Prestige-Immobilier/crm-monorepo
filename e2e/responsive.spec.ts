import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';
import { mesurerDebordement } from './donnees-listes';

const compte = compteDe('ADMIN');

const ROUTES = [
  '/connexion',
  '/',
  '/compte',
  '/chues/representants',
  '/chues/prospects',
  '/grand-public',
  '/grand-public/nouveau',
];

test.use({ storageState: compte.etat });

for (const route of ROUTES) {
  test(`sans debordement horizontal: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();

    const mesure = await mesurerDebordement(page);

    expect(
      mesure.largeur,
      `${route} deborde de ${String(mesure.largeur - mesure.ecran)} px. Coupables: ${mesure.coupables.join(' | ')}`,
    ).toBeLessThanOrEqual(mesure.ecran + 1);
  });
}
