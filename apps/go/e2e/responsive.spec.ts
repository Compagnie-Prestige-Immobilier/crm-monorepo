import { expect, test } from '@playwright/test';

import { compteDe } from './comptes';

const compte = compteDe('ADMIN');

const ROUTES = ['/connexion', '/'];

test.use({ storageState: compte.etat });

for (const route of ROUTES) {
  test(`sans debordement horizontal: ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();

    const mesure = await page.evaluate(() => {
      const racine = document.documentElement;
      const coupables = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => element.getBoundingClientRect().right > racine.clientWidth + 1)
        .slice(0, 5)
        .map(
          (element) =>
            `${element.tagName.toLowerCase()}.${element.className.toString().slice(0, 80)}`,
        );
      return { largeur: racine.scrollWidth, ecran: racine.clientWidth, coupables };
    });

    expect(
      mesure.largeur,
      `${route} deborde de ${String(mesure.largeur - mesure.ecran)} px. Coupables: ${mesure.coupables.join(' | ')}`,
    ).toBeLessThanOrEqual(mesure.ecran + 1);
  });
}
